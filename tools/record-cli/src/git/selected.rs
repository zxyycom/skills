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
    let mut index: std::collections::BTreeMap<&std::path::Path, Vec<&PendingEntry>> =
        std::collections::BTreeMap::new();
    for entry in &membership.entries {
        index.entry(&entry.path).or_default().push(entry);
    }
    let mut selected = Vec::new();
    for path in paths {
        match index.get(path.as_path()).map(Vec::as_slice).unwrap_or(&[]) {
            [] => {}
            [entry] if entry.stage == 0 && matches!(entry.mode, 0o100644 | 0o100755 | 0o120000) => {
                selected.push((path, *entry))
            }
            _ => return selected_payloads_sequential(root, paths, &index),
        }
    }
    let objects = match read_blobs(
        root,
        &selected
            .iter()
            .map(|(_, e)| e.oid.clone())
            .collect::<Vec<_>>(),
    ) {
        Ok(objects) => objects,
        Err(error) => {
            selected_payloads_sequential(root, paths, &index)?;
            return Err(error);
        }
    };
    Ok(selected
        .into_iter()
        .map(|(path, entry)| (path.clone(), objects[&entry.oid].clone()))
        .collect())
}

/// Restore the original per-path failure order only on an unsuccessful batch.
fn selected_payloads_sequential(
    root: &std::path::Path,
    paths: &[PathBuf],
    index: &std::collections::BTreeMap<&std::path::Path, Vec<&PendingEntry>>,
) -> Result<Vec<(PathBuf, Vec<u8>)>, GitError> {
    let mut blobs = Vec::new();
    for path in paths {
        match index.get(path.as_path()).map(Vec::as_slice).unwrap_or(&[]) {
            [] => {}
            [entry] if entry.stage == 0 && matches!(entry.mode, 0o100644 | 0o100755 | 0o120000) => {
                if command(root, &["cat-file", "-t", &entry.oid], None)? != b"blob\n" {
                    return Err(GitError::InvalidOutput("pending object is not a blob"));
                }
                blobs.push((path.clone(), read_blob(root, &entry.oid)?));
            }
            _ => {
                return Err(GitError::InvalidOutput(
                    "selected pending entry is not a unique file",
                ));
            }
        }
    }
    Ok(blobs)
}
