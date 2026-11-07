//! Investigation stage for selected reports and managed resources.
use super::{
    StageScope,
    index_scope::{
        Acquisition, IndexStageError, IndexStageResult, Phase, Preservation, acquire,
        validate_scope,
    },
    publication::SourcePublication,
    reporting::StageReport,
    source_capture::{FileMode, SourceCapture, finish_updates, pending_for_sources, stage_indexes},
};
use crate::{
    domains::investigation::{Definition, InvestigationState, parse_established},
    git::{
        self, ContentSnapshot,
        publish::{PendingFile, PendingUpdate},
    },
    index::ValidatedIndex,
    source::{self, RelativePath, Root},
    source_revision,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
};

mod discovery;
mod freshness;
use freshness::verify_source;
mod resource_selection;
use discovery::{discover_pending_reports, selected_source_paths};
use resource_selection::{ResourceCapture, ResourceSelection, select_resources};

struct InvestigationPhase {
    base: Phase,
    pending: ContentSnapshot,
    updates: Vec<PendingUpdate>,
}

/// Stage established Investigation sources and their selected owners' managed
/// resources. Pending-only report identities without a trusted locator fail closed.
pub fn stage_investigations(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
    scope: StageScope,
) -> Result<IndexStageResult, IndexStageError> {
    if scope == StageScope::Index || selectors.is_empty() {
        return Err(IndexStageError::Selection(
            "investigation source stage requires all/domain and selectors".into(),
        ));
    }
    let domain = Definition;
    let (revision, head) = super::index_scope::capture_baseline(root, index_path, &domain)?;
    let baseline = HistoricalBaseline {
        index: head.as_ref(),
        revision: revision.as_deref(),
    };
    let before = prepare(root, index_path, selectors, scope, baseline)?;
    validate_scope(index_path, before.pending.membership())?;
    let report = StageReport::for_sources(
        Preservation {
            root,
            revision: revision.as_deref(),
            index_path,
            namespace: "investigations",
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
#[derive(Clone, Copy)]
struct HistoricalBaseline<'a> {
    index: Option<&'a ValidatedIndex<InvestigationState>>,
    revision: Option<&'a str>,
}

fn prepare(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
    scope: StageScope,
    baseline: HistoricalBaseline<'_>,
) -> Result<InvestigationPhase, IndexStageError> {
    let HistoricalBaseline {
        index: head,
        revision,
    } = baseline;
    let ReportAcquisition {
        base,
        locator_ids,
        workspace,
        pending_index,
    } = acquire_report_inputs(root, index_path, selectors, scope, head)?;
    let selection = select_resources(root, index_path, &base, &workspace, revision)?;
    let reports = ReportSources {
        root,
        index_path,
        base: &base,
        workspace: &workspace,
        head,
        pending_index: pending_index.as_ref(),
        locator_ids: &locator_ids,
        resources: &selection,
    }
    .capture()?;
    PhaseAssembly {
        root,
        index_path,
        scope,
    }
    .finish(base, selection, reports)
}

/// Assemble the selected resource updates.
struct PhaseAssembly<'a> {
    root: &'a Root,
    index_path: &'a RelativePath,
    scope: StageScope,
}
impl PhaseAssembly<'_> {
    fn finish(
        &self,
        base: Phase,
        selection: ResourceSelection,
        reports: CapturedReports,
    ) -> Result<InvestigationPhase, IndexStageError> {
        let Self {
            root,
            index_path,
            scope,
        } = *self;
        let CapturedReports {
            pending,
            mut updates,
        } = reports;
        ResourceCapture {
            root,
            selection: &selection,
            pending: &pending,
            scope,
        }
        .capture(&mut updates)?;
        let updates = finish_updates(scope, index_path, &base.target, updates);
        let phase = InvestigationPhase {
            base,
            pending,
            updates,
        };
        Ok(phase)
    }
}

/// Index and literal-locator evidence captured before report or resource payloads.
struct ReportAcquisition {
    base: Phase,
    locator_ids: BTreeMap<PathBuf, String>,
    workspace: ValidatedIndex<InvestigationState>,
    pending_index: Option<ValidatedIndex<InvestigationState>>,
}
fn acquire_report_inputs(
    root: &Root,
    index_path: &RelativePath,
    selectors: &[String],
    scope: StageScope,
    head: Option<&ValidatedIndex<InvestigationState>>,
) -> Result<ReportAcquisition, IndexStageError> {
    let definition = Definition;
    let locator_ids = discover_pending_reports(root, index_path, selectors)?;
    let extra_ids: Vec<_> = locator_ids.values().cloned().collect();
    let base = acquire(
        root,
        index_path,
        &definition,
        head,
        Acquisition {
            selectors,
            name: investigation_name,
            scope,
            extra_ids: &extra_ids,
        },
    )?;
    let (workspace, pending_index) = stage_indexes(&base, index_path, &definition, scope)?;
    Ok(ReportAcquisition {
        base,
        locator_ids,
        workspace,
        pending_index,
    })
}

/// The selected report read is bound to the phase's locator, indexes and resource scope.
struct ReportSources<'a> {
    root: &'a Root,
    index_path: &'a RelativePath,
    base: &'a Phase,
    workspace: &'a ValidatedIndex<InvestigationState>,
    head: Option<&'a ValidatedIndex<InvestigationState>>,
    pending_index: Option<&'a ValidatedIndex<InvestigationState>>,
    locator_ids: &'a BTreeMap<PathBuf, String>,
    resources: &'a ResourceSelection,
}
struct CapturedReports {
    pending: ContentSnapshot,
    updates: BTreeMap<PathBuf, Option<PendingFile>>,
}
impl ReportSources<'_> {
    fn capture(self) -> Result<CapturedReports, IndexStageError> {
        let Self {
            root,
            index_path,
            base,
            workspace,
            head,
            pending_index,
            locator_ids,
            resources: selection,
        } = self;
        let ids: BTreeSet<&str> = base.selected.iter().map(String::as_str).collect();
        let (paths, selected_paths) = selected_source_paths(
            index_path,
            base,
            [head, pending_index, Some(workspace)],
            locator_ids,
        )?;
        let mut read_paths = selected_paths.clone();
        read_paths.extend(selection.all_resource_paths.iter().cloned());
        let pending = pending_for_sources(root, index_path, base, read_paths)?;
        let updates = SourceCapture {
            root,
            index_path,
            workspace,
            ids: &ids,
            paths: &paths,
            selected_paths: &selected_paths,
            pending: &pending,
            source_path: |state: &InvestigationState| &state.source_path,
            verify: verify_source,
            identity: crate::domains::investigation::id_from_markdown,
            mode: FileMode::Git(selection.file_mode),
        }
        .capture()?;
        Ok(CapturedReports { pending, updates })
    }
}

fn investigation_name(state: &InvestigationState) -> &str {
    &state.name
}
