use super::*;

/// Capture selected full payloads, leaving other member objects unopened. Missing paths
/// are represented by their absence while `paths` retains the requested set.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentSnapshot {
    pub(super) membership: PendingSnapshot,
    pub(super) paths: Vec<PathBuf>,
    blobs: Vec<(PathBuf, Vec<u8>)>,
}

impl ContentSnapshot {
    pub fn membership(&self) -> &PendingSnapshot {
        &self.membership
    }
    pub fn paths(&self) -> &[PathBuf] {
        &self.paths
    }
    pub fn blobs(&self) -> &[(PathBuf, Vec<u8>)] {
        &self.blobs
    }
}

pub fn read_selected(
    root: &std::path::Path,
    paths: &[PathBuf],
) -> Result<ContentSnapshot, GitError> {
    let mut paths = paths.to_vec();
    paths.sort();
    paths.dedup();
    for path in &paths {
        git_path(path)?;
    }
    let membership = read_pending(root)?;
    let blobs = selected_payloads(root, &paths, &membership)?;
    Ok(ContentSnapshot {
        membership,
        paths,
        blobs,
    })
}

/// Read only selected blobs.
fn selected_payloads(
    root: &std::path::Path,
    paths: &[PathBuf],
    membership: &PendingSnapshot,
) -> Result<Vec<(PathBuf, Vec<u8>)>, GitError> {
    let mut blobs = Vec::new();
    for path in paths {
        if let Some(entry) = selected_entry(membership, path)? {
            let kind = command(root, &["cat-file", "-t", &entry.oid], None)?;
            if kind != b"blob\n" {
                return Err(GitError::InvalidOutput("pending object is not a blob"));
            }
            let bytes = read_blob(root, &entry.oid)?;
            blobs.push((path.clone(), bytes));
        }
    }
    Ok(blobs)
}

/// A selected path may name at most one stage-zero supported Git file.
fn selected_entry<'a>(
    membership: &'a PendingSnapshot,
    path: &std::path::Path,
) -> Result<Option<&'a PendingEntry>, GitError> {
    let mut entries = membership.entries.iter().filter(|entry| entry.path == path);
    match (entries.next(), entries.next()) {
        (None, None) => Ok(None),
        (Some(entry), None)
            if entry.stage == 0 && matches!(entry.mode, 0o100644 | 0o100755 | 0o120000) =>
        {
            Ok(Some(entry))
        }
        _ => Err(GitError::InvalidOutput(
            "selected pending entry is not a unique file",
        )),
    }
}
