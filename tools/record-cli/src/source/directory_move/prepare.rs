//! Bind move baseline, sibling namespace, and source handle before the syscall.
use super::*;

// Retain both the parent capability and opened source until the no-replace syscall.
pub(super) struct PreparedMove<'a> {
    pub(super) parent: cap_std::fs::Dir,
    pub(super) held: File,
    pub(super) source_name: &'a std::ffi::OsStr,
    pub(super) target_name: &'a std::ffi::OsStr,
    pub(super) fresh: TreeSnapshot,
    pub(super) initial_id: FileIdentity,
}
pub(super) fn prepare_move<'a>(
    root: &Root,
    expected: &'a TreeSnapshot,
    destination: &'a MissingProof,
) -> Result<PreparedMove<'a>, MoveDirectoryFailure> {
    let source = &expected.root;
    let target = &destination.path;
    let fresh = validate_baseline(root, expected, destination)?;
    let MoveParent {
        parent,
        source_name,
        target_name,
    } = prepare_move_parent(root, source, destination)?;
    verify_pre_rename(root, source, target, &fresh, destination)?;
    let BoundSource {
        handle: held,
        identity: initial_id,
    } = open_bound_source(&parent, source_name, source, &fresh)?;
    Ok(PreparedMove {
        parent,
        held,
        source_name,
        target_name,
        fresh,
        initial_id,
    })
}
// The retained parent and exact sibling names are bound to the missing proof.
struct MoveParent<'a> {
    parent: cap_std::fs::Dir,
    source_name: &'a std::ffi::OsStr,
    target_name: &'a std::ffi::OsStr,
}
fn prepare_move_parent<'a>(
    root: &Root,
    source: &'a RelativePath,
    destination: &'a MissingProof,
) -> Result<MoveParent<'a>, MoveDirectoryFailure> {
    let not_started = |e| fail(e, MoveDirectoryEffect::NotStarted);
    let target = &destination.path;
    let (parent, parents) = parent_chain(root, source).map_err(not_started)?;
    if parents != destination.parents {
        return Err(not_started(changed(source)));
    }
    let source_name = source
        .0
        .file_name()
        .ok_or_else(|| not_started(changed(source)))?;
    let target_name = target
        .0
        .file_name()
        .ok_or_else(|| not_started(changed(target)))?;
    ensure_no_alias(&parent, target_name, target).map_err(not_started)?;
    Ok(MoveParent {
        parent,
        source_name,
        target_name,
    })
}
// Last independent source and destination observations before the syscall.
fn verify_pre_rename(
    root: &Root,
    source: &RelativePath,
    target: &RelativePath,
    fresh: &TreeSnapshot,
    destination: &MissingProof,
) -> Result<(), MoveDirectoryFailure> {
    let not_started = |e| fail(e, MoveDirectoryEffect::NotStarted);
    // Last independent source and parent observation before the syscall.
    let last = capture_tree(root, source).map_err(not_started)?;
    if !same_tree(fresh, &last)
        || !destination.equivalent(&capture_missing(root, target).map_err(not_started)?)
    {
        return Err(not_started(changed(source)));
    }
    Ok(())
}
// Bind a retained source handle to the independently observed tree root.
struct BoundSource {
    handle: File,
    identity: FileIdentity,
}
fn open_bound_source(
    parent: &cap_std::fs::Dir,
    source_name: &std::ffi::OsStr,
    source: &RelativePath,
    fresh: &TreeSnapshot,
) -> Result<BoundSource, MoveDirectoryFailure> {
    let not_started = |e| fail(e, MoveDirectoryEffect::NotStarted);
    let held = platform_open_source(parent, source_name).map_err(not_started)?;
    let mut held_id = identity_from_handle(&held).map_err(not_started)?;
    held_id.size = 0;
    let TreeEntry::Directory {
        identity: initial_id,
        ..
    } = &fresh.entries[0]
    else {
        return Err(not_started(changed(source)));
    };
    if &held_id != initial_id {
        return Err(not_started(changed(source)));
    }
    Ok(BoundSource {
        handle: held,
        identity: initial_id.clone(),
    })
}
// Reject a changed tree or missing namespace before opening the syscall capability.
fn validate_baseline(
    root: &Root,
    expected: &TreeSnapshot,
    destination: &MissingProof,
) -> Result<TreeSnapshot, MoveDirectoryFailure> {
    let not_started = |e| fail(e, MoveDirectoryEffect::NotStarted);
    let source = &expected.root;
    let target = &destination.path;
    validate_move_scope(root, expected, destination)?;
    let fresh_missing = capture_missing(root, target).map_err(not_started)?;
    if !destination.equivalent(&fresh_missing) {
        return Err(not_started(changed(target)));
    }
    let fresh = capture_tree(root, source).map_err(not_started)?;
    if !same_tree(expected, &fresh) {
        return Err(not_started(changed(source)));
    }
    Ok(fresh)
}
// A move is confined to distinct siblings under the same retained workspace.
fn validate_move_scope(
    root: &Root,
    expected: &TreeSnapshot,
    destination: &MissingProof,
) -> Result<(), MoveDirectoryFailure> {
    let not_started = |e| fail(e, MoveDirectoryEffect::NotStarted);
    let source = &expected.root;
    let target = &destination.path;
    if !expected.belongs_to(root, source)
        || destination.workspace != root.path
        || destination.workspace_identity != root.identity
        || source.0.parent() != target.0.parent()
        || source == target
        || destination.remaining.len() != 1
    {
        return Err(not_started(changed(target)));
    }
    Ok(())
}
