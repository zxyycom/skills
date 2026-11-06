//! Bounded breadth-first selection of complete domain relation events.
//!
//! Domain adapters supply admission units for a node and direction. An event's
//! context is included atomically, but only direct targets are traversed.
use serde::Serialize;
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Predecessors,
    Successors,
}
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Ordinary,
    Split,
    Merge,
    Reallocation,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventGroup {
    pub kind: Kind,
    pub record_ids: Vec<String>,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unit {
    pub group: Arc<EventGroup>,
    pub trace_ids: Vec<String>,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RequestedDirection {
    Both,
    Predecessors,
    Successors,
}
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Reason {
    Depth,
    MaxRecords,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frontier {
    pub from_id: String,
    pub direction: Direction,
    pub reason: Reason,
    pub next_ids: Vec<String>,
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockedEvent {
    pub kind: Kind,
    pub record_ids: Vec<String>,
    pub required_max_records: usize,
}
/// The bounded trace output contract shared by both domains.
#[derive(Serialize)]
#[serde(untagged)]
pub enum TraceDepth {
    All(&'static str),
    Limited(u64),
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceLimits {
    pub depth: TraceDepth,
    pub max_records: u64,
}
impl From<&super::options::TraceOptions> for TraceLimits {
    fn from(options: &super::options::TraceOptions) -> Self {
        Self {
            depth: options
                .depth
                .map_or(TraceDepth::All("all"), TraceDepth::Limited),
            max_records: options.max_records,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceCoverage {
    pub complete: bool,
    pub stopped_by: Vec<Reason>,
}

/// Direct neighbors for a direction in the already validated relation graph.
pub(crate) fn neighbors(
    graph: &crate::index::RelationGraph,
    id: &str,
    direction: Direction,
) -> Vec<String> {
    match direction {
        Direction::Predecessors => graph
            .outgoing(id)
            .iter()
            .map(|edge| edge.target.clone())
            .collect(),
        Direction::Successors => graph
            .incoming(id)
            .iter()
            .map(|edge| edge.source.clone())
            .collect(),
    }
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Selection {
    pub trace_ids: Vec<String>,
    pub context_ids: Vec<String>,
    pub frontier: Vec<Frontier>,
    pub blocked_event: Option<BlockedEvent>,
    pub stopped_by: Vec<Reason>,
}

/// Match JavaScript string comparison rather than Rust's UTF-8 scalar ordering.
pub fn compare_text(a: &str, b: &str) -> Ordering {
    a.encode_utf16().cmp(b.encode_utf16())
}
pub(super) fn sort_ids(ids: &mut [String]) {
    ids.sort_by(|a, b| compare_text(a, b));
}

mod frontier;
mod selection;
pub use selection::{SelectionLimits, select};

#[cfg(test)]
mod tests;
