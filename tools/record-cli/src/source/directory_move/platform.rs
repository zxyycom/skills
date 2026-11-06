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
) -> Result<(), MoveDirectoryFailure> {
    use std::{
        ffi::CString,
        os::{fd::AsRawFd, unix::ffi::OsStrExt},
    };
    let from = CString::new(from.as_bytes()).map_err(|_| {
        fail(
            SourceError::InvalidPath(from.into()),
            MoveDirectoryEffect::NotStarted,
        )
    })?;
    let to = CString::new(to.as_bytes()).map_err(|_| {
        fail(
            SourceError::InvalidPath(to.into()),
            MoveDirectoryEffect::NotStarted,
        )
    })?;
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
        return Err(syscall_failure(io::Error::last_os_error().into()));
    }
    Ok(())
}

// Construct the aligned, no-replace NT rename request for the held parent.
