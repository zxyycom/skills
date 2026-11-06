//! Platform-specific handle-relative no-replace directory move.
use super::*;

#[cfg(target_os = "linux")]
pub(super) fn platform_open_source(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
) -> Result<File, SourceError> {
    use std::{
        ffi::CString,
        os::{
            fd::{AsRawFd, FromRawFd},
            unix::ffi::OsStrExt,
        },
    };
    let name = CString::new(name.as_bytes()).map_err(|_| SourceError::InvalidPath(name.into()))?;
    // SAFETY: parent descriptor is live and the name is a NUL-terminated single component.
    let fd = unsafe {
        libc::openat(
            parent.as_raw_fd(),
            name.as_ptr(),
            libc::O_PATH | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
        )
    };
    if fd < 0 {
        return Err(io::Error::last_os_error().into());
    }
    // SAFETY: openat returned a newly owned descriptor.
    Ok(unsafe { File::from_raw_fd(fd) })
}
#[cfg(target_os = "linux")]
pub(super) fn platform_rename(
    parent: &cap_std::fs::Dir,
    _held: &File,
    from: &std::ffi::OsStr,
    to: &std::ffi::OsStr,
) -> Result<(), SourceError> {
    use std::{
        ffi::CString,
        os::{fd::AsRawFd, unix::ffi::OsStrExt},
    };
    let from = CString::new(from.as_bytes()).map_err(|_| SourceError::InvalidPath(from.into()))?;
    let to = CString::new(to.as_bytes()).map_err(|_| SourceError::InvalidPath(to.into()))?;
    // SAFETY: both names are single NUL-terminated components relative to the live parent.
    let result = unsafe {
        libc::renameat2(
            parent.as_raw_fd(),
            from.as_ptr(),
            parent.as_raw_fd(),
            to.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };
    if result != 0 {
        return Err(io::Error::last_os_error().into());
    }
    Ok(())
}
#[cfg(windows)]
pub(super) fn platform_open_source(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
) -> Result<File, SourceError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    use cap_std::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        DELETE, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
        FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };
    let mut options = cap_std::fs::OpenOptions::new();
    options
        .read(true)
        .access_mode(DELETE | FILE_READ_ATTRIBUTES)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
        .follow(FollowSymlinks::No);
    let file = parent.open_with(name, &options)?.into_std();
    use std::os::windows::fs::MetadataExt;
    let meta = file.metadata()?;
    if !meta.is_dir()
        || meta.file_attributes()
            & windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT
            != 0
    {
        return Err(SourceError::Unsafe(name.into()));
    }
    Ok(file)
}
#[cfg(windows)]
pub(super) fn platform_rename(
    parent: &cap_std::fs::Dir,
    held: &File,
    _from: &std::ffi::OsStr,
    to: &std::ffi::OsStr,
) -> Result<(), SourceError> {
    use std::os::windows::{ffi::OsStrExt, io::AsRawHandle};
    use windows_sys::Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{FILE_RENAME_INFO, FileRenameInfo, SetFileInformationByHandle},
    };
    let name: Vec<u16> = to.encode_wide().collect();
    let offset = std::mem::offset_of!(FILE_RENAME_INFO, FileName);
    let len = offset
        .checked_add(
            name.len()
                .checked_mul(2)
                .ok_or_else(|| SourceError::InvalidPath(to.into()))?,
        )
        .ok_or_else(|| SourceError::InvalidPath(to.into()))?;
    let len = len.max(std::mem::size_of::<FILE_RENAME_INFO>());
    let size = u32::try_from(len).map_err(|_| SourceError::InvalidPath(to.into()))?;
    // usize storage supplies the alignment required by FILE_RENAME_INFO.
    let mut storage = vec![0usize; len.div_ceil(std::mem::size_of::<usize>()).max(1)];
    let info = storage.as_mut_ptr().cast::<FILE_RENAME_INFO>();
    // SAFETY: storage is aligned, zero-initialized and large enough for the header
    // and UTF-16 name. RootDirectory and held source are live capability handles.
    unsafe {
        (*info).Anonymous.ReplaceIfExists = false;
        (*info).RootDirectory = parent.as_raw_handle() as HANDLE;
        (*info).FileNameLength = (name.len() * 2) as u32;
        std::ptr::copy_nonoverlapping(
            name.as_ptr(),
            storage.as_mut_ptr().cast::<u8>().add(offset).cast::<u16>(),
            name.len(),
        );
        if SetFileInformationByHandle(
            held.as_raw_handle() as HANDLE,
            FileRenameInfo,
            info.cast(),
            size,
        ) == 0
        {
            return Err(io::Error::last_os_error().into());
        }
    }
    Ok(())
}
