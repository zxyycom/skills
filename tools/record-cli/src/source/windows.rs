//! Windows source capture through a handle-relative capability rooted at the workspace.
use super::*;
use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
use cap_std::fs::{Dir, OpenOptions as CapOptions};
use std::{
    fs::OpenOptions,
    io::Read,
    os::windows::{
        ffi::OsStrExt,
        fs::{MetadataExt, OpenOptionsExt},
        io::AsRawHandle,
    },
};
use windows_sys::Win32::{
    Foundation::HANDLE,
    Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ, FILE_SHARE_WRITE,
        GetFileInformationByHandle,
    },
};

pub(super) fn file_identity(file: &File, directory: bool) -> Result<FileIdentity, SourceError> {
    let mut info = std::mem::MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::uninit();
    // SAFETY: file is an open Windows handle and info is writable storage.
    if unsafe { GetFileInformationByHandle(file.as_raw_handle() as HANDLE, info.as_mut_ptr()) } == 0
    {
        return Err(SourceError::Io(io::Error::last_os_error()));
    }
    // SAFETY: a successful API call initializes the entire structure.
    let info = unsafe { info.assume_init() };
    let size = if directory {
        0
    } else {
        ((info.nFileSizeHigh as u64) << 32) | info.nFileSizeLow as u64
    };
    Ok(FileIdentity {
        device: info.dwVolumeSerialNumber as u64,
        inode: ((info.nFileIndexHigh as u64) << 32) | info.nFileIndexLow as u64,
        mode: info.dwFileAttributes,
        size,
    })
}
fn root_dir(root: &Root) -> Result<Dir, SourceError> {
    // Root is opened without FILE_SHARE_DELETE, as required by cap-std.
    Ok(Dir::from_std_file(root.directory.try_clone()?))
}
fn open_file(dir: &Dir, path: &Path) -> Result<File, SourceError> {
    let mut options = CapOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    let file = dir.open_with(path, &options)?.into_std();
    let meta = file.metadata()?;
    if !meta.is_file() || meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err(SourceError::Unsafe(path.to_path_buf()));
    }
    Ok(file)
}
fn exact_name(dir: &Dir, name: &std::ffi::OsStr) -> Result<bool, SourceError> {
    for entry in dir.entries()? {
        if entry?.file_name().encode_wide().eq(name.encode_wide()) {
            return Ok(true);
        }
    }
    Ok(false)
}
fn parent_facts(
    root: &Root,
    path: &RelativePath,
) -> Result<(Dir, Vec<FileIdentity>, Vec<RelativePath>), SourceError> {
    let root_dir = root_dir(root)?;
    let mut parent = root_dir.try_clone()?;
    let mut prefix = PathBuf::new();
    let mut identities = vec![root.identity.clone()];
    let mut parent_paths = Vec::new();
    let parts: Vec<_> = path.as_path().components().collect();
    for component in parts.iter().take(parts.len().saturating_sub(1)) {
        let Component::Normal(name) = component else {
            return Err(SourceError::InvalidPath(path.0.clone()));
        };
        ensure_exact_directory_name(&parent, name, path)?;
        prefix.push(name);
        // Resolve against the root capability so a safe internal symlink may refer
        // to another in-root directory without granting ambient traversal.
        parent = root_dir.open_dir(&prefix)?;
        identities.push(file_identity(&parent.try_clone()?.into_std_file(), true)?);
        parent_paths.push(RelativePath::new(&prefix)?);
    }
    Ok((parent, identities, parent_paths))
}
// An alias resolved by Windows is unsafe, not an absent exact name.
fn ensure_exact_directory_name(
    parent: &Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<(), SourceError> {
    if !exact_name(parent, name)? {
        // An alias that Windows resolves is a case mismatch, not absence.
        return match parent.open_dir(name) {
            Ok(_) => Err(SourceError::Unsafe(path.0.clone())),
            Err(error) => Err(SourceError::Io(error)),
        };
    }
    Ok(())
}
pub fn open_root(path: &Path) -> Result<Root, SourceError> {
    let canonical = std::fs::canonicalize(path)?;
    let mut options = OpenOptions::new();
    options
        .read(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS);
    let directory = options.open(&canonical)?;
    let meta = directory.metadata()?;
    if !meta.is_dir() || meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err(SourceError::Unsafe(canonical));
    }
    let identity = file_identity(&directory, true)?;
    Ok(Root {
        path: canonical,
        directory,
        identity,
    })
}
// Exact spelling, no-follow open, handle identity, and parent chain for one capture.
struct OpenedSource {
    file: File,
    before: FileIdentity,
    before_time: u64,
    parents: Vec<FileIdentity>,
    parent_paths: Vec<RelativePath>,
}
fn open_source(root: &Root, path: &RelativePath) -> Result<Option<OpenedSource>, SourceError> {
    let resolved = resolve_directory_links(root, path, true)?;
    let (parent, parents, parent_paths) = match parent_facts(root, &resolved) {
        Ok(facts) => facts,
        Err(SourceError::Io(error)) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let name = resolved
        .as_path()
        .file_name()
        .ok_or_else(|| SourceError::InvalidPath(path.0.clone()))?;
    let Some(file) = open_exact_source(&parent, name, path)? else {
        return Ok(None);
    };
    let before = file_identity(&file, false)?;
    let before_time = file.metadata()?.last_write_time();
    Ok(Some(OpenedSource {
        file,
        before,
        before_time,
        parents,
        parent_paths,
    }))
}
// Exact spelling and no-follow open distinguish a missing source from an alias.
fn open_exact_source(
    parent: &Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<Option<File>, SourceError> {
    let exact = exact_name(parent, name)?;
    match open_file(parent, Path::new(name)) {
        Ok(file) if exact => Ok(Some(file)),
        Ok(_) => Err(SourceError::Unsafe(path.0.clone())),
        Err(SourceError::Io(error)) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}
fn capture_once(
    root: &Root,
    path: &RelativePath,
    limits: ReadLimits,
) -> Result<ExpectedFile, SourceError> {
    let Some(OpenedSource {
        mut file,
        before,
        before_time,
        parents,
        parent_paths,
    }) = open_source(root, path)?
    else {
        return Ok(ExpectedFile::Missing);
    };
    limits.check(before.size)?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(limits.maximum().saturating_add(1))
        .read_to_end(&mut bytes)?;
    limits.check(bytes.len() as u64)?;
    let after = file_identity(&file, false)?;
    if before != after
        || before_time != file.metadata()?.last_write_time()
        || bytes.len() as u64 != after.size
    {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(ExpectedFile::Present(SourceSnapshot {
        path: path.clone(),
        identity: after,
        parents,
        parent_paths,
        bytes,
    }))
}
pub fn capture(root: &Root, path: &RelativePath) -> Result<ExpectedFile, SourceError> {
    capture_bounded(root, path, u64::MAX, u64::MAX)
}
pub fn capture_bounded(
    root: &Root,
    path: &RelativePath,
    max_file_bytes: u64,
    remaining_total_bytes: u64,
) -> Result<ExpectedFile, SourceError> {
    let limits = ReadLimits {
        file: max_file_bytes,
        total: remaining_total_bytes,
    };
    let first = capture_once(root, path, limits)?;
    let second = capture_once(root, path, limits)?;
    if first != second {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(second)
}
fn capture_header_once(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<HeaderSnapshot>, SourceError> {
    let Some(OpenedSource {
        mut file,
        before,
        before_time,
        parents,
        parent_paths,
    }) = open_source(root, path)?
    else {
        return Ok(None);
    };
    let bytes = read_header(&mut file)?;
    let after = file_identity(&file, false)?;
    if before != after || before_time != file.metadata()?.last_write_time() {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(Some(HeaderSnapshot {
        path: path.clone(),
        identity: after,
        parents,
        parent_paths,
        bytes,
    }))
}
pub fn capture_header(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<HeaderSnapshot>, SourceError> {
    let first = capture_header_once(root, path)?;
    let second = capture_header_once(root, path)?;
    if first != second {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(second)
}
#[path = "windows/enumerate.rs"]
mod enumerate;
pub use enumerate::enumerate_directory;

#[path = "windows/attributes.rs"]
mod attributes;
pub(super) use attributes::{set_exact_attributes, validate_exact_attributes};
