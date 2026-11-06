//! Decision trace event membership, built once from a validated graph.
use super::trace::{Direction, EventGroup, Kind, Unit, compare_text};
use crate::index::{RelationEdge, RelationGraph};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
type Event = (Arc<EventGroup>, Arc<HashSet<String>>);
pub struct Events<'a> {
    graph: &'a RelationGraph,
    splits: HashMap<String, Event>,
    merges: HashMap<String, Event>,
    reallocations: HashMap<String, Event>,
}
fn event(kind: Kind, ids: impl IntoIterator<Item = String>) -> Event {
    let set: HashSet<_> = ids.into_iter().collect();
    let mut members: Vec<_> = set.iter().cloned().collect();
    members.sort_by(|a, b| compare_text(a, b));
    (
        Arc::new(EventGroup {
            kind,
            record_ids: members,
        }),
        Arc::new(set),
    )
}
// Only directly adjacent records are traversed, even though the full event
// membership is retained for atomic budget admission.
fn direct_unit((group, members): Event, direct: &HashSet<String>) -> Unit {
    let trace_ids = if direct.len() < members.len() {
        direct
            .iter()
            .filter(|id| members.contains(*id))
            .cloned()
            .collect()
    } else {
        members
            .iter()
            .filter(|id| direct.contains(*id))
            .cloned()
            .collect()
    };
    Unit { group, trace_ids }
}
fn reallocation_events(graph: &RelationGraph) -> HashMap<String, Event> {
    let mut result = HashMap::new();
    let mut visited_successors = HashSet::new();
    let mut visited_predecessors = HashSet::new();
    for source in graph.nodes() {
        if visited_successors.contains(source)
            || !graph
                .outgoing(source)
                .iter()
                .any(|e| e.relation_type == "重划")
        {
            continue;
        }
        let (successors, members) = reallocation_component(
            graph,
            source,
            &mut visited_successors,
            &mut visited_predecessors,
        );
        let group = event(Kind::Reallocation, members);
        for id in successors {
            result.insert(id, group.clone());
        }
    }
    result
}

fn reallocation_component(
    graph: &RelationGraph,
    source: &str,
    visited_successors: &mut HashSet<String>,
    visited_predecessors: &mut HashSet<String>,
) -> (Vec<String>, Vec<String>) {
    let mut stack = vec![(true, source.to_owned())];
    let mut successors = Vec::new();
    let mut members = Vec::new();
    while let Some((successor, id)) = stack.pop() {
        let visited = if successor {
            &mut *visited_successors
        } else {
            &mut *visited_predecessors
        };
        if !visited.insert(id.clone()) {
            continue;
        }
        if successor {
            successors.push(id.clone());
        }
        members.push(id.clone());
        let edges = if successor {
            graph.outgoing(&id)
        } else {
            graph.incoming(&id)
        };
        for edge in edges.iter().filter(|e| e.relation_type == "重划") {
            let neighbor = if successor {
                &edge.target
            } else {
                &edge.source
            };
            stack.push((!successor, neighbor.clone()));
        }
    }
    (successors, members)
}

impl<'a> Events<'a> {
    pub fn new(graph: &'a RelationGraph) -> Self {
        let reallocations = reallocation_events(graph);
        Self {
            graph,
            splits: HashMap::new(),
            merges: HashMap::new(),
            reallocations,
        }
    }
    pub fn units(&mut self, id: &str, direction: Direction) -> Vec<Unit> {
        let graph = self.graph;
        let edges = match direction {
            Direction::Predecessors => graph.outgoing(id),
            Direction::Successors => graph.incoming(id),
        };
        let direct: HashSet<String> = edges
            .iter()
            .map(|e| match direction {
                Direction::Predecessors => e.target.clone(),
                Direction::Successors => e.source.clone(),
            })
            .collect();
        let mut units = Vec::new();
        let mut selected: HashMap<*const EventGroup, Event> = HashMap::new();
        for edge in edges {
            let found = self.group_for_edge(edge);
            if let Some(group) = found {
                selected.insert(Arc::as_ptr(&group.0), group);
            } else {
                let (group, _) = event(Kind::Ordinary, [edge.source.clone(), edge.target.clone()]);
                units.push(Unit {
                    group,
                    trace_ids: vec![match direction {
                        Direction::Predecessors => edge.target.clone(),
                        Direction::Successors => edge.source.clone(),
                    }],
                });
            }
        }
        units.extend(
            selected
                .into_values()
                .map(|event| direct_unit(event, &direct)),
        );
        units
    }
    fn group_for_edge(&mut self, edge: &RelationEdge) -> Option<Event> {
        match edge.relation_type.as_str() {
            "拆分" => Some(
                self.splits
                    .entry(edge.target.clone())
                    .or_insert_with(|| {
                        event(
                            Kind::Split,
                            std::iter::once(edge.target.clone()).chain(
                                self.graph
                                    .incoming(&edge.target)
                                    .iter()
                                    .filter(|e| e.relation_type == "拆分")
                                    .map(|e| e.source.clone()),
                            ),
                        )
                    })
                    .clone(),
            ),
            "归并" => Some(
                self.merges
                    .entry(edge.source.clone())
                    .or_insert_with(|| {
                        event(
                            Kind::Merge,
                            std::iter::once(edge.source.clone()).chain(
                                self.graph
                                    .outgoing(&edge.source)
                                    .iter()
                                    .filter(|e| e.relation_type == "归并")
                                    .map(|e| e.target.clone()),
                            ),
                        )
                    })
                    .clone(),
            ),
            "重划" => self.reallocations.get(&edge.source).cloned(),
            _ => None,
        }
    }
}
