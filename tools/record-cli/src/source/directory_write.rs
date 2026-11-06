//! Exclusive directory creation and conditional removal.
use super::*;

pub(super) fn reject_final_link(root: &Root, path: &RelativePath) -> Result<(), SourceError> {
    let resolved = resolve_directory_links(root, path, true)?;
    let directory = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let metadata = directory.symlink_metadata(resolved.as_path())?;
    if metadata.file_type().is_symlink() {
        return Err(SourceError::Unsafe(path.0.clone()));
    }
    Ok(())
}
#[derive(Debug)]
pub(crate) struct CreatedDirectory {
    pub handle: File,
    pub identity: FileIdentity,
}
#[cfg(test)]
thread_local! { static MKDIR_TEST_HOOK: std::cell::RefCell<Option<Box<dyn FnOnce()>>> = std::cell::RefCell::new(None); }
/// Install one deterministic thread-local barrier after the next mkdir syscall.
#[cfg(test)]
pub(crate) fn set_mkdir_test_hook(hook: impl FnOnce() + 'static) {
    MKDIR_TEST_HOOK.with(|slot| *slot.borrow_mut() = Some(Box::new(hook)));
}
/// Create one absent directory relative to the held parent without recursively
/// creating ancestors. Exact mode is observed, never applied to an unproven handle.
pub(crate) fn create_directory_exclusive(
    root: &Root,
    proof: &MissingProof,
    mode: CreateMode,
) -> Result<CreatedDirectory, CreateFailure> {
    #[cfg(test)]
    {
        create_directory_exclusive_inner(root, proof, mode, || {
            let hook = MKDIR_TEST_HOOK.with(|slot| slot.borrow_mut().take());
            if let Some(hook) = hook {
                hook();
            }
        })
    }
    #[cfg(not(test))]
    {
        create_directory_exclusive_inner(root, proof, mode, || {})
    }
}
fn create_directory_exclusive_inner<F: FnOnce()>(
    root: &Root,
    proof: &MissingProof,
    mode: CreateMode,
    after_mkdir: F,
) -> Result<CreatedDirectory, CreateFailure> {
    let fail = |error| CreateFailure {
        error,
        effect: CreateEffect::NotStarted,
    };
    proof.validate_creation_parent(root).map_err(fail)?;
    let builder = directory_builder(&proof.path, mode).map_err(fail)?;
    let name = proof
        .path
        .as_path()
        .file_name()
        .ok_or_else(|| fail(SourceError::InvalidPath(proof.path.0.clone())))?;
    if let Err(error) = proof.parent.create_dir_with(name, &builder) {
        return Err(CreateFailure {
            effect: if error.kind() == io::ErrorKind::AlreadyExists {
                CreateEffect::NotStarted
            } else {
                CreateEffect::Unknown
            },
            error: error.into(),
        });
    }
    after_mkdir();
    observe_created_directory(proof, name, mode)
}
// Validate representable directory mode before attempting exclusive mkdir.
fn directory_builder(
    path: &RelativePath,
    mode: CreateMode,
) -> Result<cap_std::fs::DirBuilder, SourceError> {
    let bits = match mode {
        CreateMode::Native(bits) | CreateMode::Exact(bits) => bits,
    };
    #[cfg(unix)]
    if bits > 0o7777 {
        return Err(SourceError::Unsafe(path.0.clone()));
    }
    #[cfg(unix)]
    let builder = {
        use cap_std::fs::DirBuilderExt;
        let mut builder = cap_std::fs::DirBuilder::new();
        builder.mode(bits);
        builder
    };
    Ok(builder)
}
// A post-mkdir open is only an observation, not proof of ownership.
fn observe_created_directory(
    proof: &MissingProof,
    name: &std::ffi::OsStr,
    mode: CreateMode,
) -> Result<CreatedDirectory, CreateFailure> {
    let unknown = |error| CreateFailure {
        error,
        effect: CreateEffect::Unknown,
    };
    let directory = proof.parent.open_dir(name).map_err(|e| unknown(e.into()))?;
    // mkdir does not atomically return a directory handle. This is only the
    // subsequently observed object; never chmod it as if ownership were proven.
    let handle = directory.into_std_file();
    let identity = identity_from_handle(&handle).map_err(unknown)?;
    #[cfg(unix)]
    if let CreateMode::Exact(bits) = mode
        && identity.mode & 0o7777 != bits
    {
        return Err(unknown(SourceError::Changed(proof.path.0.clone())));
    }
    Ok(CreatedDirectory { handle, identity })
}
/// Conditional directory deletion never recursively removes members. Only an
/// unchanged, empty, non-link directory can be passed to the actual syscall.
pub(crate) fn remove_empty_directory(
    root: &Root,
    expected: &DirectorySnapshot,
) -> Result<(), RemoveFailure> {
    let fail = |error| RemoveFailure {
        error,
        effect: RemoveEffect::NotStarted,
    };
    if !expected.members.is_empty() {
        return Err(fail(SourceError::Unsafe(expected.path.0.clone())));
    }
    reject_final_link(root, &expected.path).map_err(fail)?;
    let actual = enumerate_directory(root, &expected.path).map_err(fail)?;
    if actual != *expected {
        return Err(fail(SourceError::Changed(expected.path.0.clone())));
    }
    let resolved = resolve_directory_links(root, &expected.path, true).map_err(fail)?;
    let capability =
        cap_std::fs::Dir::from_std_file(root.directory.try_clone().map_err(|e| fail(e.into()))?);
    if let Err(error) = capability.remove_dir(resolved.as_path()) {
        return Err(RemoveFailure {
            error: error.into(),
            effect: RemoveEffect::Unknown,
        });
    }
    confirm_directory_removed(&capability, resolved.as_path(), &expected.path)
}

// A successful remove syscall remains unknown if a name reappears or cannot be checked.
fn confirm_directory_removed(
    capability: &cap_std::fs::Dir,
    resolved: &Path,
    expected_path: &RelativePath,
) -> Result<(), RemoveFailure> {
    match capability.symlink_metadata(resolved) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Ok(_) => Err(RemoveFailure {
            error: SourceError::Changed(expected_path.0.clone()),
            effect: RemoveEffect::Unknown,
        }),
        Err(error) => Err(RemoveFailure {
            error: error.into(),
            effect: RemoveEffect::Unknown,
        }),
    }
}
