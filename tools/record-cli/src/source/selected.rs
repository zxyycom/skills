//! Selection-scoped resource facts and parent proofs.
use super::*;

/// Selected resource facts do not enumerate or read unselected owner members.
/// The caller supplies selection from its domain/Git visibility rules.
#[derive(Debug)]
pub struct SelectedTree {
    workspace: PathBuf,
    workspace_identity: FileIdentity,
    owner: RelativePath,
    owner_identity: FileIdentity,
    entries: Vec<SelectedMember>,
}
#[derive(Debug)]
pub enum SelectedMember {
    Present(SourceSnapshot),
    Missing {
        path: RelativePath,
        proof: MissingProof,
    },
}
impl SelectedTree {
    pub fn entries(&self) -> &[SelectedMember] {
        &self.entries
    }
    pub fn belongs_to(&self, root: &Root, owner: &RelativePath) -> bool {
        self.workspace == root.path
            && self.workspace_identity == root.identity
            && self.owner == *owner
    }
    pub fn equivalent(&self, other: &Self) -> bool {
        self.workspace == other.workspace
            && self.workspace_identity == other.workspace_identity
            && self.owner == other.owner
            && self.owner_identity == other.owner_identity
            && self.entries.len() == other.entries.len()
            && self
                .entries
                .iter()
                .zip(&other.entries)
                .all(|(a, b)| match (a, b) {
                    (SelectedMember::Present(a), SelectedMember::Present(b)) => a == b,
                    (
                        SelectedMember::Missing { path: a, proof: ap },
                        SelectedMember::Missing { path: b, proof: bp },
                    ) => a == b && ap.equivalent(bp),
                    _ => false,
                })
    }
}
fn selected_owner_identity(root: &Root, owner: &RelativePath) -> Result<FileIdentity, SourceError> {
    reject_final_link(root, owner)?;
    let resolved = resolve_directory_links(root, owner, false)?;
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let directory = capability.open_dir(resolved.as_path())?.into_std_file();
    let mut identity = identity_from_handle(&directory)?;
    identity.size = 0;
    Ok(identity)
}
fn reject_resource_parent_links(
    root: &Root,
    owner: &RelativePath,
    member: &RelativePath,
) -> Result<(), SourceError> {
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let owner_resolved = resolve_directory_links(root, owner, false)?;
    let mut prefix = owner_resolved.as_path().to_path_buf();
    let parts: Vec<_> = member.as_path().components().collect();
    for part in parts.iter().take(parts.len().saturating_sub(1)) {
        prefix.push(part.as_os_str());
        if !resource_parent_is_safe(&capability, &prefix)? {
            return Ok(());
        }
    }
    Ok(())
}
// Stop at a missing ancestor; reject links and non-directory parents.
fn resource_parent_is_safe(
    capability: &cap_std::fs::Dir,
    prefix: &Path,
) -> Result<bool, SourceError> {
    match capability.symlink_metadata(prefix) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            Err(SourceError::Symlink(prefix.to_path_buf()))
        }
        Ok(metadata) if metadata.is_dir() => Ok(true),
        Ok(_) => Err(SourceError::NonRegular(prefix.to_path_buf())),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}
fn exact_resource_path(
    root: &Root,
    owner: &RelativePath,
    member: &RelativePath,
) -> Result<bool, SourceError> {
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let resolved_owner = resolve_directory_links(root, owner, false)?;
    let mut parent = capability.open_dir(resolved_owner.as_path())?;
    let parts: Vec<_> = member.as_path().components().collect();
    for (index, part) in parts.iter().enumerate() {
        let Component::Normal(expected) = part else {
            return Err(SourceError::InvalidPath(member.0.clone()));
        };
        if !has_exact_resource_name(
            &parent,
            expected,
            member.as_path(),
            &owner.as_path().join(member.as_path()),
        )? {
            return Ok(false);
        }
        if index + 1 < parts.len() {
            parent =
                open_selected_parent(&parent, expected, &owner.as_path().join(member.as_path()))?;
        }
    }
    Ok(true)
}

// Resolve one exact directory component only after rejecting links and non-directories.
fn open_selected_parent(
    parent: &cap_std::fs::Dir,
    expected: &std::ffi::OsStr,
    display_path: &Path,
) -> Result<cap_std::fs::Dir, SourceError> {
    let metadata = parent.symlink_metadata(expected)?;
    if metadata.file_type().is_symlink() {
        return Err(SourceError::Symlink(display_path.to_path_buf()));
    }
    if !metadata.is_dir() {
        return Err(SourceError::NonRegular(display_path.to_path_buf()));
    }
    Ok(parent.open_dir(expected)?)
}
// Selection-scoped name and parent-link observation, rechecked after member reads.
struct SelectedPath {
    path: RelativePath,
    exact: bool,
}
impl SelectedPath {
    fn observe(
        root: &Root,
        owner: &RelativePath,
        member: &RelativePath,
    ) -> Result<Self, SourceError> {
        reject_resource_parent_links(root, owner, member)?;
        let exact = exact_resource_path(root, owner, member)?;
        let path = RelativePath::new(owner.as_path().join(member.as_path()))?;
        Ok(Self { path, exact })
    }
    fn revalidate(
        &self,
        root: &Root,
        owner: &RelativePath,
        member: &RelativePath,
    ) -> Result<(), SourceError> {
        reject_resource_parent_links(root, owner, member)?;
        if exact_resource_path(root, owner, member)? != self.exact {
            return Err(SourceError::Changed(owner.0.clone()));
        }
        Ok(())
    }
}

/// Capture only selected member paths. An empty selection still verifies the
/// owner directory. Membership discovery and ignored-path policy belong to Git
/// and the domain; this method does not claim unselected members are healthy.
pub fn capture_selected_tree(
    root: &Root,
    owner: &RelativePath,
    members: &[RelativePath],
) -> Result<SelectedTree, SourceError> {
    let before = selected_owner_identity(root, owner)?;
    let mut seen = std::collections::HashSet::new();
    let mut entries = Vec::new();
    for member in members {
        if !seen.insert(member.clone()) {
            return Err(SourceError::InvalidPath(member.0.clone()));
        }
        entries.push(capture_selected_member(root, owner, member)?);
    }
    if selected_owner_identity(root, owner)? != before {
        return Err(SourceError::Changed(owner.0.clone()));
    }
    Ok(SelectedTree {
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
        owner: owner.clone(),
        owner_identity: before,
        entries,
    })
}

// Capture a selected member between independent namespace observations.
fn capture_selected_member(
    root: &Root,
    owner: &RelativePath,
    member: &RelativePath,
) -> Result<SelectedMember, SourceError> {
    let selected = SelectedPath::observe(root, owner, member)?;
    let path = selected.path.clone();
    let entry = match capture(root, &path)? {
        ExpectedFile::Present(file) => SelectedMember::Present(file),
        ExpectedFile::Missing => {
            let proof = capture_missing(root, &path)?;
            SelectedMember::Missing { path, proof }
        }
    };
    selected.revalidate(root, owner, member)?;
    Ok(entry)
}

mod stat;
pub use stat::{SelectedStatMember, SelectedStatTree, inspect_selected_tree};
