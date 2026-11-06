//! Conditional file creation, update handles, and removal.
use super::*;

/// Open an existing file for update after independently checking both the
/// phase snapshot and the identity/bytes of the actual write handle. The caller
/// must hold the collection lock and still perform independent postverify.
/// This does not provide atomic isolation from non-cooperating writers.
pub(crate) fn open_verified_for_update(
    root: &Root,
    expected: &SourceSnapshot,
) -> Result<File, SourceError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    match capture(root, &expected.path)? {
        ExpectedFile::Present(current) if current == *expected => {}
        _ => return Err(SourceError::Changed(expected.path.0.clone())),
    }
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let resolved = resolve_directory_links(root, &expected.path, true)?;
    let mut options = cap_std::fs::OpenOptions::new();
    options.read(true).write(true).follow(FollowSymlinks::No);
    let mut file = capability
        .open_with(resolved.as_path(), &options)?
        .into_std();
    verify_update_handle(&mut file, expected)?;
    Ok(file)
}

// Compare the opened handle before and after reading, then restore its write position.
fn verify_update_handle(file: &mut File, expected: &SourceSnapshot) -> Result<(), SourceError> {
    use std::io::{Read, Seek, SeekFrom};
    if identity_from_handle(file)? != expected.identity {
        return Err(SourceError::Changed(expected.path.0.clone()));
    }
    let mut bytes = Vec::new();
    (&mut *file)
        .take(expected.bytes.len() as u64 + 1)
        .read_to_end(&mut bytes)?;
    if bytes != expected.bytes || identity_from_handle(file)? != expected.identity {
        return Err(SourceError::Changed(expected.path.0.clone()));
    }
    file.seek(SeekFrom::Start(0))?;
    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CreateMode {
    Native(u32),
    Exact(u32),
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CreateEffect {
    NotStarted,
    Unknown,
}
#[derive(Debug)]
pub(crate) struct CreateFailure {
    pub error: SourceError,
    pub effect: CreateEffect,
}
#[derive(Debug)]
pub(crate) struct CreatedFile {
    pub file: File,
    pub identity: FileIdentity,
}

/// Revalidate the root and parent identities, then create exclusively relative
/// to the retained parent handle. Once created, all failures report Unknown;
/// the caller owns journaling and independent verification/recovery.
pub(crate) fn create_exclusive(
    root: &Root,
    proof: &MissingProof,
    mode: CreateMode,
) -> Result<CreatedFile, CreateFailure> {
    let fail = |error| CreateFailure {
        error,
        effect: CreateEffect::NotStarted,
    };
    proof.validate_creation_parent(root).map_err(fail)?;
    let name = proof
        .path
        .as_path()
        .file_name()
        .ok_or_else(|| fail(SourceError::InvalidPath(proof.path.0.clone())))?;
    let options = create_file_options(&proof.path, mode).map_err(fail)?;
    let file = match proof.parent.open_with(name, &options) {
        Ok(file) => file.into_std(),
        Err(error) => {
            return Err(CreateFailure {
                effect: if error.kind() == io::ErrorKind::AlreadyExists {
                    CreateEffect::NotStarted
                } else {
                    CreateEffect::Unknown
                },
                error: error.into(),
            });
        }
    };
    #[cfg(unix)]
    if let CreateMode::Exact(bits) = mode {
        use std::os::unix::fs::PermissionsExt;
        if let Err(error) = file.set_permissions(std::fs::Permissions::from_mode(bits)) {
            return Err(CreateFailure {
                error: error.into(),
                effect: CreateEffect::Unknown,
            });
        }
    }
    let identity = identity_from_handle(&file).map_err(|error| CreateFailure {
        error,
        effect: CreateEffect::Unknown,
    })?;
    Ok(CreatedFile { file, identity })
}

// Validate representation and build no-follow exclusive options before the syscall.
fn create_file_options(
    path: &RelativePath,
    mode: CreateMode,
) -> Result<cap_std::fs::OpenOptions, SourceError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    let requested = match mode {
        CreateMode::Native(bits) | CreateMode::Exact(bits) => bits,
    };
    #[cfg(unix)]
    if requested > 0o7777 {
        return Err(SourceError::Unsafe(path.0.clone()));
    }
    let mut options = cap_std::fs::OpenOptions::new();
    options
        .read(true)
        .write(true)
        .create_new(true)
        .follow(FollowSymlinks::No);
    #[cfg(unix)]
    {
        use cap_fs_ext::OpenOptionsExt;
        options.mode(requested);
    }
    Ok(options)
}

/// Apply and verify the final representation on the actual created handle
/// after bytes have been written. A failure occurs after creation and therefore
/// must be journaled as an unknown/partially completed write.
pub(crate) fn finalize_created_mode(
    file: &File,
    mode: CreateMode,
) -> Result<FileIdentity, SourceError> {
    #[cfg(unix)]
    if let CreateMode::Exact(bits) = mode {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(bits))?;
    }
    let identity = identity_from_handle(file)?;
    #[cfg(unix)]
    if let CreateMode::Exact(bits) = mode
        && identity.mode & 0o7777 != bits
    {
        return Err(SourceError::Changed(PathBuf::from("file mode")));
    }
    Ok(identity)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RemoveEffect {
    NotStarted,
    Unknown,
}
#[derive(Debug)]
pub(crate) struct RemoveFailure {
    pub error: SourceError,
    pub effect: RemoveEffect,
}
/// Remove a selected regular file only after recapturing the exact phase
/// snapshot. Caller must hold the collection lock; independent postverify and
/// recovery remain transaction responsibilities. As on the existing runtime,
/// an unrelated non-cooperative editor is not atomically isolated.
pub(crate) fn remove_if_matches(
    root: &Root,
    expected: &SourceSnapshot,
) -> Result<(), RemoveFailure> {
    let fail = |error| RemoveFailure {
        error,
        effect: RemoveEffect::NotStarted,
    };
    match capture(root, &expected.path).map_err(fail)? {
        ExpectedFile::Present(current) if current == *expected => {}
        _ => return Err(fail(SourceError::Changed(expected.path.0.clone()))),
    }
    let resolved = resolve_directory_links(root, &expected.path, true).map_err(fail)?;
    let capability =
        cap_std::fs::Dir::from_std_file(root.directory.try_clone().map_err(|e| fail(e.into()))?);
    if let Err(error) = capability.remove_file(resolved.as_path()) {
        return Err(RemoveFailure {
            error: error.into(),
            effect: RemoveEffect::Unknown,
        });
    }
    match capture(root, &expected.path) {
        Ok(ExpectedFile::Missing) => Ok(()),
        Ok(ExpectedFile::Present(_)) => Err(RemoveFailure {
            error: SourceError::Changed(expected.path.0.clone()),
            effect: RemoveEffect::Unknown,
        }),
        Err(error) => Err(RemoveFailure {
            error,
            effect: RemoveEffect::Unknown,
        }),
    }
}
