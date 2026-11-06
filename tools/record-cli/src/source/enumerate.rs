//! Independent directory membership capture.
use super::*;

#[cfg(target_os = "linux")]
struct OpenedDirectory {
    directory: File,
    parents: Vec<FileIdentity>,
    parent_paths: Vec<RelativePath>,
}
#[cfg(target_os = "linux")]
fn open_directory(root: &Root, path: &RelativePath) -> Result<OpenedDirectory, SourceError> {
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let resolved = resolve_directory_links(root, path, false)?;
    let mut directory = root.directory.try_clone()?;
    let mut parents = vec![directory_identity(&directory.metadata()?)];
    let mut parent_paths = Vec::new();
    let mut prefix = PathBuf::new();
    for component in resolved.as_path().components() {
        let Component::Normal(name) = component else {
            return Err(SourceError::InvalidPath(path.0.clone()));
        };
        prefix.push(name);
        let opened = open_observed_directory(&capability, &prefix, path)?;
        directory = opened.file;
        parents.push(opened.identity);
        parent_paths.push(RelativePath::new(&prefix)?);
    }
    let directory = reopen_for_enumeration(directory)?;
    Ok(OpenedDirectory {
        directory,
        parents,
        parent_paths,
    })
}
// Bind each traversed directory handle to an identity in the parent chain.
#[cfg(target_os = "linux")]
struct ObservedDirectory {
    file: File,
    identity: FileIdentity,
}
#[cfg(target_os = "linux")]
fn open_observed_directory(
    capability: &cap_std::fs::Dir,
    prefix: &Path,
    path: &RelativePath,
) -> Result<ObservedDirectory, SourceError> {
    let file = capability.open_dir(prefix)?.into_std_file();
    let metadata = file.metadata()?;
    if !metadata.is_dir() {
        return Err(SourceError::Unsafe(path.0.clone()));
    }
    Ok(ObservedDirectory {
        file,
        identity: directory_identity(&metadata),
    })
}
// Reopen the same retained O_PATH directory as a readable enumeration handle.
#[cfg(target_os = "linux")]
fn reopen_for_enumeration(directory: File) -> Result<File, SourceError> {
    use std::os::fd::AsRawFd;
    // cap-std may return an O_PATH directory descriptor; reopen the same
    // directory via its own handle before using fdopendir.
    // SAFETY: directory is a live directory descriptor; the name is a fixed C string.
    let readable = unsafe {
        libc::openat(
            directory.as_raw_fd(),
            c".".as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
        )
    };
    if readable < 0 {
        return Err(SourceError::Io(io::Error::last_os_error()));
    }
    use std::os::fd::FromRawFd;
    // SAFETY: openat returned a newly owned descriptor.
    Ok(unsafe { File::from_raw_fd(readable) })
}
#[cfg(target_os = "linux")]
fn read_members(
    directory: &File,
    path: &RelativePath,
) -> Result<Vec<DirectoryMember>, SourceError> {
    use std::{ffi::CStr, os::fd::AsRawFd};
    // fdopendir owns its argument; duplicate so directory remains available for fstatat.
    // SAFETY: fd is valid; fdopendir consumes only the duplicated descriptor.
    let dup = unsafe { libc::dup(directory.as_raw_fd()) };
    if dup < 0 {
        return Err(SourceError::Io(io::Error::last_os_error()));
    }
    // SAFETY: dup is a valid independently owned directory descriptor.
    let stream = unsafe { libc::fdopendir(dup) };
    if stream.is_null() {
        let error = io::Error::last_os_error();
        // SAFETY: fdopendir failed and did not consume dup.
        unsafe { libc::close(dup) };
        return Err(SourceError::Io(error));
    }
    struct DirStream(*mut libc::DIR);
    impl Drop for DirStream {
        fn drop(&mut self) {
            unsafe {
                libc::closedir(self.0);
            }
        }
    }
    let stream = DirStream(stream);
    let mut members = Vec::new();
    loop {
        // SAFETY: stream remains owned and valid until the end of this scope.
        unsafe {
            *libc::__errno_location() = 0;
        }
        let entry = unsafe { libc::readdir(stream.0) };
        if entry.is_null() {
            let error = io::Error::last_os_error();
            if error.raw_os_error() != Some(0) {
                return Err(SourceError::Io(error));
            }
            break;
        }
        // SAFETY: readdir returns a valid dirent with a NUL-terminated name.
        let name = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) };
        if name.to_bytes() == b"." || name.to_bytes() == b".." {
            continue;
        }
        members.push(read_member(directory, path, name)?);
    }
    Ok(members)
}

#[cfg(target_os = "linux")]
fn read_member(
    directory: &File,
    path: &RelativePath,
    name: &std::ffi::CStr,
) -> Result<DirectoryMember, SourceError> {
    use std::os::fd::AsRawFd;
    let text = name
        .to_str()
        .map_err(|_| SourceError::InvalidPath(path.0.clone()))?;
    let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
    // SAFETY: dirfd and name are valid and stat points to writable storage.
    if unsafe {
        libc::fstatat(
            directory.as_raw_fd(),
            name.as_ptr(),
            stat.as_mut_ptr(),
            libc::AT_SYMLINK_NOFOLLOW,
        )
    } != 0
    {
        return Err(SourceError::Io(io::Error::last_os_error()));
    }
    // SAFETY: successful fstatat initialized the complete stat value.
    let stat = unsafe { stat.assume_init() };
    let mode = stat.st_mode;
    let kind = match mode & libc::S_IFMT {
        libc::S_IFREG => MemberKind::File,
        libc::S_IFDIR => MemberKind::Directory,
        libc::S_IFLNK => MemberKind::Symlink,
        _ => MemberKind::Other,
    };
    Ok(DirectoryMember {
        name: text.to_owned(),
        identity: FileIdentity {
            device: stat.st_dev,
            inode: stat.st_ino,
            mode,
            size: stat.st_size as u64,
        },
        kind,
    })
}
#[cfg(target_os = "linux")]
fn enumerate_once(root: &Root, path: &RelativePath) -> Result<DirectorySnapshot, SourceError> {
    let OpenedDirectory {
        directory,
        parents,
        parent_paths,
    } = open_directory(root, path)?;
    let before = directory_identity(&directory.metadata()?);
    let mut members = read_members(&directory, path)?;
    let after = directory_identity(&directory.metadata()?);
    if before != after {
        return Err(SourceError::Changed(path.0.clone()));
    }
    members.sort_by(|a, b| a.name.encode_utf16().cmp(b.name.encode_utf16()));
    Ok(DirectorySnapshot {
        path: path.clone(),
        identity: after,
        parents,
        parent_paths,
        members,
    })
}
/// Enumerates the selected directory twice through no-follow directory handles.
/// This is a phase-local observation, not a cross-file atomic snapshot.
#[cfg(target_os = "linux")]
pub fn enumerate_directory(
    root: &Root,
    path: &RelativePath,
) -> Result<DirectorySnapshot, SourceError> {
    if directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    let first = enumerate_once(root, path)?;
    let second = enumerate_once(root, path)?;
    if first != second || directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(second)
}
