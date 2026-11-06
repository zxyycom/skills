//! Missing namespace proofs and held parent chains.
use super::*;

/// A missing final path bound to the workspace, each actual parent identity,
/// and the still-open final parent handle. Not a proof that a later stage is fresh.
#[derive(Debug)]
pub struct MissingProof {
    pub(super) workspace: PathBuf,
    pub(super) workspace_identity: FileIdentity,
    pub(super) path: RelativePath,
    pub(super) parent: cap_std::fs::Dir,
    pub(super) parents: Vec<FileIdentity>,
    pub(super) parent_paths: Vec<RelativePath>,
    pub(super) remaining: Vec<std::ffi::OsString>,
}
impl MissingProof {
    /// Revalidate the held namespace immediately before exclusive creation.
    pub(super) fn validate_creation_parent(&self, root: &Root) -> Result<(), SourceError> {
        if self.workspace != root.path || self.workspace_identity != root.identity {
            return Err(SourceError::Changed(self.path.0.clone()));
        }
        if self.remaining.len() != 1 {
            return Err(SourceError::InvalidPath(self.path.0.clone()));
        }
        let (_, current) = parent_chain(root, &self.path)?;
        if current != self.parents {
            return Err(SourceError::Changed(self.path.0.clone()));
        }
        Ok(())
    }
    pub fn parents(&self) -> &[FileIdentity] {
        &self.parents
    }
    pub fn parent_paths(&self) -> &[RelativePath] {
        &self.parent_paths
    }
    pub fn remaining_components(&self) -> usize {
        self.remaining.len()
    }
    /// A deleted file is absent under the same captured parent chain only
    /// when no ancestor itself is missing or replaced.
    pub(crate) fn matches_parent_of(&self, source: &SourceSnapshot) -> bool {
        self.path == source.path
            && self.remaining.len() == 1
            && self.parents == source.parents
            && self.parent_paths == source.parent_paths
    }
    fn matches_chain(
        &self,
        old_paths: &[RelativePath],
        old_parents: &[FileIdentity],
        observed: &[(RelativePath, FileIdentity)],
        removed: &[RelativePath],
    ) -> bool {
        if old_parents.len() != old_paths.len() + 1
            || self.parents.len() != self.parent_paths.len() + 1
            || self.parent_paths.len() > old_paths.len()
            || self.remaining.len() != old_paths.len() - self.parent_paths.len() + 1
            || self.parents.first() != old_parents.first()
        {
            return false;
        }
        for (index, path) in self.parent_paths.iter().enumerate() {
            if old_paths.get(index) != Some(path) {
                return false;
            }
            let actual = &self.parents[index + 1];
            if old_parents[index + 1] != *actual && !observed_directory(observed, path, actual) {
                return false;
            }
        }
        old_paths[self.parent_paths.len()..]
            .iter()
            .all(|path| removed.contains(path))
    }
    /// Match the file's original parent chain, allowing only explicitly
    /// journal-observed replacements and explicitly journal-removed ancestors.
    pub(crate) fn matches_journaled_parent_of(
        &self,
        source: &SourceSnapshot,
        observed: &[(RelativePath, FileIdentity)],
        removed: &[RelativePath],
    ) -> bool {
        self.path == source.path
            && self.matches_chain(&source.parent_paths, &source.parents, observed, removed)
    }
    pub(crate) fn matches_journaled_parent_of_directory(
        &self,
        directory: &DirectorySnapshot,
        observed: &[(RelativePath, FileIdentity)],
        removed: &[RelativePath],
    ) -> bool {
        if self.path != directory.path
            || directory.parents.is_empty()
            || directory.parent_paths.is_empty()
        {
            return false;
        }
        self.matches_chain(
            &directory.parent_paths[..directory.parent_paths.len() - 1],
            &directory.parents[..directory.parents.len() - 1],
            observed,
            removed,
        )
    }
    pub(crate) fn equivalent(&self, other: &Self) -> bool {
        self.workspace == other.workspace
            && self.workspace_identity == other.workspace_identity
            && self.path == other.path
            && self.parents == other.parents
            && self.parent_paths == other.parent_paths
            && self.remaining == other.remaining
    }
    /// Extends a previously absent chain only through directories whose identities
    /// the caller separately observed in its own resource journal. This is an
    /// observation link, not proof that mkdir created those identities.
    pub(crate) fn extends(&self, newer: &Self, observed: &[(RelativePath, FileIdentity)]) -> bool {
        if self.workspace != newer.workspace
            || self.workspace_identity != newer.workspace_identity
            || self.path != newer.path
            || !newer.parents.starts_with(&self.parents)
            || !newer.parent_paths.starts_with(&self.parent_paths)
        {
            return false;
        }
        for (path, identity) in newer.parent_paths[self.parent_paths.len()..]
            .iter()
            .zip(&newer.parents[self.parents.len()..])
        {
            if !observed_directory(observed, path, identity) {
                return false;
            }
        }
        true
    }
}
// Directory identity excludes mutable size, but includes device, inode, and mode.
fn observed_directory(
    observed: &[(RelativePath, FileIdentity)],
    path: &RelativePath,
    actual: &FileIdentity,
) -> bool {
    observed
        .iter()
        .any(|(candidate, id)| candidate == path && id.same_identity_and_mode(actual))
}
#[cfg(windows)]
fn exact_name_or_missing(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<bool, SourceError> {
    for entry in parent.entries()? {
        if entry?.file_name() == name {
            return Ok(true);
        }
    }
    match parent.symlink_metadata(name) {
        Ok(_) => Err(SourceError::Unsafe(path.0.clone())),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}
#[cfg(any(unix, windows))]
pub(super) fn parent_chain(
    root: &Root,
    path: &RelativePath,
) -> Result<(cap_std::fs::Dir, Vec<FileIdentity>), SourceError> {
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let mut parent = capability.try_clone()?;
    let mut prefix = PathBuf::new();
    let mut identities = vec![root.identity.clone()];
    let resolved = resolve_directory_links(root, path, true)?;
    let components: Vec<_> = resolved.as_path().components().collect();
    for component in components.iter().take(components.len().saturating_sub(1)) {
        let Component::Normal(name) = component else {
            return Err(SourceError::InvalidPath(path.0.clone()));
        };
        #[cfg(windows)]
        if !exact_name_or_missing(&parent, name, path)? {
            return Err(io::Error::from(io::ErrorKind::NotFound).into());
        }
        prefix.push(name);
        parent = capability.open_dir(&prefix)?;
        let mut identity = identity_from_handle(&parent.try_clone()?.into_std_file())?;
        identity.size = 0;
        identities.push(identity);
    }
    Ok((parent, identities))
}
// One observation retains the nearest existing ancestor and the uncreated suffix.
#[cfg(any(unix, windows))]
struct MissingObservation {
    parent: cap_std::fs::Dir,
    identities: Vec<FileIdentity>,
    paths: Vec<RelativePath>,
    remaining: Vec<std::ffi::OsString>,
}
#[cfg(any(unix, windows))]
fn require_missing_name(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<(), SourceError> {
    match parent.symlink_metadata(name) {
        Ok(_) => Err(SourceError::Changed(path.0.clone())),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}
// Capture the identity of an existing ancestor, or identify the first missing one.
#[cfg(any(unix, windows))]
struct ObservedParent {
    directory: cap_std::fs::Dir,
    identity: FileIdentity,
}
#[cfg(any(unix, windows))]
fn open_observed_parent(
    capability: &cap_std::fs::Dir,
    prefix: &Path,
) -> Result<Option<ObservedParent>, SourceError> {
    let directory = match capability.open_dir(prefix) {
        Ok(directory) => directory,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let mut identity = identity_from_handle(&directory.try_clone()?.into_std_file())?;
    identity.size = 0;
    Ok(Some(ObservedParent {
        directory,
        identity,
    }))
}
/// Capture a missing path with its nearest existing, held ancestor and the
/// remaining missing components. No missing ancestor is silently created.
#[cfg(any(unix, windows))]
pub(crate) fn capture_missing(
    root: &Root,
    path: &RelativePath,
) -> Result<MissingProof, SourceError> {
    fn observe(root: &Root, path: &RelativePath) -> Result<MissingObservation, SourceError> {
        let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
        let resolved = resolve_directory_links(root, path, true)?;
        let components: Vec<_> = resolved
            .as_path()
            .components()
            .map(|part| part.as_os_str().to_os_string())
            .collect();
        let mut parent = capability.try_clone()?;
        let mut prefix = PathBuf::new();
        let mut identities = vec![root.identity.clone()];
        let mut paths = Vec::new();
        let mut first_missing = components.len() - 1;
        for (i, name) in components.iter().enumerate().take(components.len() - 1) {
            #[cfg(windows)]
            if !exact_name_or_missing(&parent, name, path)? {
                first_missing = i;
                break;
            }
            prefix.push(name);
            let Some(next) = open_observed_parent(&capability, &prefix)? else {
                first_missing = i;
                break;
            };
            identities.push(next.identity);
            paths.push(RelativePath::new(&prefix)?);
            parent = next.directory;
        }
        let remaining = components[first_missing..].to_vec();
        require_missing_name(&parent, &remaining[0], path)?;
        Ok(MissingObservation {
            parent,
            identities,
            paths,
            remaining,
        })
    }
    let first = observe(root, path)?;
    let MissingObservation {
        parent: fresh_parent,
        identities,
        paths,
        remaining,
    } = observe(root, path)?;
    drop(fresh_parent);
    if first.identities != identities || first.paths != paths || first.remaining != remaining {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(MissingProof {
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
        path: path.clone(),
        parent: first.parent,
        parents: first.identities,
        parent_paths: first.paths,
        remaining: first.remaining,
    })
}
