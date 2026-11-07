//! Decision source staging with conservative locator requirements.
//! Selected and known paths only; unsupported pending-only locators fail closed
//! rather than scanning unrelated blobs.
use super::{
    StageScope,
    index_scope::{
        IndexStageError, IndexStageResult, Phase, Preservation, acquire, decision_pending_basename,
        validate_scope,
    },
    publication::SourcePublication,
    reporting::StageReport,
    source_capture::{FileMode, SourceCapture, finish_updates, pending_for_sources, stage_indexes},
};
use crate::{
    domains::decision::{DecisionState, Definition, parse_established},
    git::{self, ContentSnapshot, publish::PendingUpdate},
    index::ValidatedIndex,
    source::{self, RelativePath, Root},
    source_revision,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
};

mod discovery;
use discovery::{acquire_with_pending_locator, selected_source_paths};

struct DecisionPhase {
    base: Phase,
    pending: ContentSnapshot,
    updates: Vec<PendingUpdate>,
}

/// Stage established Decision sources, optionally with the selected index.
/// This entry is deliberately conservative and is not a claim of complete CLI
/// compatibility; pending-only identities without a trusted locator fail closed.
pub fn stage_decisions(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
    scope: StageScope,
) -> Result<IndexStageResult, IndexStageError> {
    if scope == StageScope::Index || selectors.is_empty() {
        return Err(IndexStageError::Selection(
            "decision source stage requires all/domain and selectors".into(),
        ));
    }
    let domain = Definition;
    let (revision, head) = super::index_scope::capture_baseline(root, index_path, &domain)?;
    let before = prepare(root, index_path, selectors, scope, head.as_ref())?;
    validate_scope(index_path, before.pending.membership())?;
    let report = StageReport::for_sources(
        Preservation {
            root,
            revision: revision.as_deref(),
            index_path,
            namespace: "decisions",
        },
        scope,
        &before.pending,
        &before.updates,
    )?;
    let replaced = SourcePublication {
        root,
        pending: &before.pending,
        updates: &before.updates,
    }
    .publish()?;
    Ok(report.finish(before.base.selected, &before.pending, replaced))
}
fn prepare(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
    scope: StageScope,
    head: Option<&ValidatedIndex<DecisionState>>,
) -> Result<DecisionPhase, IndexStageError> {
    let definition = Definition;
    let base = acquire_with_pending_locator(root, index_path, selectors, scope, head)?;
    let (workspace, pending_index) = stage_indexes(&base, index_path, &definition, scope)?;
    let ids: BTreeSet<&str> = base.selected.iter().map(String::as_str).collect();
    let (paths, selected_paths) = selected_source_paths(
        index_path,
        selectors,
        &base,
        [head, pending_index.as_ref(), Some(&workspace)],
    )?;
    let read_paths = selected_paths.clone();
    let pending = pending_for_sources(root, index_path, &base, read_paths)?;
    let updates = SourceCapture {
        root,
        index_path,
        workspace: &workspace,
        ids: &ids,
        paths: &paths,
        selected_paths: &selected_paths,
        pending: &pending,
        source_path: |state: &DecisionState| &state.source_path,
        verify: verify_source,
        identity: crate::domains::decision::id_from_markdown,
        mode: FileMode::Fixed,
    }
    .capture()?;
    let updates = finish_updates(scope, index_path, &base.target, updates);
    let phase = DecisionPhase {
        base,
        pending,
        updates,
    };
    Ok(phase)
}

/// Bind an observed source document to the selected validated index entry.
fn verify_source(
    source: &source::SourceSnapshot,
    id: &str,
    state: &DecisionState,
    workspace: &ValidatedIndex<DecisionState>,
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
            source_revision::Domain::Decision,
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
