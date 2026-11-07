//! Directory membership through the workspace capability.
use super::*;

/// Enumerate one selected directory without following its members' symlinks.
/// Captured facts are local observations, not an atomic cross-file snapshot.
#[cfg(unix)]
pub fn enumerate_directory(
    root: &Root,
    path: &RelativePath,
) -> Result<DirectorySnapshot, SourceError> {
    if directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let resolved = resolve_directory_links(root, path, false)?;
    let (parents, parent_paths) = observe_parents(root, path, &capability, &resolved)?;
    let directory = capability.open_dir(resolved.as_path())?;
    let identity = directory_identity(&directory.try_clone()?.into_std_file().metadata()?);
    let mut members = read_members(&directory, path)?;
    members.sort_by(|a, b| a.name.encode_utf16().cmp(b.name.encode_utf16()));
    Ok(DirectorySnapshot {
        path: path.clone(),
        identity,
        parents,
        parent_paths,
        members,
    })
}

#[cfg(unix)]
fn observe_parents(
    root: &Root,
    path: &RelativePath,
    capability: &cap_std::fs::Dir,
    resolved: &RelativePath,
) -> Result<(Vec<FileIdentity>, Vec<RelativePath>), SourceError> {
    let mut parents = vec![directory_identity(&root.directory.metadata()?)];
    let mut parent_paths = Vec::new();
    let mut prefix = PathBuf::new();
    for component in resolved.as_path().components() {
        let Component::Normal(name) = component else {
            return Err(SourceError::InvalidPath(path.0.clone()));
        };
        prefix.push(name);
        let handle = capability.open_dir(&prefix)?.into_std_file();
        parents.push(directory_identity(&handle.metadata()?));
        parent_paths.push(RelativePath::new(&prefix)?);
    }
    Ok((parents, parent_paths))
}

#[cfg(unix)]
fn read_members(
    directory: &cap_std::fs::Dir,
    path: &RelativePath,
) -> Result<Vec<DirectoryMember>, SourceError> {
    use cap_std::fs::MetadataExt;
    let mut members = Vec::new();
    for entry in directory.entries()? {
        let entry = entry?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| SourceError::InvalidPath(path.0.clone()))?;
        let meta = directory.symlink_metadata(&name)?;
        let kind = if meta.is_file() {
            MemberKind::File
        } else if meta.is_dir() {
            MemberKind::Directory
        } else if meta.file_type().is_symlink() {
            MemberKind::Symlink
        } else {
            MemberKind::Other
        };
        members.push(DirectoryMember {
            name,
            identity: FileIdentity {
                device: meta.dev(),
                inode: meta.ino(),
                mode: meta.mode(),
                size: meta.size(),
            },
            kind,
        });
    }
    Ok(members)
}
