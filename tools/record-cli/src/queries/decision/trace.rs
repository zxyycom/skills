use super::*;

pub use super::super::trace::{TraceCoverage, TraceDepth, TraceLimits};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEntry {
    pub title: String,
    pub status: String,
    pub alignment: String,
    pub created_at: String,
    pub purpose: String,
    pub background: String,
    pub decision: String,
    pub tags: Vec<String>,
    pub relations: Vec<Relation>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceResult {
    pub status: &'static str,
    pub source: Source,
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
}
pub fn project_trace(
    snapshot: &QuerySnapshot<DecisionState>,
    options: &TraceOptions,
) -> Result<TraceResult, String> {
    use super::super::trace;
    let limits = options.selection_limits()?;
    let (anchor, _) = crate::domains::resolve_selector(
        &snapshot.index().index().entries,
        &options.selector,
        |s| &s.name,
    )
    .map_err(|e| super::super::selector_message(&options.selector, e))?;
    let graph = snapshot
        .graph(&crate::domains::decision::Definition)
        .map_err(|e| e.to_string())?;
    let mut events = super::super::decision_events::Events::new(graph);
    let selection = trace::select(
        anchor,
        options.direction,
        limits,
        |id, dir| events.units(id, dir),
        |id, dir| trace::neighbors(graph, id, dir),
    );
    let entries = trace_entries(snapshot, &selection)?;
    Ok(trace_result(anchor, options, selection, entries))
}

// Render the Decision-specific trace envelope without changing event selection.
fn trace_result(
    anchor: &str,
    options: &TraceOptions,
    selection: super::super::trace::Selection,
    entries: std::collections::BTreeMap<String, TraceEntry>,
) -> TraceResult {
    let complete = selection.stopped_by.is_empty() && selection.blocked_event.is_none();
    TraceResult {
        status: "ok",
        source: Source {
            kind: "published-index",
            currentness: "unchecked",
            fallback: false,
        },
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
    }
}

fn trace_entries(
    snapshot: &QuerySnapshot<DecisionState>,
    selection: &super::super::trace::Selection,
) -> Result<std::collections::BTreeMap<String, TraceEntry>, String> {
    let mut entries = std::collections::BTreeMap::new();
    for id in selection.trace_ids.iter().chain(&selection.context_ids) {
        let s = snapshot
            .get(id)
            .ok_or_else(|| format!("validated trace member missing: {id}"))?;
        entries.insert(
            id.clone(),
            TraceEntry {
                title: s.title.clone(),
                status: s.status.clone(),
                alignment: s.alignment.clone(),
                created_at: s.created_at.clone(),
                purpose: s.purpose.clone(),
                background: s.background.clone(),
                decision: s.decision.clone(),
                tags: s.tags.clone(),
                relations: s.relations.clone(),
            },
        );
    }
    Ok(entries)
}
