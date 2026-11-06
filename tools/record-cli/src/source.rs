//! Phase-local source capture primitives. These do not yet implement the full
//! platform safety contract; paths are validated and unsupported cases fail closed.
#[cfg(any(unix, windows))]
use std::fs::File;
#[cfg(any(unix, windows))]
mod directory_move;
#[cfg(any(unix, windows))]
pub(crate) use directory_move::{MoveDirectoryEffect, MovedDirectory, move_directory};
#[cfg(test)]
pub(crate) use directory_move::{set_move_after_test_hook, set_move_before_test_hook};
use std::{
    fmt, io,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct RelativePath(PathBuf);
impl RelativePath {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, SourceError> {
        let path = path.as_ref();
        let normalized = path.to_str().is_some_and(|text| {
            #[cfg(windows)]
            let parts = text.split(['/', '\\']);
            #[cfg(not(windows))]
            let parts = text.split('/');
            #[cfg(windows)]
            let characters_safe = !text.contains(':');
            #[cfg(not(windows))]
            let characters_safe = !text.contains('\\');
            characters_safe
                && parts.into_iter().all(|part| {
                    if part.is_empty() || part == "." || part == ".." {
                        return false;
                    }
                    #[cfg(windows)]
                    {
                        let stem = part
                            .split('.')
                            .next()
                            .unwrap_or("")
                            .trim_end_matches(' ')
                            .to_ascii_uppercase();
                        if matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
                            || (stem.len() == 4
                                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                                && matches!(stem.as_bytes()[3], b'1'..=b'9'))
                        {
                            return false;
                        }
                    }
                    true
                })
        });
        if !normalized || !path.components().all(|c| matches!(c, Component::Normal(_))) {
            return Err(SourceError::InvalidPath(path.to_path_buf()));
        }
        Ok(Self(path.to_path_buf()))
    }
    pub fn as_path(&self) -> &Path {
        &self.0
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileIdentity {
    pub device: u64,
    pub inode: u64,
    pub mode: u32,
    pub size: u64,
}
impl FileIdentity {
    // Identity plus representation, deliberately excluding mutable size.
    pub(crate) fn same_identity_and_mode(&self, other: &Self) -> bool {
        self.device == other.device && self.inode == other.inode && self.mode == other.mode
    }
}
#[derive(Debug)]
pub struct Root {
    pub(crate) path: PathBuf,
    #[cfg(any(unix, windows))]
    directory: File,
    pub(crate) identity: FileIdentity,
}
impl Root {
    pub fn path(&self) -> &Path {
        &self.path
    }
    pub fn identity(&self) -> &FileIdentity {
        &self.identity
    }
}
#[derive(Debug, PartialEq, Eq)]
pub struct SourceSnapshot {
    pub path: RelativePath,
    pub identity: FileIdentity,
    pub parents: Vec<FileIdentity>,
    pub parent_paths: Vec<RelativePath>,
    pub bytes: Vec<u8>,
}
#[derive(Debug, PartialEq, Eq)]
pub enum ExpectedFile {
    Missing,
    Present(SourceSnapshot),
}
#[derive(Debug)]
pub enum SourceError {
    InvalidPath(PathBuf),
    Io(io::Error),
    Unsafe(PathBuf),
    Symlink(PathBuf),
    NonRegular(PathBuf),
    CaseMismatch { path: PathBuf, actual: String },
    Changed(PathBuf),
    InvalidUtf8,
    FileBudgetExceeded { size: u64, limit: u64 },
    TotalBudgetExceeded { size: u64, remaining: u64 },
    UnsupportedPlatform,
}
impl fmt::Display for SourceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for SourceError {}
impl From<io::Error> for SourceError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}
pub fn strict_text(snapshot: &SourceSnapshot) -> Result<&str, SourceError> {
    std::str::from_utf8(&snapshot.bytes).map_err(|_| SourceError::InvalidUtf8)
}

/// Header-only observation. `bytes` ends at the closing delimiter; it is not
/// a whole-file snapshot and must never be used as a write guard.
#[derive(Debug, PartialEq, Eq)]
pub struct HeaderSnapshot {
    pub path: RelativePath,
    pub identity: FileIdentity,
    pub parents: Vec<FileIdentity>,
    pub parent_paths: Vec<RelativePath>,
    pub bytes: Vec<u8>,
}

mod header;
use header::read_header;

#[derive(Clone, Copy)]
struct ReadLimits {
    file: u64,
    total: u64,
}
impl ReadLimits {
    fn check(self, size: u64) -> Result<(), SourceError> {
        if size > self.file {
            return Err(SourceError::FileBudgetExceeded {
                size,
                limit: self.file,
            });
        }
        if size > self.total {
            return Err(SourceError::TotalBudgetExceeded {
                size,
                remaining: self.total,
            });
        }
        Ok(())
    }
    fn maximum(self) -> u64 {
        self.file.min(self.total)
    }
}

mod resolve;
#[cfg(any(unix, windows))]
use resolve::resolve_directory_links;

#[cfg(unix)]
fn identity(meta: &std::fs::Metadata) -> FileIdentity {
    use std::os::unix::fs::MetadataExt;
    FileIdentity {
        device: meta.dev(),
        inode: meta.ino(),
        mode: meta.mode(),
        size: meta.size(),
    }
}
#[cfg(unix)]
fn directory_identity(meta: &std::fs::Metadata) -> FileIdentity {
    let mut result = identity(meta);
    // Directory size changes on unrelated sibling activity and is not identity.
    result.size = 0;
    result
}
#[cfg(not(windows))]
mod file_capture;
#[cfg(not(windows))]
pub use file_capture::{capture, capture_bounded, capture_header, open_root};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MemberKind {
    File,
    Directory,
    Symlink,
    Other,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryMember {
    pub name: String,
    pub identity: FileIdentity,
    pub kind: MemberKind,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectorySnapshot {
    pub path: RelativePath,
    pub identity: FileIdentity,
    pub parents: Vec<FileIdentity>,
    pub parent_paths: Vec<RelativePath>,
    pub members: Vec<DirectoryMember>,
}

#[cfg(not(windows))]
mod enumerate;
#[cfg(not(windows))]
pub use enumerate::enumerate_directory;

#[cfg(windows)]
#[path = "source/windows.rs"]
mod windows;
#[cfg(windows)]
pub use windows::{capture, capture_bounded, capture_header, enumerate_directory, open_root};

/// Identity of the opened object. Compare device/inode only when file contents
/// may legitimately change while a lock is held.
#[cfg(unix)]
pub fn identity_from_handle(file: &File) -> Result<FileIdentity, SourceError> {
    Ok(identity(&file.metadata()?))
}
#[cfg(windows)]
pub fn identity_from_handle(file: &File) -> Result<FileIdentity, SourceError> {
    windows::file_identity(file, false)
}
#[cfg(any(unix, windows))]
pub fn same_file_identity(a: &File, b: &File) -> Result<bool, SourceError> {
    let a = identity_from_handle(a)?;
    let b = identity_from_handle(b)?;
    Ok(a.device == b.device && a.inode == b.inode)
}

/// A phase-local capture of a selected owner tree. Construction is private;
/// consumers cannot turn an unchecked path list into a tree proof.
mod tree;
pub use tree::{TreeEntry, TreeSnapshot, capture_tree};

/// Cooperative collection lock. Dropping without an explicit successful release
/// closes the handle but intentionally preserves the lock file for reconciliation.
#[derive(Debug)]
pub struct CollectionLock {
    file: File,
    path: RelativePath,
    workspace: PathBuf,
    workspace_identity: FileIdentity,
}
#[derive(Debug)]
pub enum LockError {
    Acquire(SourceError),
    Release(SourceError),
    Replaced,
}
impl std::fmt::Display for LockError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for LockError {}
#[cfg(any(unix, windows))]
pub fn acquire_collection_lock(
    root: &Root,
    path: &RelativePath,
) -> Result<CollectionLock, LockError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    let directory = cap_std::fs::Dir::from_std_file(
        root.directory
            .try_clone()
            .map_err(|e| LockError::Acquire(e.into()))?,
    );
    let mut options = cap_std::fs::OpenOptions::new();
    options
        .read(true)
        .write(true)
        .create_new(true)
        .follow(FollowSymlinks::No);
    let file = directory
        .open_with(path.as_path(), &options)
        .map_err(|e| LockError::Acquire(e.into()))?
        .into_std();
    Ok(CollectionLock {
        file,
        path: path.clone(),
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
    })
}
#[cfg(any(unix, windows))]
impl CollectionLock {
    /// Explicitly release only a still-matching empty lock. A failure preserves
    /// the entry; as with the rest of the transaction, non-cooperative edits do
    /// not have cross-operation atomic isolation.
    pub fn release(self, root: &Root) -> Result<(), LockError> {
        if self.workspace != root.path || self.workspace_identity != root.identity {
            return Err(LockError::Replaced);
        }
        let expected = identity_from_handle(&self.file).map_err(LockError::Release)?;
        let current = capture_bounded(root, &self.path, 0, 0).map_err(LockError::Release)?;
        match current {
            ExpectedFile::Present(actual)
                if actual.identity.device == expected.device
                    && actual.identity.inode == expected.inode => {}
            _ => return Err(LockError::Replaced),
        }
        let directory = cap_std::fs::Dir::from_std_file(
            root.directory
                .try_clone()
                .map_err(|e| LockError::Release(e.into()))?,
        );
        directory
            .remove_file(self.path.as_path())
            .map_err(|e| LockError::Release(e.into()))
    }
}

mod file_write;
pub(crate) use file_write::{
    CreateEffect, CreateFailure, CreateMode, CreatedFile, RemoveEffect, RemoveFailure,
};
#[cfg(any(unix, windows))]
pub(crate) use file_write::{
    create_exclusive, finalize_created_mode, open_verified_for_update, remove_if_matches,
};

mod missing;
pub use missing::MissingProof;
#[cfg(any(unix, windows))]
pub(crate) use missing::capture_missing;
#[cfg(any(unix, windows))]
use missing::parent_chain;

mod directory_write;
#[cfg(any(unix, windows))]
use directory_write::reject_final_link;
#[cfg(test)]
pub(crate) use directory_write::set_mkdir_test_hook;
#[cfg(any(unix, windows))]
pub(crate) use directory_write::{
    CreatedDirectory, create_directory_exclusive, remove_empty_directory,
};

mod exact_name;
#[cfg(any(unix, windows))]
use exact_name::has_exact_resource_name;
mod resource_facts;
mod selected;
pub use resource_facts::{
    ResourceDirectoryFact, ResourceRootFact, capture_resource_directories, capture_resource_root,
};
pub use selected::{
    SelectedMember, SelectedStatMember, SelectedStatTree, SelectedTree, capture_selected_tree,
    inspect_selected_tree,
};

#[cfg(test)]
mod tests;
