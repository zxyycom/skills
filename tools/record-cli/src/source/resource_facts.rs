//! Resource root and owner namespace identity facts.
use super::*;

#[derive(Debug)]
enum DirectoryFact {
    Present {
        identity: FileIdentity,
        parents: Vec<FileIdentity>,
    },
    Missing(MissingProof),
}
impl DirectoryFact {
    fn equivalent(&self, other: &Self) -> bool {
        match (self, other) {
            (
                Self::Present {
                    identity: a,
                    parents: ap,
                },
                Self::Present {
                    identity: b,
                    parents: bp,
                },
            ) => a == b && ap == bp,
            (Self::Missing(a), Self::Missing(b)) => a.equivalent(b),
            _ => false,
        }
    }
}
/// Root-only resource directory observation, usable for empty or missing trees.
#[derive(Debug)]
pub struct ResourceRootFact {
    workspace: PathBuf,
    workspace_identity: FileIdentity,
    path: RelativePath,
    fact: DirectoryFact,
}
impl ResourceRootFact {
    pub fn exists(&self) -> bool {
        matches!(self.fact, DirectoryFact::Present { .. })
    }
    pub fn equivalent(&self, other: &Self) -> bool {
        self.workspace == other.workspace
            && self.workspace_identity == other.workspace_identity
            && self.path == other.path
            && self.fact.equivalent(&other.fact)
    }
    pub fn matches_directory(&self, listing: &DirectorySnapshot) -> bool {
        match &self.fact {
            DirectoryFact::Present { identity, parents } => {
                listing.path == self.path
                    && &listing.identity == identity
                    && listing.parents.len() == parents.len() + 1
                    && listing.parents[..parents.len()] == parents[..]
                    && listing.parents.last() == Some(identity)
            }
            DirectoryFact::Missing(_) => false,
        }
    }
    pub fn matches_owner_root(&self, owner: &ResourceDirectoryFact) -> bool {
        self.workspace == owner.workspace
            && self.workspace_identity == owner.workspace_identity
            && self.path == owner.resource_root
            && self.fact.equivalent(&owner.root_fact)
    }
}
#[cfg(any(unix, windows))]
pub fn capture_resource_root(
    root: &Root,
    path: &RelativePath,
) -> Result<ResourceRootFact, SourceError> {
    let fact = resource_directory_fact(root, path)?;
    if !fact.equivalent(&resource_directory_fact(root, path)?) {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(ResourceRootFact {
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
        path: path.clone(),
        fact,
    })
}
/// Root and owner identities or absence proofs for exactly one resource owner.
/// Does not assert anything about unselected members or Git visibility.
#[derive(Debug)]
pub struct ResourceDirectoryFact {
    workspace: PathBuf,
    workspace_identity: FileIdentity,
    resource_root: RelativePath,
    owner: RelativePath,
    root_fact: DirectoryFact,
    owner_fact: DirectoryFact,
}
impl ResourceDirectoryFact {
    pub fn equivalent(&self, other: &Self) -> bool {
        self.workspace == other.workspace
            && self.workspace_identity == other.workspace_identity
            && self.resource_root == other.resource_root
            && self.owner == other.owner
            && self.root_fact.equivalent(&other.root_fact)
            && self.owner_fact.equivalent(&other.owner_fact)
    }
    pub fn root_exists(&self) -> bool {
        matches!(self.root_fact, DirectoryFact::Present { .. })
    }
    pub fn owner_exists(&self) -> bool {
        matches!(self.owner_fact, DirectoryFact::Present { .. })
    }
    pub fn matches_selected_stat(&self, selected: &SelectedStatTree) -> bool {
        let Ok(expected_owner) =
            RelativePath::new(self.resource_root.as_path().join(self.owner.as_path()))
        else {
            return false;
        };
        self.workspace == selected.workspace
            && self.workspace_identity == selected.workspace_identity
            && expected_owner == selected.owner
            && matches!(&self.owner_fact, DirectoryFact::Present { identity, .. } if *identity == selected.owner_identity)
    }
}
#[cfg(any(unix, windows))]
fn resource_directory_fact(root: &Root, path: &RelativePath) -> Result<DirectoryFact, SourceError> {
    let Some(ResourceParent {
        parent,
        identities: parents,
    }) = resource_parent(root, path)?
    else {
        return Ok(DirectoryFact::Missing(capture_missing(root, path)?));
    };
    let name = path
        .as_path()
        .file_name()
        .ok_or_else(|| SourceError::InvalidPath(path.0.clone()))?;
    if !has_exact_resource_name(&parent, name, path.as_path(), path.as_path())? {
        return Ok(DirectoryFact::Missing(capture_missing(root, path)?));
    }
    let identity = open_resource_directory(&parent, name, path)?;
    Ok(DirectoryFact::Present { identity, parents })
}
// Distinguish a missing ancestor from an available parent capability.
#[cfg(any(unix, windows))]
struct ResourceParent {
    parent: cap_std::fs::Dir,
    identities: Vec<FileIdentity>,
}
#[cfg(any(unix, windows))]
fn resource_parent(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<ResourceParent>, SourceError> {
    match parent_chain(root, path) {
        Ok((parent, identities)) => Ok(Some(ResourceParent { parent, identities })),
        Err(SourceError::Io(error)) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}
// Observe a non-link directory through its opened handle.
#[cfg(any(unix, windows))]
fn open_resource_directory(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<FileIdentity, SourceError> {
    let meta = parent.symlink_metadata(name)?;
    if meta.file_type().is_symlink() {
        return Err(SourceError::Symlink(path.0.clone()));
    }
    if !meta.is_dir() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    let directory = parent.open_dir(name)?.into_std_file();
    let mut identity = identity_from_handle(&directory)?;
    identity.size = 0;
    Ok(identity)
}
/// Capture exactly the configured resource root and one direct owner; neither
/// the root nor owner may be a symlink or other non-directory member.
#[cfg(any(unix, windows))]
pub fn capture_resource_directories(
    root: &Root,
    resource_root: &RelativePath,
    owner: &RelativePath,
) -> Result<ResourceDirectoryFact, SourceError> {
    if owner.as_path().components().count() != 1 {
        return Err(SourceError::InvalidPath(owner.0.clone()));
    }
    let owner_path = RelativePath::new(resource_root.as_path().join(owner.as_path()))?;
    let root_fact = resource_directory_fact(root, resource_root)?;
    let owner_fact = resource_directory_fact(root, &owner_path)?;
    let check_root = resource_directory_fact(root, resource_root)?;
    let check_owner = resource_directory_fact(root, &owner_path)?;
    if !root_fact.equivalent(&check_root) || !owner_fact.equivalent(&check_owner) {
        return Err(SourceError::Changed(owner_path.0));
    }
    Ok(ResourceDirectoryFact {
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
        resource_root: resource_root.clone(),
        owner: owner.clone(),
        root_fact,
        owner_fact,
    })
}
