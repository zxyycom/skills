//! Resource phase observations and actual member journal.
use super::{ResourceIntent, TxError};
use crate::source::{
    self, DirectorySnapshot, ExpectedFile, RelativePath, Root, SourceError, SourceSnapshot,
};

fn error(code: &str, message: impl ToString) -> TxError {
    TxError::new(code, message.to_string())
}
fn directory(root: &Root, path: &RelativePath) -> Result<Option<DirectorySnapshot>, TxError> {
    match source::enumerate_directory(root, path) {
        Ok(snapshot) => Ok(Some(snapshot)),
        Err(SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(error("resource-directory", e)),
    }
}
fn file(root: &Root, path: &RelativePath) -> Result<ExpectedFile, TxError> {
    source::capture(root, path).map_err(|e| error("resource-source", e))
}
fn same_tree(before: &source::TreeSnapshot, after: &source::TreeSnapshot) -> bool {
    before.entries().len() == after.entries().len()
        && before
            .entries()
            .iter()
            .zip(after.entries())
            .all(|(left, right)| match (left, right) {
                (
                    source::TreeEntry::Directory {
                        path: a,
                        identity: ai,
                    },
                    source::TreeEntry::Directory {
                        path: b,
                        identity: bi,
                    },
                ) => {
                    a.as_path().strip_prefix(before.root().as_path()).ok()
                        == b.as_path().strip_prefix(after.root().as_path()).ok()
                        && ai == bi
                }
                (
                    source::TreeEntry::File {
                        path: a,
                        identity: ai,
                        bytes: ab,
                    },
                    source::TreeEntry::File {
                        path: b,
                        identity: bi,
                        bytes: bb,
                    },
                ) => {
                    a.as_path().strip_prefix(before.root().as_path()).ok()
                        == b.as_path().strip_prefix(after.root().as_path()).ok()
                        && ai == bi
                        && ab == bb
                }
                _ => false,
            })
}
fn moved_tree_still_matches(
    root: &Root,
    source_path: &RelativePath,
    destination: &RelativePath,
    before: &DirectorySnapshot,
    moved: &source::TreeSnapshot,
) -> Result<(), TxError> {
    let proof =
        source::capture_missing(root, source_path).map_err(|e| error("resource-move-verify", e))?;
    if !proof.matches_journaled_parent_of_directory(before, &[], &[]) {
        return Err(error("resource-move-verify", "original namespace changed"));
    }
    let current_dir = directory(root, destination)?
        .ok_or_else(|| error("resource-move-verify", "destination missing"))?;
    if !same_move_parent_chain(&current_dir, before) {
        return Err(error(
            "resource-move-verify",
            "destination parent chain changed",
        ));
    }
    let actual =
        source::capture_tree(root, destination).map_err(|e| error("resource-move-verify", e))?;
    if !same_tree(moved, &actual) {
        return Err(error("resource-move-verify", "moved tree changed"));
    }
    Ok(())
}
// Source and destination owner directories must retain the same parent identities.
fn same_move_parent_chain(current_dir: &DirectorySnapshot, before: &DirectorySnapshot) -> bool {
    current_dir.parents.len() == before.parents.len()
        && current_dir.parent_paths.len() == before.parent_paths.len()
        && current_dir.parents[..current_dir.parents.len() - 1]
            == before.parents[..before.parents.len() - 1]
        && current_dir.parent_paths[..current_dir.parent_paths.len() - 1]
            == before.parent_paths[..before.parent_paths.len() - 1]
}
fn recovery_dirs_from_tree(tree: &source::TreeSnapshot) -> Vec<super::RecoveryDirectory> {
    tree.entries()
        .iter()
        .filter_map(|entry| match entry {
            source::TreeEntry::Directory { path, identity } => Some(super::RecoveryDirectory {
                path: path.clone(),
                mode: super::exact_mode(identity.mode),
            }),
            _ => None,
        })
        .collect()
}
// None means that this intent does not observe the corresponding fact.
#[derive(Default)]
struct Observation {
    directory: Option<DirectorySnapshot>,
    file: Option<ExpectedFile>,
    destination: Option<ExpectedFile>,
    missing: Option<source::MissingProof>,
    tree: Option<source::TreeSnapshot>,
}
pub(super) struct Resources<'a> {
    intents: &'a [ResourceIntent],
    observations: Vec<Observation>,
}
pub(super) enum Actual {
    CreatedDirectory {
        path: RelativePath,
        observed: DirectorySnapshot,
    },
    RemovedDirectory {
        path: RelativePath,
        before: DirectorySnapshot,
    },
    CreatedFile {
        snapshot: SourceSnapshot,
    },
    RemovedFile {
        before: SourceSnapshot,
    },
    MovedDirectory {
        source: RelativePath,
        destination: RelativePath,
        before: Box<DirectorySnapshot>,
        destination_before: Box<source::MissingProof>,
        moved: Box<source::TreeSnapshot>,
        receipt: Box<source::MovedDirectory>,
    },
}
impl Actual {
    fn path(&self) -> &RelativePath {
        match self {
            Self::CreatedDirectory { path, .. } | Self::RemovedDirectory { path, .. } => path,
            Self::MovedDirectory { destination, .. } => destination,
            Self::CreatedFile { snapshot } => &snapshot.path,
            Self::RemovedFile { before } => &before.path,
        }
    }
}
struct Backup {
    source: RelativePath,
    snapshot: SourceSnapshot,
}
#[derive(Default)]
pub(super) struct Journal {
    entries: Vec<Actual>,
    backups: Vec<Backup>,
    uncertain_moves: Vec<Vec<super::RecoveryDirectory>>,
    pub changed: Vec<RelativePath>,
    pub unknown: Vec<RelativePath>,
}
mod apply;
mod backup;
mod observe;

fn file_snapshot_from_observation(snapshot: &SourceSnapshot) -> ExpectedFile {
    ExpectedFile::Present(SourceSnapshot {
        path: snapshot.path.clone(),
        identity: snapshot.identity.clone(),
        parents: snapshot.parents.clone(),
        parent_paths: snapshot.parent_paths.clone(),
        bytes: snapshot.bytes.clone(),
    })
}
mod backups;
mod recover;
mod verify;
