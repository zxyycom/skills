use super::*;
use std::collections::HashSet;

/// Resource paths bound to selected owners, direct references and observed Git membership.
pub(super) struct ResourceSelection {
    pub resource_root: RelativePath,
    pub selected_ids: BTreeSet<String>,
    pub direct_paths: BTreeSet<PathBuf>,
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
    let scope = resource_scope(index_path, base, workspace)?;
    validate_owner_directories(root, &scope.resource_root, &scope.owner_scopes)?;
    let workspace_resources =
        git::list_repository_workspace_files(root.path(), &scope.resource_scopes)
            .map_err(IndexStageError::Git)?;
    let workspace_resource_set: HashSet<_> = workspace_resources.iter().collect();
    for path in &scope.direct_paths {
        if !workspace_resource_set.contains(path) {
            return Err(IndexStageError::Selection(
                "referenced resource is missing or ignored".into(),
            ));
        }
    }
    let owner_paths = owner_paths(
        root,
        revision,
        &scope,
        base.pending.membership(),
        &workspace_resources,
    )?;
    let all_resource_paths: BTreeSet<PathBuf> =
        owner_paths.union(&scope.direct_paths).cloned().collect();
    let file_mode = git::core_file_mode(root.path()).map_err(IndexStageError::Git)?;

    Ok(ResourceSelection {
        resource_root: scope.resource_root,
        selected_ids: scope.selected_ids,
        direct_paths: scope.direct_paths,
        owner_paths,
        all_resource_paths,
        file_mode,
    })
}

/// Git pathspec enumeration can silently omit a symlink at the resource root
/// or owner boundary, so inspect these directory components explicitly.
fn validate_owner_directories(
    root: &Root,
    resource_root: &RelativePath,
    owner_scopes: &[PathBuf],
) -> Result<(), IndexStageError> {
    for path in
        std::iter::once(resource_root.as_path()).chain(owner_scopes.iter().map(PathBuf::as_path))
    {
        let relative = RelativePath::new(path).map_err(IndexStageError::Source)?;
        source::directory_exists(root, &relative).map_err(IndexStageError::Source)?;
    }
    Ok(())
}

/// Path scope derived from selected owners and direct references before any Git reads.
struct ResourceScope {
    resource_root: RelativePath,
    selected_ids: BTreeSet<String>,
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
        owner_scopes,
        direct_paths,
        resource_scopes,
    })
}

/// Union each selected owner's fixed HEAD, pending and visible worktree paths.
fn owner_paths(
    root: &Root,
    revision: Option<&str>,
    scope: &ResourceScope,
    pending: &git::PendingSnapshot,
    workspace_resources: &[PathBuf],
) -> Result<BTreeSet<PathBuf>, IndexStageError> {
    let head_resources = match revision {
        Some(revision) => git::list_revision_files(root.path(), revision, &scope.owner_scopes)
            .map_err(IndexStageError::Git)?,
        None => Vec::new(),
    };
    let mut owner_paths: BTreeSet<PathBuf> =
        head_resources.into_iter().map(|entry| entry.path).collect();
    let selected_owners: HashSet<&str> = scope.selected_ids.iter().map(String::as_str).collect();
    owner_paths.extend(
        pending
            .entries
            .iter()
            .filter(|entry| is_selected_owner(&entry.path, &scope.resource_root, &selected_owners))
            .map(|entry| entry.path.clone()),
    );
    owner_paths.extend(
        workspace_resources
            .iter()
            .filter(|path| is_selected_owner(path, &scope.resource_root, &selected_owners))
            .cloned(),
    );
    Ok(owner_paths)
}

fn is_selected_owner(
    path: &Path,
    resource_root: &RelativePath,
    selected_ids: &HashSet<&str>,
) -> bool {
    path.strip_prefix(resource_root.as_path())
        .ok()
        .and_then(|path| path.components().next())
        .and_then(|component| component.as_os_str().to_str())
        .is_some_and(|owner| selected_ids.contains(owner))
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
    ) -> Result<(), IndexStageError> {
        let selection = self.selection;
        for path in &selection.all_resource_paths {
            let current = self.capture_file(path)?;
            if selection.direct_paths.contains(path) && current.is_none() {
                return Err(IndexStageError::Selection(
                    "referenced resource is missing".into(),
                ));
            }
            if selection.owner_paths.contains(path) {
                updates.insert(path.clone(), current.clone());
            }
            if self.scope == StageScope::All && selection.direct_paths.contains(path) {
                let owner = path
                    .strip_prefix(selection.resource_root.as_path())
                    .ok()
                    .and_then(|p| p.components().next())
                    .and_then(|c| c.as_os_str().to_str());
                if !owner.is_some_and(|id| selection.selected_ids.contains(id)) {
                    self.verify_foreign(path, &current)?;
                }
            }
        }
        Ok(())
    }

    fn capture_file(&self, path: &Path) -> Result<Option<PendingFile>, IndexStageError> {
        let relative = RelativePath::new(path).map_err(IndexStageError::Source)?;
        let snapshot = source::capture(self.root, &relative).map_err(IndexStageError::Source)?;
        Ok(match snapshot {
            source::ExpectedFile::Present(file) => Some(PendingFile {
                mode: git::workspace_file_mode(
                    self.root,
                    &file,
                    self.pending.membership(),
                    self.selection.file_mode,
                )
                .map_err(IndexStageError::Git)?,
                bytes: file.bytes,
            }),
            source::ExpectedFile::Missing => None,
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn graph_stage_cost_owner_matching_respects_components() {
        let root = RelativePath::new("reports/_resources").unwrap();
        let ids = HashSet::from(["owner"]);
        assert!(is_selected_owner(
            Path::new("reports/_resources/owner/nested/file"),
            &root,
            &ids
        ));
        assert!(is_selected_owner(
            Path::new("reports/_resources/owner"),
            &root,
            &ids
        ));
        assert!(!is_selected_owner(
            Path::new("reports/_resources/owner-other/file"),
            &root,
            &ids
        ));
        assert!(!is_selected_owner(
            Path::new("reports/_resources-other/owner/file"),
            &root,
            &ids
        ));
    }
}
