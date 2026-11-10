//! Workspace-relative source observations for the record CLI.
use std::fs::File;
use std::io::Read;
use std::{
    fmt, io,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct RelativePath(PathBuf);
impl RelativePath {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, SourceError> {
        let path = path.as_ref();
        let valid_text = path.to_str().is_some_and(|s| {
            !s.is_empty()
                && s.split(['/', if cfg!(windows) { '\\' } else { '/' }])
                    .all(|p| !p.is_empty() && p != "." && p != "..")
        });
        if !valid_text || !path.components().all(|c| matches!(c, Component::Normal(_))) {
            return Err(SourceError::InvalidPath(path.to_path_buf()));
        }
        Ok(Self(path.to_path_buf()))
    }
    pub fn as_path(&self) -> &Path {
        &self.0
    }
}
#[derive(Debug)]
pub struct Root {
    path: PathBuf,
    directory: cap_std::fs::Dir,
}
impl Root {
    pub fn path(&self) -> &Path {
        &self.path
    }
}
pub fn open_root(path: &Path) -> Result<Root, SourceError> {
    let path = std::fs::canonicalize(path)?;
    let directory = cap_std::fs::Dir::open_ambient_dir(&path, cap_std::ambient_authority())?;
    Ok(Root { path, directory })
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceSnapshot {
    pub path: RelativePath,
    pub bytes: Vec<u8>,
}
#[derive(Debug, PartialEq, Eq)]
pub struct HeaderSnapshot {
    pub path: RelativePath,
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
    InvalidUtf8,
    FileBudgetExceeded { size: u64, limit: u64 },
    TotalBudgetExceeded { size: u64, remaining: u64 },
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

fn open_file(root: &Root, path: &RelativePath) -> Result<Option<std::fs::File>, SourceError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    let metadata = match root.directory.symlink_metadata(path.as_path()) {
        Ok(meta) => meta,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    if metadata.file_type().is_symlink() {
        return Err(SourceError::Symlink(path.0.clone()));
    }
    if !metadata.is_file() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    let mut options = cap_std::fs::OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    Ok(Some(
        root.directory
            .open_with(path.as_path(), &options)?
            .into_std(),
    ))
}
pub fn capture(root: &Root, path: &RelativePath) -> Result<ExpectedFile, SourceError> {
    capture_bounded(root, path, u64::MAX, u64::MAX)
}
pub fn capture_bounded(
    root: &Root,
    path: &RelativePath,
    file_limit: u64,
    total_limit: u64,
) -> Result<ExpectedFile, SourceError> {
    let Some(file) = open_file(root, path)? else {
        return Ok(ExpectedFile::Missing);
    };
    let size = file.metadata()?.len();
    check_limits(size, file_limit, total_limit)?;
    let mut bytes = Vec::new();
    file.take(file_limit.min(total_limit).saturating_add(1))
        .read_to_end(&mut bytes)?;
    check_limits(bytes.len() as u64, file_limit, total_limit)?;
    Ok(ExpectedFile::Present(SourceSnapshot {
        path: path.clone(),
        bytes,
    }))
}
fn check_limits(size: u64, file: u64, total: u64) -> Result<(), SourceError> {
    if size > file {
        return Err(SourceError::FileBudgetExceeded { size, limit: file });
    }
    if size > total {
        return Err(SourceError::TotalBudgetExceeded {
            size,
            remaining: total,
        });
    }
    Ok(())
}
mod header;
pub fn capture_header(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<HeaderSnapshot>, SourceError> {
    let Some(mut file) = open_file(root, path)? else {
        return Ok(None);
    };
    Ok(Some(HeaderSnapshot {
        path: path.clone(),
        bytes: header::read_header(&mut file)?,
    }))
}
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
    pub kind: MemberKind,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectorySnapshot {
    pub path: RelativePath,
    pub members: Vec<DirectoryMember>,
}
/// Check only the directory itself without enumerating unrelated members.
pub fn directory_exists(root: &Root, path: &RelativePath) -> Result<bool, SourceError> {
    let metadata = match root.directory.symlink_metadata(path.as_path()) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.into()),
    };
    if metadata.file_type().is_symlink() {
        return Err(SourceError::Symlink(path.0.clone()));
    }
    if !metadata.is_dir() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    Ok(true)
}

mod resource_directory;
mod resource_file;
#[cfg(windows)]
pub use resource_directory::same_single_link_member;
pub use resource_directory::{
    ResourceDirectoryVersion, resource_directory_version, resource_member_kind,
};
pub(crate) use resource_file::open_resource_file;

pub fn enumerate_directory(
    root: &Root,
    path: &RelativePath,
) -> Result<DirectorySnapshot, SourceError> {
    let metadata = root.directory.symlink_metadata(path.as_path())?;
    if metadata.file_type().is_symlink() {
        return Err(SourceError::Symlink(path.0.clone()));
    }
    if !metadata.is_dir() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    let dir = root.directory.open_dir(path.as_path())?;
    let mut members = Vec::new();
    for item in dir.entries()? {
        let item = item?;
        let name = item
            .file_name()
            .into_string()
            .map_err(|_| SourceError::InvalidPath(path.0.clone()))?;
        let kind = member_kind(item.file_type()?);
        members.push(DirectoryMember { name, kind });
    }
    members.sort_by(|a, b| a.name.encode_utf16().cmp(b.name.encode_utf16()));
    Ok(DirectorySnapshot {
        path: path.clone(),
        members,
    })
}
fn member_kind(ty: cap_std::fs::FileType) -> MemberKind {
    if ty.is_file() {
        MemberKind::File
    } else if ty.is_dir() {
        MemberKind::Directory
    } else if ty.is_symlink() {
        MemberKind::Symlink
    } else {
        MemberKind::Other
    }
}
#[derive(Debug)]
pub struct TreeSnapshot {
    root: RelativePath,
    entries: Vec<TreeEntry>,
}
#[derive(Debug)]
pub enum TreeEntry {
    Directory { path: RelativePath },
    File { path: RelativePath },
}
impl TreeSnapshot {
    pub fn root(&self) -> &RelativePath {
        &self.root
    }
    pub fn entries(&self) -> &[TreeEntry] {
        &self.entries
    }
}
pub fn capture_tree(root: &Root, path: &RelativePath) -> Result<TreeSnapshot, SourceError> {
    fn walk(
        root: &Root,
        path: &RelativePath,
        entries: &mut Vec<TreeEntry>,
    ) -> Result<(), SourceError> {
        let listing = enumerate_directory(root, path)?;
        entries.push(TreeEntry::Directory { path: path.clone() });
        for member in listing.members {
            let child = RelativePath::new(path.as_path().join(member.name))?;
            match member.kind {
                MemberKind::Directory => walk(root, &child, entries)?,
                MemberKind::File => entries.push(TreeEntry::File { path: child }),
                _ => return Err(SourceError::Unsafe(child.0)),
            }
        }
        Ok(())
    }
    let mut entries = Vec::new();
    walk(root, path, &mut entries)?;
    Ok(TreeSnapshot {
        root: path.clone(),
        entries,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_bounded_file_and_rejects_parent_paths() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("record"), b"hello").unwrap();
        let root = open_root(temp.path()).unwrap();
        let path = RelativePath::new("record").unwrap();
        assert!(matches!(
            capture_bounded(&root, &path, 4, 10),
            Err(SourceError::FileBudgetExceeded { .. })
        ));
        assert!(matches!(
            capture_bounded(&root, &path, 10, 4),
            Err(SourceError::TotalBudgetExceeded { .. })
        ));
        assert!(
            matches!(capture(&root, &path).unwrap(), ExpectedFile::Present(SourceSnapshot { bytes, .. }) if bytes == b"hello")
        );
        assert!(RelativePath::new("../record").is_err());
        assert!(RelativePath::new("a/../record").is_err());
    }
    #[cfg(unix)]
    #[test]
    fn directory_boundary_does_not_enumerate_unrelated_names() {
        use std::os::unix::ffi::OsStringExt;
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join("resources")).unwrap();
        let unrelated = std::ffi::OsString::from_vec(vec![0xff]);
        std::fs::write(temp.path().join("resources").join(unrelated), b"unselected").unwrap();
        let root = open_root(temp.path()).unwrap();
        assert!(directory_exists(&root, &RelativePath::new("resources").unwrap()).unwrap());
        assert!(!directory_exists(&root, &RelativePath::new("absent").unwrap()).unwrap());
    }
    #[test]
    fn captures_tree_members() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(temp.path().join("owner/sub")).unwrap();
        std::fs::write(temp.path().join("owner/sub/data"), b"content").unwrap();
        let root = open_root(temp.path()).unwrap();
        let tree = capture_tree(&root, &RelativePath::new("owner").unwrap()).unwrap();
        assert_eq!(tree.entries().len(), 3);
        assert!(
            matches!(&tree.entries()[2], TreeEntry::File { path } if path.as_path() == Path::new("owner/sub/data"))
        );
    }
}
