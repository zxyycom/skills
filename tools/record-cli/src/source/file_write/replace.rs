//! Atomic replacement and temporary-file lifecycle.
use super::*;

#[derive(Debug)]
pub(crate) struct ReplaceFailure {
    pub error: SourceError,
    pub unknown: bool,
    pub cleanup: Option<(PathBuf, String)>,
}

#[cfg(test)]
thread_local! { static FAIL_AFTER_REPLACE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
#[cfg(test)]
pub(crate) fn fail_after_replace_for_test() {
    FAIL_AFTER_REPLACE.with(|slot| slot.set(true));
}

#[cfg(test)]
thread_local! {
    static FAIL_TEMP_IDENTITY: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    static FAIL_TEMP_WRITE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    static FAIL_TEMP_CLEANUP: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}
#[cfg(test)]
pub(crate) fn fail_temp_identity_for_test() {
    FAIL_TEMP_IDENTITY.with(|slot| slot.set(true));
}
#[cfg(test)]
pub(crate) fn fail_temp_cleanup_for_test() {
    FAIL_TEMP_WRITE.with(|slot| slot.set(true));
    FAIL_TEMP_CLEANUP.with(|slot| slot.set(true));
}

/// Replace a regular file after preparing complete bytes in its own directory.
/// The final comparison and rename are not a CAS against non-cooperative writers.
pub(crate) fn replace_if_matches(
    root: &Root,
    expected: &SourceSnapshot,
    bytes: &[u8],
) -> Result<(), ReplaceFailure> {
    let mut rename_attempted = false;
    let mut cleanup = None;
    replace_inner(root, expected, bytes, &mut rename_attempted, &mut cleanup).map_err(|error| {
        ReplaceFailure {
            error,
            unknown: rename_attempted,
            cleanup,
        }
    })
}

fn replace_inner(
    root: &Root,
    expected: &SourceSnapshot,
    bytes: &[u8],
    rename_attempted: &mut bool,
    cleanup: &mut Option<(PathBuf, String)>,
) -> Result<(), SourceError> {
    let (parent, resolved) = replacement_parent(root, expected)?;
    let target = resolved
        .as_path()
        .file_name()
        .ok_or_else(|| SourceError::InvalidPath(expected.path.0.clone()))?;
    let mode = expected.identity.mode & 0o7777;
    if mode & 0o222 == 0 {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "read-only target").into());
    }
    let (name, mut temp) = create_temp(&parent)?;
    let temp_path = root
        .path
        .join(resolved.as_path().parent().unwrap_or(Path::new("")))
        .join(&name);
    let temp_identity = temporary_identity(&temp).inspect_err(|_| {
        *cleanup = Some((
            temp_path.clone(),
            "temporary identity unavailable; entry retained".into(),
        ));
    })?;
    let result = Replacement {
        root,
        expected,
        parent: &parent,
        name: &name,
        target,
        mode,
        rename_attempted,
    }
    .publish(&mut temp, bytes);
    if result.is_err()
        && let Err(error) = cleanup_temp(&parent, &name, &temp_identity)
    {
        *cleanup = Some((temp_path, error));
    }
    result
}

fn replacement_parent(
    root: &Root,
    expected: &SourceSnapshot,
) -> Result<(cap_std::fs::Dir, RelativePath), SourceError> {
    let resolved = resolve_directory_links(root, &expected.path, true)?;
    let directory = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let parent = match resolved
        .as_path()
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
    {
        Some(path) => directory.open_dir(path)?,
        None => directory.try_clone()?,
    };
    Ok((parent, resolved))
}
fn temporary_identity(temp: &File) -> Result<FileIdentity, SourceError> {
    #[cfg(test)]
    let identity_result = if FAIL_TEMP_IDENTITY.with(|slot| slot.replace(false)) {
        Err(SourceError::Io(io::Error::other(
            "injected temporary identity failure",
        )))
    } else {
        identity_from_handle(temp)
    };
    #[cfg(not(test))]
    let identity_result = identity_from_handle(temp);
    identity_result
}

fn create_temp(parent: &cap_std::fs::Dir) -> Result<(String, File), SourceError> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    loop {
        let name = format!(
            ".record-cli-{}-{}.tmp",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        );
        let mut options = cap_std::fs::OpenOptions::new();
        options.write(true).read(true).create_new(true);
        #[cfg(unix)]
        {
            use cap_fs_ext::OpenOptionsExt;
            options.mode(0o600);
        }
        match parent.open_with(&name, &options) {
            Ok(file) => return Ok((name, file.into_std())),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
}

struct Replacement<'a> {
    root: &'a Root,
    expected: &'a SourceSnapshot,
    parent: &'a cap_std::fs::Dir,
    name: &'a str,
    target: &'a std::ffi::OsStr,
    mode: u32,
    rename_attempted: &'a mut bool,
}
impl Replacement<'_> {
    fn publish(self, temp: &mut File, bytes: &[u8]) -> Result<(), SourceError> {
        let Self {
            root,
            expected,
            parent,
            name,
            target,
            mode,
            rename_attempted,
        } = self;

        write_temp(temp, bytes, mode)?;
        let ExpectedFile::Present(current) = capture(root, &expected.path)? else {
            return Err(SourceError::Changed(expected.path.0.clone()));
        };
        let held = directory_identity(&parent.try_clone()?.into_std_file().metadata()?);
        if !same_content_and_mode(&current, expected)
            || !current
                .parents
                .last()
                .is_some_and(|last| held.device == last.device && held.inode == last.inode)
        {
            return Err(SourceError::Changed(expected.path.0.clone()));
        }
        *rename_attempted = true;
        parent.rename(name, parent, target)?;
        #[cfg(test)]
        if FAIL_AFTER_REPLACE.with(|slot| slot.replace(false)) {
            return Err(io::Error::other("injected post-rename failure").into());
        }
        Ok(())
    }
}

fn write_temp(temp: &mut File, bytes: &[u8], mode: u32) -> Result<(), SourceError> {
    use std::io::Write;
    #[cfg(test)]
    if FAIL_TEMP_WRITE.with(|slot| slot.replace(false)) {
        return Err(io::Error::other("injected temporary write failure").into());
    }
    temp.write_all(bytes)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        temp.set_permissions(std::fs::Permissions::from_mode(mode))?;
    }
    temp.sync_all()?;
    Ok(())
}

fn cleanup_temp(
    parent: &cap_std::fs::Dir,
    name: &str,
    temp_identity: &FileIdentity,
) -> Result<(), String> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    let mut options = cap_std::fs::OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    match parent.open_with(name, &options) {
        Ok(file) => match identity_from_handle(&file.into_std()) {
            Ok(current)
                if current.device == temp_identity.device
                    && current.inode == temp_identity.inode =>
            {
                #[cfg(test)]
                let remove_result = if FAIL_TEMP_CLEANUP.with(|slot| slot.replace(false)) {
                    Err(io::Error::other("injected temporary cleanup failure"))
                } else {
                    parent.remove_file(name)
                };
                #[cfg(not(test))]
                let remove_result = parent.remove_file(name);
                remove_result.map_err(|e| e.to_string())
            }
            Ok(_) => Err("temporary entry changed; retained".into()),
            Err(error) => Err(error.to_string()),
        },
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}
