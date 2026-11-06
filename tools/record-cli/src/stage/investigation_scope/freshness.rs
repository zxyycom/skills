use super::*;

pub(super) fn check_sources(
    root: &Root,
    index_path: &RelativePath,
    phase: &InvestigationPhase,
    after_commit: bool,
    verify_mode: bool,
) -> Result<(), FreshnessError> {
    if verify_mode
        && git::core_file_mode(root.path()).map_err(|_| FreshnessError::Read)? != phase.file_mode
    {
        return Err(FreshnessError::Drift);
    }
    check_membership(root, phase, after_commit)?;
    check_resource_trees(root, phase)?;
    super::super::source_capture::check_document_sources(
        root,
        index_path,
        &phase.base.workspace,
        &phase.sources,
    )
}

/// Confirm visible Git membership, accounting for the updates already published.
fn check_membership(
    root: &Root,
    phase: &InvestigationPhase,
    after_commit: bool,
) -> Result<(), FreshnessError> {
    let mut expected_resources = phase.workspace_resources.clone();
    if after_commit {
        for update in &phase.updates {
            if !phase
                .resource_scopes
                .iter()
                .any(|scope| update.path.starts_with(scope))
            {
                continue;
            }
            if update.file.is_some() {
                expected_resources.push(update.path.clone());
            } else {
                expected_resources.retain(|path| *path != update.path);
            }
        }
        expected_resources.sort();
        expected_resources.dedup();
    }
    if git::list_repository_workspace_files(root.path(), &phase.resource_scopes)
        .map_err(|_| FreshnessError::Read)?
        != expected_resources
    {
        return Err(FreshnessError::Drift);
    }
    Ok(())
}

/// Re-observe owner directories and only the selected resource payloads.
fn check_resource_trees(root: &Root, phase: &InvestigationPhase) -> Result<(), FreshnessError> {
    for resource in &phase.resources {
        let directories =
            source::capture_resource_directories(root, &phase.resource_root, &resource.owner)
                .map_err(|_| FreshnessError::Read)?;
        if !directories.equivalent(&resource.directories) {
            return Err(FreshnessError::Drift);
        }
        if directories.owner_exists() {
            let owner =
                RelativePath::new(phase.resource_root.as_path().join(resource.owner.as_path()))
                    .map_err(|_| FreshnessError::Read)?;
            let tree = source::capture_selected_tree(root, &owner, &resource.members)
                .map_err(|_| FreshnessError::Read)?;
            if !resource
                .tree
                .as_ref()
                .is_some_and(|expected| expected.equivalent(&tree))
            {
                return Err(FreshnessError::Drift);
            }
        } else if resource.tree.is_some() {
            return Err(FreshnessError::Drift);
        }
    }
    Ok(())
}

/// Bind an observed report to its selected validated index entry.
pub(super) fn verify_source(
    source: &source::SourceSnapshot,
    id: &str,
    state: &InvestigationState,
    workspace: &ValidatedIndex<InvestigationState>,
) -> Result<(), IndexStageError> {
    let parsed = parse_established(&source.bytes, id, &state.source_path).map_err(|reason| {
        IndexStageError::SelectedSource {
            id: id.to_owned(),
            path: source.path.as_path().to_owned(),
            issue: crate::stage::index_scope::SelectedSourceIssue::Invalid(reason),
        }
    })?;
    if parsed.state != *state
        || source_revision::fingerprint(
            source_revision::Domain::Investigation,
            id,
            &state.source_path,
            &parsed.markdown,
        ) != workspace.index().source_revision.entries[id]
    {
        return Err(IndexStageError::SelectedSource {
            id: id.to_owned(),
            path: source.path.as_path().to_owned(),
            issue: crate::stage::index_scope::SelectedSourceIssue::StaleIndex,
        });
    }
    Ok(())
}
