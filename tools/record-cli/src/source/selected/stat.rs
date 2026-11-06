//! Metadata-only selected members without payload reads.
use super::*;

/// Metadata-only selected facts; file payloads and unselected members are never read.
#[derive(Debug)]
pub struct SelectedStatTree {
    pub(in crate::source) workspace: PathBuf,
    pub(in crate::source) workspace_identity: FileIdentity,
    pub(in crate::source) owner: RelativePath,
    pub(in crate::source) owner_identity: FileIdentity,
    entries: Vec<SelectedStatMember>,
}
#[derive(Debug)]
pub enum SelectedStatMember {
    Present {
        path: RelativePath,
        identity: FileIdentity,
        parents: Vec<FileIdentity>,
        parent_paths: Vec<RelativePath>,
    },
    Missing {
        path: RelativePath,
        proof: MissingProof,
    },
}
impl SelectedStatTree {
    /// Resource readiness depends on path/type/identity, not payload size.
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
                .all(|(a, b)| readiness_equivalent(a, b))
    }
    pub fn entries(&self) -> &[SelectedStatMember] {
        &self.entries
    }
    pub fn belongs_to(&self, root: &Root, owner: &RelativePath) -> bool {
        self.workspace == root.path
            && self.workspace_identity == root.identity
            && self.owner == *owner
    }
}
// Readiness compares member identity and parent chain, deliberately excluding file size.
fn readiness_equivalent(a: &SelectedStatMember, b: &SelectedStatMember) -> bool {
    match (a, b) {
        (
            SelectedStatMember::Present {
                path: a,
                identity: ai,
                parents: ap,
                parent_paths: app,
            },
            SelectedStatMember::Present {
                path: b,
                identity: bi,
                parents: bp,
                parent_paths: bpp,
            },
        ) => a == b && ai.same_identity_and_mode(bi) && ap == bp && app == bpp,
        (
            SelectedStatMember::Missing { path: a, proof: ap },
            SelectedStatMember::Missing { path: b, proof: bp },
        ) => a == b && ap.equivalent(bp),
        _ => false,
    }
}
fn stat_selected_once(root: &Root, path: &RelativePath) -> Result<SelectedStatMember, SourceError> {
    let (parent, parents) = match parent_chain(root, path) {
        Ok(result) => result,
        Err(SourceError::Io(error)) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(SelectedStatMember::Missing {
                path: path.clone(),
                proof: capture_missing(root, path)?,
            });
        }
        Err(error) => return Err(error),
    };
    let parent_paths = resolved_parent_paths(root, path)?;
    let name = path
        .as_path()
        .file_name()
        .ok_or_else(|| SourceError::InvalidPath(path.0.clone()))?;
    let Some(identity) = stat_regular_file(&parent, name, path)? else {
        return Ok(SelectedStatMember::Missing {
            path: path.clone(),
            proof: capture_missing(root, path)?,
        });
    };
    Ok(SelectedStatMember::Present {
        path: path.clone(),
        identity,
        parents,
        parent_paths,
    })
}
// Record the resolved parent paths in the same order as their observed identities.
fn resolved_parent_paths(
    root: &Root,
    path: &RelativePath,
) -> Result<Vec<RelativePath>, SourceError> {
    let resolved = resolve_directory_links(root, path, true)?;
    let components: Vec<_> = resolved.as_path().components().collect();
    let mut prefix = PathBuf::new();
    let mut parent_paths = Vec::new();
    for component in components.iter().take(components.len().saturating_sub(1)) {
        prefix.push(component.as_os_str());
        parent_paths.push(RelativePath::new(&prefix)?);
    }
    Ok(parent_paths)
}
/// Inspect selected members with metadata-only handles and twice-observed
/// identity; unselected members and all file contents remain unread.
pub fn inspect_selected_tree(
    root: &Root,
    owner: &RelativePath,
    members: &[RelativePath],
) -> Result<SelectedStatTree, SourceError> {
    let before = selected_owner_identity(root, owner)?;
    let mut seen = std::collections::HashSet::new();
    let mut entries = Vec::new();
    for member in members {
        if !seen.insert(member.clone()) {
            return Err(SourceError::InvalidPath(member.0.clone()));
        }
        entries.push(inspect_member(root, owner, member)?);
    }
    if selected_owner_identity(root, owner)? != before {
        return Err(SourceError::Changed(owner.0.clone()));
    }
    Ok(SelectedStatTree {
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
        owner: owner.clone(),
        owner_identity: before,
        entries,
    })
}

// Recheck selected parent spelling and identity around two metadata observations.
fn inspect_member(
    root: &Root,
    owner: &RelativePath,
    member: &RelativePath,
) -> Result<SelectedStatMember, SourceError> {
    let selected = SelectedPath::observe(root, owner, member)?;
    let path = &selected.path;
    let first = stat_selected_once(root, path)?;
    let second = stat_selected_once(root, path)?;
    let same = same_stat_observation(&first, &second);
    if !same {
        return Err(SourceError::Changed(path.0.clone()));
    }
    selected.revalidate(root, owner, member)?;
    Ok(second)
}

// Same-phase freshness includes the full identity, including file size.
fn same_stat_observation(first: &SelectedStatMember, second: &SelectedStatMember) -> bool {
    match (first, second) {
        (
            SelectedStatMember::Missing { proof: a, .. },
            SelectedStatMember::Missing { proof: b, .. },
        ) => a.equivalent(b),
        (
            SelectedStatMember::Present {
                identity: a,
                parents: ap,
                parent_paths: app,
                ..
            },
            SelectedStatMember::Present {
                identity: b,
                parents: bp,
                parent_paths: bpp,
                ..
            },
        ) => a == b && ap == bp && app == bpp,
        _ => false,
    }
}

// A metadata-only no-follow handle verifies a selected regular file's actual identity.
fn stat_regular_file(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
    path: &RelativePath,
) -> Result<Option<FileIdentity>, SourceError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    let metadata = match parent.symlink_metadata(name) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(None);
        }
        Err(error) => return Err(error.into()),
    };
    if metadata.file_type().is_symlink() {
        return Err(SourceError::Symlink(path.0.clone()));
    }
    if !metadata.is_file() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    let mut options = cap_std::fs::OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    #[cfg(target_os = "linux")]
    {
        use cap_std::fs::OpenOptionsExt;
        options.custom_flags(libc::O_PATH | libc::O_CLOEXEC);
    }
    let file = parent.open_with(name, &options)?.into_std();
    if !file.metadata()?.is_file() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    let identity = identity_from_handle(&file)?;
    Ok(Some(identity))
}
