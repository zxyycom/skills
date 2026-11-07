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
fn same_directory(a: Option<&DirectorySnapshot>, b: Option<&DirectorySnapshot>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(a), Some(b)) => {
            a.path == b.path
                && super::exact_mode(a.identity.mode) == super::exact_mode(b.identity.mode)
                && a.members.len() == b.members.len()
                && a.members.iter().zip(&b.members).all(|(a, b)| {
                    a.name == b.name
                        && a.kind == b.kind
                        && super::exact_mode(a.identity.mode) == super::exact_mode(b.identity.mode)
                })
        }
        _ => false,
    }
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
                        && super::exact_mode(ai.mode) == super::exact_mode(bi.mode)
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
                        && super::exact_mode(ai.mode) == super::exact_mode(bi.mode)
                        && ab == bb
                }
                _ => false,
            })
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
}
impl Actual {
    fn path(&self) -> &RelativePath {
        match self {
            Self::CreatedDirectory { path, .. } | Self::RemovedDirectory { path, .. } => path,
            Self::CreatedFile { snapshot } => &snapshot.path,
            Self::RemovedFile { before } => &before.path,
        }
    }
}
struct Backup {
    source: RelativePath,
    snapshot: SourceSnapshot,
}
struct CopiedMoveFile {
    source: RelativePath,
    destination: RelativePath,
    bytes: Vec<u8>,
    mode: u32,
}
#[derive(Default)]
pub(super) struct Journal {
    entries: Vec<Actual>,
    backups: Vec<Backup>,
    copied_move_files: Vec<CopiedMoveFile>,
    exited_moves: Vec<RelativePath>,
    pub changed: Vec<RelativePath>,
    pub unknown: Vec<RelativePath>,
}
mod apply;
mod backup;
mod copy_move;
mod observe;
mod retire_move;

mod backups;
mod recover;
mod verify;
