//! Investigation split/merge trace admission units on one validated graph.
use super::trace::{Direction, EventGroup, Kind, Unit, compare_text};
use crate::index::{RelationEdge, RelationGraph};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

struct Event {
    group: Arc<EventGroup>,
    predecessors: Vec<String>,
    successors: Vec<String>,
}
pub(super) struct Events<'a> {
    graph: &'a RelationGraph,
    groups: HashMap<(Kind, String), Event>,
}
impl<'a> Events<'a> {
    pub fn new(graph: &'a RelationGraph) -> Self {
        Self {
            graph,
            groups: HashMap::new(),
        }
    }
    pub fn units(&mut self, id: &str, direction: Direction) -> Vec<Unit> {
        let edges = match direction {
            Direction::Predecessors => self.graph.outgoing(id),
            Direction::Successors => self.graph.incoming(id),
        };
        let mut units = Vec::new();
        let mut seen = HashSet::new();
        for edge in edges {
            let key = event_key(edge);
            if let Some(key) = key {
                if !seen.insert(key.clone()) {
                    continue;
                }
                let event = self
                    .groups
                    .entry(key.clone())
                    .or_insert_with(|| group(self.graph, &key));
                units.push(Unit {
                    group: Arc::clone(&event.group),
                    trace_ids: match direction {
                        Direction::Predecessors => event.predecessors.clone(),
                        Direction::Successors => event.successors.clone(),
                    },
                });
            } else {
                units.push(ordinary(edge, direction));
            }
        }
        units
    }
}
fn event_key(edge: &RelationEdge) -> Option<(Kind, String)> {
    match edge.relation_type.as_str() {
        "拆分" => Some((Kind::Split, edge.target.clone())),
        "归并" => Some((Kind::Merge, edge.source.clone())),
        _ => None,
    }
}
fn group(graph: &RelationGraph, key: &(Kind, String)) -> Event {
    let (predecessors, successors) = if key.0 == Kind::Split {
        (
            vec![key.1.clone()],
            graph
                .incoming(&key.1)
                .iter()
                .filter(|e| e.relation_type == "拆分")
                .map(|e| e.source.clone())
                .collect::<Vec<_>>(),
        )
    } else {
        (
            graph
                .outgoing(&key.1)
                .iter()
                .filter(|e| e.relation_type == "归并")
                .map(|e| e.target.clone())
                .collect::<Vec<_>>(),
            vec![key.1.clone()],
        )
    };
    let mut members = predecessors.clone();
    members.extend(successors.iter().cloned());
    members.sort_by(|a, b| compare_text(a, b));
    members.dedup();
    Event {
        group: Arc::new(EventGroup {
            kind: key.0,
            record_ids: members,
        }),
        predecessors,
        successors,
    }
}
fn ordinary(edge: &RelationEdge, direction: Direction) -> Unit {
    let mut members = vec![edge.source.clone(), edge.target.clone()];
    members.sort_by(|a, b| compare_text(a, b));
    members.dedup();
    Unit {
        group: Arc::new(EventGroup {
            kind: Kind::Ordinary,
            record_ids: members,
        }),
        trace_ids: vec![match direction {
            Direction::Predecessors => edge.target.clone(),
            Direction::Successors => edge.source.clone(),
        }],
    }
}
