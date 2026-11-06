//! Decision-specific lifecycle and event constraints over a validated graph.
use super::DecisionState;
use crate::index::{IndexError, IndexV4, RelationEdge, RelationGraph};
use std::collections::{HashMap, HashSet};

type Adjacency<'a> = HashMap<&'a str, Vec<&'a str>>;

pub(super) fn validate(index: &IndexV4<DecisionState>) -> Result<RelationGraph, IndexError> {
    let graph = super::super::build_graph(index.entries.iter().map(|(id, s)| (id, &s.relations)))?;
    for id in index.entries.keys() {
        validate_record(index, &graph, id)?;
    }
    validate_reallocations(&graph)?;
    Ok(graph)
}

fn validate_record(
    index: &IndexV4<DecisionState>,
    graph: &RelationGraph,
    id: &str,
) -> Result<(), IndexError> {
    let edges = graph.outgoing(id);
    for edge in edges {
        if index.entries[&edge.target].status != "archived" {
            return Err(IndexError::Domain(format!(
                "relation target must be archived: {}",
                edge.target
            )));
        }
    }
    if edges.iter().any(|e| e.relation_type == "拆分") && edges.len() != 1 {
        return Err(IndexError::Domain(format!("invalid split relations: {id}")));
    }
    let realloc = edges.iter().filter(|e| e.relation_type == "重划").count();
    if realloc > 0 && realloc != edges.len() {
        return Err(IndexError::Domain(format!(
            "mixed reallocation relations: {id}"
        )));
    }
    if edges.len() == 1 && edges[0].relation_type == "归并" {
        return Err(IndexError::Domain(format!(
            "merge needs two predecessors: {id}"
        )));
    }
    if graph
        .incoming(id)
        .iter()
        .filter(|e| e.relation_type == "拆分")
        .count()
        == 1
    {
        return Err(IndexError::Domain(format!(
            "split needs two successors: {id}"
        )));
    }
    Ok(())
}

fn validate_reallocations(graph: &RelationGraph) -> Result<(), IndexError> {
    let edges = graph
        .nodes()
        .flat_map(|id| graph.outgoing(id))
        .filter(|edge| edge.relation_type == "重划");
    let (by_successor, by_predecessor) = reallocation_adjacency(edges);
    let mut seen = HashSet::new();
    for &first in by_successor.keys() {
        if seen.contains(first) {
            continue;
        }
        let (successors, predecessors) = component(first, &by_successor, &by_predecessor);
        seen.extend(successors.iter().copied());
        if successors.len() < 2 || predecessors.len() < 2 || !successors.is_disjoint(&predecessors)
        {
            return Err(IndexError::Domain("invalid reallocation component".into()));
        }
    }
    Ok(())
}

fn reallocation_adjacency<'a>(
    edges: impl Iterator<Item = &'a RelationEdge>,
) -> (Adjacency<'a>, Adjacency<'a>) {
    let mut by_successor: Adjacency<'a> = HashMap::new();
    let mut by_predecessor: Adjacency<'a> = HashMap::new();
    for edge in edges {
        by_successor
            .entry(&edge.source)
            .or_default()
            .push(&edge.target);
        by_predecessor
            .entry(&edge.target)
            .or_default()
            .push(&edge.source);
    }
    (by_successor, by_predecessor)
}

fn component<'a>(
    first: &'a str,
    by_successor: &Adjacency<'a>,
    by_predecessor: &Adjacency<'a>,
) -> (HashSet<&'a str>, HashSet<&'a str>) {
    let mut successors = HashSet::new();
    let mut predecessors = HashSet::new();
    let mut pending = vec![(true, first)];
    while let Some((successor, id)) = pending.pop() {
        let (visited, adjacency) = if successor {
            (&mut successors, by_successor)
        } else {
            (&mut predecessors, by_predecessor)
        };
        if !visited.insert(id) {
            continue;
        }
        if let Some(neighbors) = adjacency.get(id) {
            pending.extend(neighbors.iter().map(|&next| (!successor, next)));
        }
    }
    (successors, predecessors)
}
