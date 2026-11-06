use super::*;

/// Capture selected full payloads, leaving other member objects unopened. Missing paths
/// are represented by their absence while `paths` retains the requested set.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentSnapshot {
    pub(super) membership: PendingSnapshot,
    pub(super) paths: Vec<PathBuf>,
    blobs: Vec<(PathBuf, Vec<u8>)>,
    /// SHA-256 of the complete payload actually read, not the Git object ID.
    fingerprints: Vec<(PathBuf, [u8; 32])>,
    pub(super) root: PathBuf,
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
    pub fn fingerprints(&self) -> &[(PathBuf, [u8; 32])] {
        &self.fingerprints
    }
}

pub fn read_selected(
    root: &std::path::Path,
    paths: &[PathBuf],
) -> Result<ContentSnapshot, GitError> {
    read_selected_index(root, paths, None)
}

pub(super) fn read_selected_index(
    root: &std::path::Path,
    paths: &[PathBuf],
    index: Option<&std::path::Path>,
) -> Result<ContentSnapshot, GitError> {
    let canonical_root = root.canonicalize().map_err(GitError::Io)?;
    let mut paths = paths.to_vec();
    paths.sort();
    paths.dedup();
    for path in &paths {
        validate_path(path)?;
    }
    let membership = read_pending_index(root, index)?;
    let (blobs, fingerprints) = selected_payloads(root, &paths, &membership)?;
    verify_snapshot_stable(root, index, &canonical_root, &membership)?;
    Ok(ContentSnapshot {
        root: canonical_root,
        membership,
        paths,
        blobs,
        fingerprints,
    })
}

type SelectedPayloads = (Vec<(PathBuf, Vec<u8>)>, Vec<(PathBuf, [u8; 32])>);

/// Read only selected blobs and fingerprint their complete payloads.
fn selected_payloads(
    root: &std::path::Path,
    paths: &[PathBuf],
    membership: &PendingSnapshot,
) -> Result<SelectedPayloads, GitError> {
    let mut blobs = Vec::new();
    let mut fingerprints = Vec::new();
    for path in paths {
        if let Some(entry) = selected_entry(membership, path)? {
            let kind = command(root, &["cat-file", "-t", &entry.oid], None)?;
            if kind != b"blob\n" {
                return Err(GitError::InvalidOutput("pending object is not a blob"));
            }
            let bytes = read_blob(root, &entry.oid)?;
            use sha2::{Digest, Sha256};
            fingerprints.push((path.clone(), Sha256::digest(&bytes).into()));
            blobs.push((path.clone(), bytes));
        }
    }
    Ok((blobs, fingerprints))
}

/// Reject membership or root changes while the selected payloads were read.
fn verify_snapshot_stable(
    root: &std::path::Path,
    index: Option<&std::path::Path>,
    canonical_root: &std::path::Path,
    membership: &PendingSnapshot,
) -> Result<(), GitError> {
    if read_pending_index(root, index)? != *membership {
        return Err(GitError::InvalidOutput("pending changed while reading"));
    }
    if root.canonicalize().map_err(GitError::Io)? != canonical_root {
        return Err(GitError::InvalidOutput("repository root changed"));
    }
    Ok(())
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
