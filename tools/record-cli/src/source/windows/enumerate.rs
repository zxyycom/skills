//! Windows exact-name directory enumeration and member observations.
use super::*;

fn enumerate_once(root: &Root, path: &RelativePath) -> Result<DirectorySnapshot, SourceError> {
    let ObservedDirectory {
        handle,
        mut snapshot,
    } = open_directory_for_observation(root, path)?;
    snapshot.members = enumerate_members(&handle, path)?;
    Ok(snapshot)
}
// Retain the directory handle and its exact-name/parent-chain observation together.
struct ObservedDirectory {
    handle: Dir,
    snapshot: DirectorySnapshot,
}
fn open_directory_for_observation(
    root: &Root,
    path: &RelativePath,
) -> Result<ObservedDirectory, SourceError> {
    let resolved = resolve_directory_links(root, path, false)?;
    let (parent, mut identities, mut parent_paths) = parent_facts(root, &resolved)?;
    require_exact_directory_name(&parent, &resolved, path)?;
    // Resolve from root, not parent, for in-root links.
    let directory = root_dir(root)?.open_dir(resolved.as_path())?;
    let id = file_identity(&directory.try_clone()?.into_std_file(), true)?;
    identities.push(id.clone());
    parent_paths.push(resolved.clone());
    Ok(ObservedDirectory {
        handle: directory,
        snapshot: DirectorySnapshot {
            path: path.clone(),
            identity: id,
            parents: identities,
            parent_paths,
            members: Vec::new(),
        },
    })
}
// Directory enumeration requires exact spelling even on case-insensitive filesystems.
fn require_exact_directory_name(
    parent: &Dir,
    resolved: &RelativePath,
    path: &RelativePath,
) -> Result<(), SourceError> {
    let name = resolved
        .as_path()
        .file_name()
        .ok_or_else(|| SourceError::InvalidPath(path.0.clone()))?;
    if !exact_name(parent, name)? {
        return match parent.symlink_metadata(name) {
            Ok(_) => Err(SourceError::Unsafe(path.0.clone())),
            Err(error) => Err(error.into()),
        };
    }
    Ok(())
}
// Collect and order only members of the selected directory.
fn enumerate_members(
    directory: &Dir,
    path: &RelativePath,
) -> Result<Vec<DirectoryMember>, SourceError> {
    let mut members = Vec::new();
    for item in directory.entries()? {
        members.push(enumerate_member(directory, path, item?)?);
    }
    members.sort_by(|a, b| a.name.encode_utf16().cmp(b.name.encode_utf16()));
    Ok(members)
}
// Inspect one named member through the opened directory without following reparse points.
fn enumerate_member(
    directory: &Dir,
    path: &RelativePath,
    entry: cap_std::fs::DirEntry,
) -> Result<DirectoryMember, SourceError> {
    let name = entry
        .file_name()
        .into_string()
        .map_err(|_| SourceError::InvalidPath(path.0.clone()))?;
    let kind = safe_member_kind(&entry, path, &name)?;
    let file = if kind == MemberKind::Directory {
        directory.open_dir(&name)?.into_std_file()
    } else {
        open_file(directory, Path::new(&name))?
    };
    let identity = file_identity(&file, kind == MemberKind::Directory)?;
    Ok(DirectoryMember {
        name,
        identity,
        kind,
    })
}
// Reparse points and non-file/non-directory members are rejected before open.
fn safe_member_kind(
    entry: &cap_std::fs::DirEntry,
    path: &RelativePath,
    name: &str,
) -> Result<MemberKind, SourceError> {
    let ft = entry.file_type()?;
    let kind = if ft.is_symlink() {
        MemberKind::Symlink
    } else if ft.is_dir() {
        MemberKind::Directory
    } else if ft.is_file() {
        MemberKind::File
    } else {
        MemberKind::Other
    };
    if matches!(kind, MemberKind::Symlink | MemberKind::Other) {
        return Err(SourceError::Unsafe(path.0.join(name)));
    }
    Ok(kind)
}
pub fn enumerate_directory(
    root: &Root,
    path: &RelativePath,
) -> Result<DirectorySnapshot, SourceError> {
    let first = enumerate_once(root, path)?;
    let second = enumerate_once(root, path)?;
    if first != second {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(second)
}
