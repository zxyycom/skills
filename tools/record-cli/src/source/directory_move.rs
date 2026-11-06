//! Same-parent, no-replace owner-directory moves and conditional recovery.
use super::*;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum MoveDirectoryEffect {
    NotStarted,
    Unknown,
}
#[derive(Debug)]
pub(crate) struct MoveDirectoryFailure {
    pub error: SourceError,
    pub effect: MoveDirectoryEffect,
}
#[derive(Debug)]
pub(crate) struct MovedDirectory {
    original: RelativePath,
    destination: RelativePath,
    tree: TreeSnapshot,
    parents: Vec<FileIdentity>,
    parent_paths: Vec<RelativePath>,
}
fn fail(error: SourceError, effect: MoveDirectoryEffect) -> MoveDirectoryFailure {
    MoveDirectoryFailure { error, effect }
}
fn changed(path: &RelativePath) -> SourceError {
    SourceError::Changed(path.0.clone())
}
fn same_tree(a: &TreeSnapshot, b: &TreeSnapshot) -> bool {
    a.entries.len() == b.entries.len()
        && a.entries
            .iter()
            .zip(&b.entries)
            .all(|(a_entry, b_entry)| match (a_entry, b_entry) {
                (
                    TreeEntry::Directory {
                        path: ap,
                        identity: ai,
                    },
                    TreeEntry::Directory {
                        path: bp,
                        identity: bi,
                    },
                ) => {
                    ap.0.strip_prefix(&a.root.0).ok() == bp.0.strip_prefix(&b.root.0).ok()
                        && ai == bi
                }
                (
                    TreeEntry::File {
                        path: ap,
                        identity: ai,
                        bytes: ab,
                    },
                    TreeEntry::File {
                        path: bp,
                        identity: bi,
                        bytes: bb,
                    },
                ) => {
                    ap.0.strip_prefix(&a.root.0).ok() == bp.0.strip_prefix(&b.root.0).ok()
                        && ai == bi
                        && ab == bb
                }
                _ => false,
            })
}
fn ensure_no_alias(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<(), SourceError> {
    let wanted = name
        .to_str()
        .ok_or_else(|| SourceError::InvalidPath(path.0.clone()))?;
    for entry in parent.entries()? {
        let candidate = entry?.file_name();
        if candidate
            .to_str()
            .is_some_and(|s| s.to_lowercase() == wanted.to_lowercase())
        {
            return Err(changed(path));
        }
    }
    Ok(())
}
#[cfg(test)]
type RenameHook = std::cell::RefCell<Option<Box<dyn FnOnce()>>>;
#[cfg(test)]
thread_local! {
    static BEFORE_RENAME: RenameHook = std::cell::RefCell::new(None);
    static AFTER_RENAME: RenameHook = std::cell::RefCell::new(None);
}
#[cfg(test)]
fn run_hook(hook: &'static std::thread::LocalKey<RenameHook>) {
    if let Some(callback) = hook.with(|slot| slot.borrow_mut().take()) {
        callback();
    }
}
#[cfg(test)]
pub(crate) fn set_move_before_test_hook(hook: impl FnOnce() + 'static) {
    BEFORE_RENAME.with(|slot| *slot.borrow_mut() = Some(Box::new(hook)));
}
#[cfg(test)]
pub(crate) fn set_move_after_test_hook(hook: impl FnOnce() + 'static) {
    AFTER_RENAME.with(|slot| *slot.borrow_mut() = Some(Box::new(hook)));
}
#[cfg(target_os = "linux")]
fn syscall_failure(error: SourceError) -> MoveDirectoryFailure {
    let collision = match &error {
        #[cfg(target_os = "linux")]
        SourceError::Io(e) => e.raw_os_error() == Some(libc::EEXIST),
        _ => false,
    };
    fail(
        error,
        if collision {
            MoveDirectoryEffect::NotStarted
        } else {
            MoveDirectoryEffect::Unknown
        },
    )
}
mod prepare;
use prepare::{PreparedMove, prepare_move};

/// Rechecks the full captured tree and missing proof, then uses the held parent
/// capability. The syscall cannot atomically compare a Linux source name with
/// its held object; any mismatch on independent readback is therefore Unknown.
pub(crate) fn move_directory(
    root: &Root,
    expected: &TreeSnapshot,
    destination: &MissingProof,
) -> Result<MovedDirectory, MoveDirectoryFailure> {
    let prepared = prepare_move(root, expected, destination)?;
    #[cfg(test)]
    run_hook(&BEFORE_RENAME);
    platform_rename(
        &prepared.parent,
        &prepared.held,
        prepared.source_name,
        prepared.target_name,
    )?;
    #[cfg(test)]
    run_hook(&AFTER_RENAME);
    verify_moved(root, expected, destination, prepared)
}
// A successful syscall is still unknown until its handle, both names and tree are re-read.
fn verify_moved(
    root: &Root,
    expected: &TreeSnapshot,
    destination: &MissingProof,
    prepared: PreparedMove<'_>,
) -> Result<MovedDirectory, MoveDirectoryFailure> {
    let PreparedMove {
        parent: _parent,
        held,
        fresh,
        initial_id,
        ..
    } = prepared;
    let source = &expected.root;
    let target = &destination.path;
    let unknown = |e| fail(e, MoveDirectoryEffect::Unknown);
    let mut after_id = identity_from_handle(&held).map_err(unknown)?;
    after_id.size = 0;
    drop(held);
    if after_id != initial_id {
        return Err(unknown(changed(target)));
    }
    let old_missing = verify_original_absence(root, source, destination)?;
    let moved = capture_tree(root, target).map_err(unknown)?;
    let final_missing = capture_missing(root, source).map_err(unknown)?;
    let (_, final_parents) = parent_chain(root, target).map_err(unknown)?;
    if !same_tree(&fresh, &moved)
        || !old_missing.equivalent(&final_missing)
        || final_parents != destination.parents
    {
        return Err(unknown(changed(target)));
    }
    Ok(MovedDirectory {
        original: source.clone(),
        destination: target.clone(),
        tree: moved,
        parents: destination.parents.clone(),
        parent_paths: destination.parent_paths.clone(),
    })
}
// A successful move needs an absent original under the previously proven parent chain.
fn verify_original_absence(
    root: &Root,
    source: &RelativePath,
    destination: &MissingProof,
) -> Result<MissingProof, MoveDirectoryFailure> {
    let unknown = |e| fail(e, MoveDirectoryEffect::Unknown);
    let old_missing = capture_missing(root, source).map_err(unknown)?;
    if old_missing.parents != destination.parents
        || old_missing.parent_paths != destination.parent_paths
        || old_missing.remaining.len() != 1
    {
        return Err(unknown(changed(source)));
    }
    Ok(old_missing)
}
impl MovedDirectory {
    /// Inverse move is allowed only while the moved tree is still identical,
    /// the original name is missing, and the original parent chain is intact.
    pub(crate) fn restore(&self, root: &Root) -> Result<MovedDirectory, MoveDirectoryFailure> {
        let proof = capture_missing(root, &self.original)
            .map_err(|e| fail(e, MoveDirectoryEffect::NotStarted))?;
        if proof.parents != self.parents
            || proof.parent_paths != self.parent_paths
            || proof.remaining.len() != 1
        {
            return Err(fail(
                changed(&self.original),
                MoveDirectoryEffect::NotStarted,
            ));
        }
        if self.tree.root != self.destination {
            return Err(fail(
                changed(&self.destination),
                MoveDirectoryEffect::NotStarted,
            ));
        }
        move_directory(root, &self.tree, &proof)
    }
}
mod platform;
use platform::{platform_open_source, platform_rename};

#[cfg(test)]
mod tests;
