use super::*;
use crate::stage::source_capture::{selected_owned_paths, source_owners};

type SourcePaths = (BTreeMap<PathBuf, BTreeSet<String>>, Vec<PathBuf>);

/// Read only literal pending candidates and bind their identities to membership.
pub(super) fn discover_pending_reports(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
) -> Result<BTreeMap<PathBuf, String>, IndexStageError> {
    let metadata = git::read_pending(root.path()).map_err(IndexStageError::Git)?;
    validate_scope(index_path, &metadata)?;
    let locator_paths = candidate_paths(index_path, selectors, &metadata);
    let locator = git::read_selected(root.path(), &locator_paths).map_err(IndexStageError::Git)?;
    validate_candidate_modes(&locator_paths, &metadata)?;
    let mut locator_ids = BTreeMap::new();
    for (path, bytes) in locator.blobs() {
        let text = std::str::from_utf8(bytes)
            .map_err(|_| IndexStageError::Selection("pending report is not UTF-8".into()))?;
        let id = crate::domains::investigation::id_from_markdown(text)
            .ok_or_else(|| IndexStageError::Selection("pending report lacks identity".into()))?;
        locator_ids.insert(path.clone(), id);
    }
    Ok(locator_ids)
}

/// Limit candidate inspection to matching literal report names.
fn candidate_paths(
    index_path: &RelativePath,
    selectors: &[String],
    metadata: &git::PendingSnapshot,
) -> Vec<PathBuf> {
    let domain_dir = index_path
        .as_path()
        .parent()
        .unwrap_or_else(|| Path::new(""));
    let mut locator_paths = Vec::new();
    for entry in &metadata.entries {
        let Ok(relative) = entry.path.strip_prefix(domain_dir) else {
            continue;
        };
        if relative.components().count() != 1 {
            continue;
        }
        let Some(stem) = relative.to_str().and_then(|text| text.strip_suffix(".md")) else {
            continue;
        };
        if selectors
            .iter()
            .any(|selector| selector == stem || selector == crate::domains::name_from_id(stem))
        {
            locator_paths.push(entry.path.clone());
        }
    }
    locator_paths.sort();
    locator_paths.dedup();
    locator_paths
}

/// Pending report candidates must have regular file representations.
fn validate_candidate_modes(
    paths: &[PathBuf],
    metadata: &git::PendingSnapshot,
) -> Result<(), IndexStageError> {
    for path in paths {
        if metadata
            .entries
            .iter()
            .find(|entry| &entry.path == path)
            .is_some_and(|entry| !matches!(entry.mode, 0o100644 | 0o100755))
        {
            return Err(IndexStageError::Selection(
                "pending report is not a regular file".into(),
            ));
        }
    }
    Ok(())
}

/// Select source paths only when all observed owners belong to this selection.
pub(super) fn selected_source_paths(
    index_path: &RelativePath,
    base: &Phase,
    indexes: [Option<&ValidatedIndex<InvestigationState>>; 3],
    locator_ids: &BTreeMap<PathBuf, String>,
) -> Result<SourcePaths, IndexStageError> {
    let ids: BTreeSet<&str> = base.selected.iter().map(String::as_str).collect();
    let mut paths = source_owners(index_path, indexes, |state: &InvestigationState| {
        &state.source_path
    })?;
    for (path, id) in locator_ids {
        paths.entry(path.clone()).or_default().insert(id.clone());
    }
    let selected_paths = selected_owned_paths(&paths, &ids)?;
    Ok((paths, selected_paths))
}
