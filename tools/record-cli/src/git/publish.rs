//! Publish explicitly selected entries using Git's own index lock.
use super::{ContentSnapshot, command, git_path, read_pending};
use std::{
    collections::BTreeMap,
    io::Write,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingFile {
    pub mode: u32,
    pub bytes: Vec<u8>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingUpdate {
    pub path: PathBuf,
    pub file: Option<PendingFile>,
}
#[derive(Debug, PartialEq, Eq)]
pub enum FailureKind {
    Failed,
    PartialOrUnknown,
    CountUnavailable,
}
#[derive(Debug)]
pub struct ReplacementFailure {
    pub kind: FailureKind,
    pub detail: String,
    pub committed_paths: Option<Vec<PathBuf>>,
}
#[derive(Debug)]
pub struct ReplacementResult {
    pub changed_paths: Vec<PathBuf>,
    pub pending_after: super::PendingSnapshot,
}
fn failed(kind: FailureKind, detail: impl std::fmt::Display) -> ReplacementFailure {
    ReplacementFailure {
        kind,
        detail: detail.to_string(),
        committed_paths: None,
    }
}

/// Write selected objects first, then submit a single index-info batch. A failed
/// Git invocation may have changed the index; objects already written can remain.
pub fn replace_selected(
    root: &Path,
    expected: &ContentSnapshot,
    updates: &[PendingUpdate],
) -> Result<ReplacementResult, ReplacementFailure> {
    super::verify_worktree_root(root).map_err(|e| failed(FailureKind::Failed, e))?;
    let targets = validate_updates(expected, updates)?;
    check_conflicts(expected, &targets)?;
    let (input, changed) = build_index_batch(root, expected, targets)?;
    if !input.is_empty() {
        command(root, &["update-index", "-z", "--index-info"], Some(&input))
            .map_err(|e| failed(FailureKind::PartialOrUnknown, e))?;
    }
    let pending_after = read_pending(root).map_err(|e| ReplacementFailure {
        kind: if changed.is_empty() {
            FailureKind::Failed
        } else {
            FailureKind::CountUnavailable
        },
        detail: e.to_string(),
        committed_paths: (!changed.is_empty()).then(|| changed.clone()),
    })?;
    Ok(ReplacementResult {
        changed_paths: changed,
        pending_after,
    })
}

type Targets<'a> = BTreeMap<PathBuf, &'a Option<PendingFile>>;
fn validate_updates<'a>(
    expected: &ContentSnapshot,
    updates: &'a [PendingUpdate],
) -> Result<Targets<'a>, ReplacementFailure> {
    let mut targets = BTreeMap::new();
    for update in updates {
        git_path(&update.path).map_err(|e| failed(FailureKind::Failed, e))?;
        if !expected.paths().contains(&update.path)
            || targets.insert(update.path.clone(), &update.file).is_some()
        {
            return Err(failed(
                FailureKind::Failed,
                "updates must be unique selected paths",
            ));
        }
        if update
            .file
            .as_ref()
            .is_some_and(|f| !matches!(f.mode, 0o100644 | 0o100755 | 0o120000))
        {
            return Err(failed(FailureKind::Failed, "unsupported file mode"));
        }
    }
    Ok(targets)
}
fn check_conflicts(
    expected: &ContentSnapshot,
    targets: &Targets<'_>,
) -> Result<(), ReplacementFailure> {
    // Git can silently remove a file's ancestors or descendants when adding an
    // entry. Only paths explicitly deleted in this batch may be displaced.
    for (path, target) in targets {
        if target.is_none() {
            continue;
        }
        for other in expected
            .membership()
            .entries
            .iter()
            .map(|entry| &entry.path)
        {
            if paths_conflict(path, other)
                && !targets.get(other).is_some_and(|update| update.is_none())
            {
                return Err(failed(
                    FailureKind::Failed,
                    "selected path conflicts with pending path",
                ));
            }
        }
        if targets
            .iter()
            .any(|(other, update)| update.is_some() && paths_conflict(path, other))
        {
            return Err(failed(FailureKind::Failed, "selected paths conflict"));
        }
    }
    Ok(())
}
fn build_index_batch(
    root: &Path,
    expected: &ContentSnapshot,
    targets: Targets<'_>,
) -> Result<(Vec<u8>, Vec<PathBuf>), ReplacementFailure> {
    let oid_length = object_id_length(root)?;
    let mut input = Vec::new();
    let mut changed = Vec::new();
    for (path, target) in targets {
        if unchanged(expected, &path, target) {
            continue;
        }
        let name = git_path(&path).map_err(|e| failed(FailureKind::Failed, e))?;
        append_index_entry(root, &mut input, &name, target.as_ref(), oid_length)?;
        changed.push(path);
    }
    Ok((input, changed))
}
fn object_id_length(root: &Path) -> Result<usize, ReplacementFailure> {
    match command(root, &["rev-parse", "--show-object-format"], None)
        .map_err(|e| failed(FailureKind::Failed, e))?
        .as_slice()
    {
        b"sha1\n" => Ok(40),
        b"sha256\n" => Ok(64),
        _ => Err(failed(FailureKind::Failed, "unsupported Git object format")),
    }
}
fn unchanged(expected: &ContentSnapshot, path: &Path, target: &Option<PendingFile>) -> bool {
    let prior = expected
        .membership()
        .entries
        .iter()
        .find(|e| e.path == path && e.stage == 0);
    let bytes = expected
        .blobs()
        .iter()
        .find(|(p, _)| p == path)
        .map(|(_, b)| b.as_slice());
    match (prior, target) {
        (None, None) => true,
        (Some(e), Some(f)) => e.mode == f.mode && bytes == Some(f.bytes.as_slice()),
        _ => false,
    }
}
fn append_index_entry(
    root: &Path,
    input: &mut Vec<u8>,
    name: &str,
    target: Option<&PendingFile>,
    oid_length: usize,
) -> Result<(), ReplacementFailure> {
    match target {
        Some(file) => {
            let output = command(root, &["hash-object", "-w", "--stdin"], Some(&file.bytes))
                .map_err(|e| failed(FailureKind::Failed, e))?;
            let oid = std::str::from_utf8(&output)
                .map_err(|e| failed(FailureKind::Failed, e))?
                .trim();
            if oid.len() != oid_length || !super::valid_oid(oid) {
                return Err(failed(FailureKind::Failed, "invalid object ID"));
            }
            write!(input, "{:o} {}\t{}\0", file.mode, oid, name)
                .map_err(|e| failed(FailureKind::Failed, e))?;
        }
        None => write!(input, "0 {}\t{}\0", "0".repeat(oid_length), name)
            .map_err(|e| failed(FailureKind::Failed, e))?,
    }
    Ok(())
}
/// Compare path components, not textual prefixes such as `a` and `ab`.
fn paths_conflict(a: &Path, b: &Path) -> bool {
    a != b && (a.starts_with(b) || b.starts_with(a))
}
