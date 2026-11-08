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
        let residual: Vec<&str> = remaining
            .iter()
            .filter_map(|(&id, &degree)| (degree > 0).then_some(id))
            .collect();
        let sample = residual
            .iter()
            .take(5)
            .copied()
            .collect::<Vec<_>>()
            .join(", ");
        let suffix = if residual.len() > 5 { ", ..." } else { "" };
        return Err(IndexError::Domain(format!(
            "relations contain a cycle; residual nodes (up to five): {sample}{suffix}; inspect their relations to locate the cycle"
        )));
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deep_graph_is_stack_safe_and_cycle_diagnostics_are_bounded() {
        let mut entries: BTreeMap<String, Vec<Relation>> = (0..12_000)
            .map(|n| (format!("node-{n:05}"), vec![]))
            .collect();
        for n in 1..12_000 {
            entries
                .get_mut(&format!("node-{n:05}"))
                .unwrap()
                .push(Relation {
                    relation_type: "test".into(),
                    target: format!("node-{:05}", n - 1),
                    summary: None,
                });
        }
        assert!(build_graph(entries.iter()).is_ok());
        entries.get_mut("node-11990").unwrap().push(Relation {
            relation_type: "test".into(),
            target: "node-11999".into(),
            summary: None,
        });
        let error = match build_graph(entries.iter()) {
            Err(error) => error.to_string(),
            Ok(_) => panic!("cycle accepted"),
        };
        assert!(error.contains("relations contain a cycle"));
        assert!(error.contains("residual nodes (up to five)"));
        assert!(error.contains("node-00000"));
        assert!(error.contains("node-00004"));
        assert!(!error.contains("node-00005"));
        assert!(error.contains("..."));
        assert!(error.contains("inspect their relations"));
    }
}
