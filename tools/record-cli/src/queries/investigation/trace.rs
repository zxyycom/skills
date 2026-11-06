use super::*;

pub use super::super::trace::{TraceCoverage, TraceDepth, TraceLimits};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEntry {
    pub title: String,
    pub formed_at: String,
    pub question: String,
    pub tags: Vec<String>,
    pub relations: Vec<crate::domains::Relation>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceResult {
    pub status: &'static str,
    pub anchor_id: String,
    pub direction: super::super::trace::RequestedDirection,
    pub limits: TraceLimits,
    pub coverage: TraceCoverage,
    pub trace_ids: Vec<String>,
    pub context_ids: Vec<String>,
    pub frontier: Vec<super::super::trace::Frontier>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked_event: Option<super::super::trace::BlockedEvent>,
    pub entries: std::collections::BTreeMap<String, TraceEntry>,
    pub warnings: Vec<String>,
}
/// Selects a bounded trace on one complete, validated published graph.
pub fn project_trace(
    snapshot: &QuerySnapshot<InvestigationState>,
    options: &TraceOptions,
) -> Result<TraceResult, String> {
    use super::super::trace;
    let limits = options.selection_limits()?;
    let (anchor, _) = crate::domains::resolve_selector(
        &snapshot.index().index().entries,
        &options.selector,
        |state| &state.name,
    )
    .map_err(|error| super::super::selector_message(&options.selector, error))?;
    let graph = snapshot
        .graph(&crate::domains::investigation::Definition)
        .map_err(|error| error.to_string())?;
    let mut events = super::super::investigation_events::Events::new(graph);
    let selection = trace::select(
        anchor,
        options.direction,
        limits,
        |id, dir| events.units(id, dir),
        |id, dir| trace::neighbors(graph, id, dir),
    );
    let entries = trace_entries(snapshot, &selection)?;
    let complete = selection.stopped_by.is_empty() && selection.blocked_event.is_none();
    Ok(TraceResult {
        status: "ok",
        anchor_id: anchor.to_owned(),
        direction: options.direction,
        limits: TraceLimits::from(options),
        coverage: TraceCoverage {
            complete,
            stopped_by: selection.stopped_by,
        },
        trace_ids: selection.trace_ids,
        context_ids: selection.context_ids,
        frontier: selection.frontier,
        blocked_event: selection.blocked_event,
        entries,
        warnings: vec![],
    })
}

fn trace_entries(
    snapshot: &QuerySnapshot<InvestigationState>,
    selection: &super::super::trace::Selection,
) -> Result<std::collections::BTreeMap<String, TraceEntry>, String> {
    let mut entries = std::collections::BTreeMap::new();
    for id in selection.trace_ids.iter().chain(&selection.context_ids) {
        let state = snapshot
            .get(id)
            .ok_or_else(|| format!("validated trace member missing: {id}"))?;
        entries.insert(
            id.clone(),
            TraceEntry {
                title: state.title.clone(),
                formed_at: state.formed_at.clone(),
                question: state.question.clone(),
                tags: state.tags.clone(),
                relations: state.relations.clone(),
            },
        );
    }
    Ok(entries)
}
