use super::Relation;
use crate::index::{IndexError, RelationEdge, RelationGraph};
use std::collections::{BTreeMap, HashSet};

type Edges = BTreeMap<String, Vec<RelationEdge>>;

pub(super) fn build_graph<'a>(
    entries: impl Iterator<Item = (&'a String, &'a Vec<Relation>)>,
) -> Result<crate::index::RelationGraph, crate::index::IndexError> {
    let entries: Vec<_> = entries.collect();
    let nodes: Vec<_> = entries.iter().map(|(id, _)| (*id).clone()).collect();
    let ids: HashSet<_> = nodes.iter().map(String::as_str).collect();
    let mut outgoing: Edges = BTreeMap::new();
    let mut incoming: Edges = BTreeMap::new();
    for (source, relations) in entries {
        let mut targets = HashSet::new();
        for r in relations {
            if source == &r.target || !ids.contains(r.target.as_str()) || !targets.insert(&r.target)
            {
                return Err(IndexError::Domain(format!(
                    "invalid relation from {source} to {}",
                    r.target
                )));
            }
            let edge = RelationEdge {
                source: source.clone(),
                target: r.target.clone(),
                relation_type: r.relation_type.clone(),
                summary: r.summary.clone(),
            };
            outgoing
                .entry(source.clone())
                .or_default()
                .push(edge.clone());
            incoming.entry(r.target.clone()).or_default().push(edge);
        }
    }
    validate_acyclic(&nodes, &incoming, &outgoing)?;
    sort_edges(&mut outgoing, &mut incoming);
    Ok(RelationGraph {
        nodes,
        outgoing,
        incoming,
    })
}

fn validate_acyclic(
    nodes: &[String],
    incoming: &Edges,
    outgoing: &Edges,
) -> Result<(), IndexError> {
    // Kahn's algorithm avoids recursive stack exhaustion on hostile input.
    let mut remaining: BTreeMap<&str, usize> = nodes
        .iter()
        .map(|id| (id.as_str(), incoming.get(id).map_or(0, Vec::len)))
        .collect();
    let mut ready: Vec<&str> = remaining
        .iter()
        .filter_map(|(&id, &n)| (n == 0).then_some(id))
        .collect();
    let mut count = 0;
    while let Some(id) = ready.pop() {
        count += 1;
        for edge in outgoing.get(id).into_iter().flatten() {
            let n = remaining
                .get_mut(edge.target.as_str())
                .expect("target checked");
            *n -= 1;
            if *n == 0 {
                ready.push(&edge.target);
            }
        }
    }
    if count != nodes.len() {
        return Err(IndexError::Domain("relations contain a cycle".into()));
    }
    Ok(())
}

// Graph evidence follows JavaScript UTF-16 ordering in both domains.
fn sort_edges(outgoing: &mut Edges, incoming: &mut Edges) {
    let key = |edge: &RelationEdge| {
        (
            edge.source.encode_utf16().collect::<Vec<_>>(),
            edge.relation_type.encode_utf16().collect::<Vec<_>>(),
            edge.target.encode_utf16().collect::<Vec<_>>(),
        )
    };
    for edges in outgoing.values_mut().chain(incoming.values_mut()) {
        edges.sort_by_key(&key);
    }
}
