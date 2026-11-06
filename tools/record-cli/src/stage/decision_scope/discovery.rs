use super::*;
use crate::stage::index_scope::Acquisition;
use crate::stage::source_capture::{selected_owned_paths, source_owners};

type SourcePaths = (BTreeMap<PathBuf, BTreeSet<String>>, Vec<PathBuf>);

/// Resolve pending-only selectors from literal candidate paths without reading unrelated blobs.
pub(super) fn acquire_with_pending_locator(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
    scope: StageScope,
    head: Option<&ValidatedIndex<DecisionState>>,
) -> Result<(Phase, Option<ContentSnapshot>), IndexStageError> {
    let definition = Definition;

    let base = match acquire(
        root,
        index_path,
        &definition,
        head,
        Acquisition {
            selectors,
            name: decision_name,
            scope,
            extra_ids: &[],
        },
    ) {
        Ok(base) => base,
        Err(IndexStageError::SelectorUnresolved { .. }) => {
            let (snapshot, extra_ids) = pending_locator(root, index_path, selectors)?;
            let base = acquire(
                root,
                index_path,
                &definition,
                head,
                Acquisition {
                    selectors,
                    name: decision_name,
                    scope,
                    extra_ids: &extra_ids,
                },
            )?;
            return Ok((base, Some(snapshot)));
        }
        Err(error) => return Err(error),
    };
    Ok((base, None))
}

/// Identify only literal pending candidates and bind their IDs to captured membership.
fn pending_locator(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
) -> Result<(ContentSnapshot, Vec<String>), IndexStageError> {
    let metadata = git::read_pending(root.path()).map_err(IndexStageError::Git)?;
    let paths: Vec<_> = metadata
        .entries
        .iter()
        .filter_map(|entry| {
            let name = decision_pending_basename(index_path.as_path(), &entry.path)?;
            selectors
                .iter()
                .any(|selector| selector == name || selector == crate::domains::name_from_id(name))
                .then_some(entry.path.clone())
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let snapshot = git::read_selected(root.path(), &paths).map_err(IndexStageError::Git)?;
    if snapshot.membership() != &metadata {
        return Err(IndexStageError::Drift);
    }
    let mut extra_ids = Vec::new();
    for (_, bytes) in snapshot.blobs() {
        let text = std::str::from_utf8(bytes)
            .map_err(|_| IndexStageError::Selection("pending source is not UTF-8".into()))?;
        let id = crate::domains::decision::id_from_markdown(text)
            .ok_or_else(|| IndexStageError::Selection("pending source lacks identity".into()))?;
        extra_ids.push(id);
    }
    Ok((snapshot, extra_ids))
}

/// Resolve source ownership from trusted indices and literal pending names before reading blobs.
pub(super) fn selected_source_paths(
    index_path: &RelativePath,
    selectors: &[String],
    base: &Phase,
    indexes: [Option<&ValidatedIndex<DecisionState>>; 3],
) -> Result<SourcePaths, IndexStageError> {
    let ids: BTreeSet<&str> = base.selected.iter().map(String::as_str).collect();
    let mut paths = source_owners(index_path, indexes, |state: &DecisionState| {
        &state.source_path
    })?;
    // Literal basename candidates identify only potentially selected pending
    // paths; their bytes are subsequently read and must confirm the identity.
    for entry in &base.pending.membership().entries {
        let Some(basename) = decision_pending_basename(index_path.as_path(), &entry.path) else {
            continue;
        };
        for id in &base.selected {
            if basename == id
                || selectors.iter().any(|selector| {
                    selector == basename && crate::domains::name_from_id(id) == basename
                })
            {
                paths
                    .entry(entry.path.clone())
                    .or_default()
                    .insert(id.clone());
            }
        }
    }
    let selected_paths = selected_owned_paths(&paths, &ids)?;
    Ok((paths, selected_paths))
}

fn decision_name(state: &DecisionState) -> &str {
    &state.name
}
