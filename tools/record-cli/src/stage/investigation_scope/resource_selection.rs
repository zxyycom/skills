use super::*;

/// Resource paths bound to selected owners, direct references and observed Git membership.
pub(super) struct ResourceSelection {
    pub resource_root: RelativePath,
    pub selected_ids: BTreeSet<String>,
    pub direct_ids: BTreeSet<String>,
    pub direct_paths: BTreeSet<PathBuf>,
    pub resource_scopes: Vec<PathBuf>,
    pub workspace_resources: Vec<PathBuf>,
    pub owner_paths: BTreeSet<PathBuf>,
    pub all_resource_paths: BTreeSet<PathBuf>,
    pub file_mode: bool,
}

pub(super) fn select_resources(
    root: &Root,
    index_path: &RelativePath,
    base: &Phase,
    workspace: &ValidatedIndex<InvestigationState>,
    revision: Option<&str>,
) -> Result<ResourceSelection, IndexStageError> {
    let ResourceScope {
        resource_root,
        selected_ids,
        direct_ids,
        owner_scopes,
        direct_paths,
        resource_scopes,
    } = resource_scope(index_path, base, workspace)?;
    let workspace_resources = git::list_repository_workspace_files(root.path(), &resource_scopes)
        .map_err(IndexStageError::Git)?;
    for path in &direct_paths {
        if !workspace_resources.contains(path) {
            return Err(IndexStageError::Selection(
                "referenced resource is missing or ignored".into(),
            ));
        }
    }
    let owner_paths = owner_paths(
        root,
        revision,
        &owner_scopes,
        base.pending.membership(),
        &workspace_resources,
    )?;
    let all_resource_paths: BTreeSet<PathBuf> = owner_paths.union(&direct_paths).cloned().collect();
    let file_mode = git::core_file_mode(root.path()).map_err(IndexStageError::Git)?;

    Ok(ResourceSelection {
        resource_root,
        selected_ids,
        direct_ids,
        direct_paths,
        resource_scopes,
        workspace_resources,
        owner_paths,
        all_resource_paths,
        file_mode,
    })
}

/// Path scope derived from selected owners and direct references before any Git reads.
struct ResourceScope {
    resource_root: RelativePath,
    selected_ids: BTreeSet<String>,
    direct_ids: BTreeSet<String>,
    owner_scopes: Vec<PathBuf>,
    direct_paths: BTreeSet<PathBuf>,
    resource_scopes: Vec<PathBuf>,
}
fn resource_scope(
    index_path: &RelativePath,
    base: &Phase,
    workspace: &ValidatedIndex<InvestigationState>,
) -> Result<ResourceScope, IndexStageError> {
    let resource_root = RelativePath::new(
        index_path
            .as_path()
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .join("_resources"),
    )
    .map_err(IndexStageError::Source)?;
    let selected_ids: BTreeSet<_> = base.selected.iter().cloned().collect();
    let direct_ids: BTreeSet<String> = base
        .selected
        .iter()
        .filter_map(|id| workspace.index().entries.get(id))
        .flat_map(|state| state.resource_ids.iter().cloned())
        .collect();
    let owner_scopes: Vec<_> = selected_ids
        .iter()
        .map(|id| resource_root.as_path().join(id))
        .collect();
    let direct_paths: BTreeSet<PathBuf> = direct_ids
        .iter()
        .map(|id| resource_root.as_path().join(id))
        .collect();
    let mut resource_scopes = owner_scopes.clone();
    resource_scopes.extend(direct_paths.iter().cloned());
    resource_scopes.sort();
    resource_scopes.dedup();
    Ok(ResourceScope {
        resource_root,
        selected_ids,
        direct_ids,
        owner_scopes,
        direct_paths,
        resource_scopes,
    })
}

/// Union each selected owner's fixed HEAD, pending and visible worktree paths.
fn owner_paths(
    root: &Root,
    revision: Option<&str>,
    owner_scopes: &[PathBuf],
    pending: &git::PendingSnapshot,
    workspace_resources: &[PathBuf],
) -> Result<BTreeSet<PathBuf>, IndexStageError> {
    let head_resources = match revision {
        Some(revision) => git::list_revision_files(root.path(), revision, owner_scopes)
            .map_err(IndexStageError::Git)?,
        None => Vec::new(),
    };
    let mut owner_paths: BTreeSet<PathBuf> =
        head_resources.into_iter().map(|entry| entry.path).collect();
    owner_paths.extend(
        pending
            .entries
            .iter()
            .filter(|entry| {
                owner_scopes
                    .iter()
                    .any(|owner| entry.path.starts_with(owner))
            })
            .map(|entry| entry.path.clone()),
    );
    owner_paths.extend(
        workspace_resources
            .iter()
            .filter(|path| owner_scopes.iter().any(|owner| path.starts_with(owner)))
            .cloned(),
    );
    Ok(owner_paths)
}

/// One phase captures resource-owner evidence and projects updates from it.
pub(super) struct ResourceCapture<'a> {
    pub root: &'a Root,
    pub selection: &'a ResourceSelection,
    pub pending: &'a ContentSnapshot,
    pub scope: StageScope,
}

impl ResourceCapture<'_> {
    pub fn capture(
        &self,
        updates: &mut BTreeMap<PathBuf, Option<PendingFile>>,
    ) -> Result<Vec<ResourcePhase>, IndexStageError> {
        let mut owners = self.selection.selected_ids.clone();
        for id in &self.selection.direct_ids {
            let (owner, _) = id
                .split_once('/')
                .ok_or_else(|| IndexStageError::Selection("invalid resource identity".into()))?;
            owners.insert(owner.to_owned());
        }
        owners
            .into_iter()
            .map(|owner| self.capture_owner(&owner, updates))
            .collect()
    }

    /// Capture a single owner's directory and selected member snapshots.
    fn capture_owner(
        &self,
        owner_id: &str,
        updates: &mut BTreeMap<PathBuf, Option<PendingFile>>,
    ) -> Result<ResourcePhase, IndexStageError> {
        let selection = self.selection;
        let owner = RelativePath::new(owner_id).map_err(IndexStageError::Source)?;
        let owner_path = selection.resource_root.as_path().join(owner_id);
        let directories =
            source::capture_resource_directories(self.root, &selection.resource_root, &owner)
                .map_err(IndexStageError::Source)?;
        let mut members: Vec<RelativePath> = selection
            .all_resource_paths
            .iter()
            .filter_map(|path| path.strip_prefix(&owner_path).ok())
            .map(RelativePath::new)
            .collect::<Result<_, _>>()
            .map_err(IndexStageError::Source)?;
        members.sort_by(|a, b| a.as_path().cmp(b.as_path()));
        members.dedup();
        let tree = if directories.owner_exists() {
            let owner_rel = RelativePath::new(&owner_path).map_err(IndexStageError::Source)?;
            Some(
                source::capture_selected_tree(self.root, &owner_rel, &members)
                    .map_err(IndexStageError::Source)?,
            )
        } else {
            None
        };
        self.project_owner_members(owner_id, &owner_path, tree.as_ref(), updates)?;
        Ok(ResourcePhase {
            owner,
            members,
            directories,
            tree,
        })
    }

    /// Bind selected member payloads to updates and foreign-reference checks.
    fn project_owner_members(
        &self,
        owner_id: &str,
        owner_path: &Path,
        tree: Option<&source::SelectedTree>,
        updates: &mut BTreeMap<PathBuf, Option<PendingFile>>,
    ) -> Result<(), IndexStageError> {
        let selection = self.selection;
        for path in selection
            .all_resource_paths
            .iter()
            .filter(|path| path.starts_with(owner_path))
        {
            let current = self.current_resource(path, tree)?;
            if selection.owner_paths.contains(path) {
                updates.insert(path.clone(), current.clone());
            }
            if self.scope == StageScope::All
                && selection.direct_paths.contains(path)
                && !selection.selected_ids.contains(owner_id)
            {
                self.verify_foreign(path, &current)?;
            }
        }
        Ok(())
    }

    /// Validate a referenced resource and derive its selected staged representation.
    fn current_resource(
        &self,
        path: &Path,
        tree: Option<&source::SelectedTree>,
    ) -> Result<Option<PendingFile>, IndexStageError> {
        let snapshot = tree.and_then(|tree| {
            tree.entries().iter().find_map(|entry| match entry {
                source::SelectedMember::Present(file) if file.path.as_path() == path => Some(file),
                _ => None,
            })
        });
        if self.selection.direct_paths.contains(path) && snapshot.is_none() {
            return Err(IndexStageError::Selection(
                "referenced resource is missing".into(),
            ));
        }
        let current = snapshot
            .map(|source| {
                Ok(PendingFile {
                    mode: git::workspace_file_mode(
                        source,
                        self.pending.membership(),
                        self.selection.file_mode,
                    )?,
                    bytes: source.bytes.clone(),
                })
            })
            .transpose()
            .map_err(IndexStageError::Git)?;
        Ok(current)
    }

    fn verify_foreign(
        &self,
        path: &Path,
        current: &Option<PendingFile>,
    ) -> Result<(), IndexStageError> {
        let staged = self
            .pending
            .blobs()
            .iter()
            .find(|(p, _)| p == path)
            .map(|(_, bytes)| bytes);
        let staged_entry = self
            .pending
            .membership()
            .entries
            .iter()
            .find(|entry| entry.path == path);
        if !matches!((current, staged, staged_entry), (Some(file), Some(bytes), Some(entry)) if file.bytes == *bytes && file.mode == entry.mode && entry.stage == 0)
        {
            return Err(IndexStageError::Selection(
                "foreign resource differs from pending; select its owner".into(),
            ));
        }
        Ok(())
    }
}
