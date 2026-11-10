//! Cross-record resource ownership, relation shape, and chronology validation.
use super::InvestigationState;
use crate::index::{IndexError, IndexV4, RelationGraph};
use std::collections::{HashMap, HashSet};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

pub(super) fn validate(index: &IndexV4<InvestigationState>) -> Result<RelationGraph, IndexError> {
    let graph = super::super::build_graph(
        index
            .entries
            .iter()
            .map(|(id, state)| (id, &state.relations)),
    )?;
    let resources: HashMap<_, HashSet<_>> = index
        .entries
        .iter()
        .map(|(id, state)| {
            (
                id.as_str(),
                state.resource_ids.iter().map(String::as_str).collect(),
            )
        })
        .collect();
    for (id, state) in &index.entries {
        validate_resource_owners(&resources, state)?;
        validate_relation_shape(&graph, id)?;
        validate_chronology(index, &graph, id, state)?;
    }
    Ok(graph)
}

fn validate_resource_owners(
    resources: &HashMap<&str, HashSet<&str>>,
    state: &InvestigationState,
) -> Result<(), IndexError> {
    for resource in &state.resource_ids {
        let owner = resource.split('/').next().expect("validated resource ID");
        if !resources
            .get(owner)
            .is_some_and(|owner_resources| owner_resources.contains(resource.as_str()))
        {
            return Err(IndexError::Domain(format!(
                "resource {resource} missing owner reference"
            )));
        }
    }
    Ok(())
}

fn validate_relation_shape(graph: &RelationGraph, id: &str) -> Result<(), IndexError> {
    let edges = graph.outgoing(id);
    let valid_outgoing = match edges {
        [] => true,
        [edge] => edge.relation_type != "归并",
        _ => edges.iter().all(|edge| edge.relation_type == "归并"),
    };
    if !valid_outgoing {
        return Err(IndexError::Domain(format!("invalid relation shape: {id}")));
    }
    if graph
        .incoming(id)
        .iter()
        .filter(|e| e.relation_type == "拆分")
        .count()
        == 1
    {
        return Err(IndexError::Domain(format!(
            "split needs at least two successors: {id}"
        )));
    }
    Ok(())
}

fn validate_chronology(
    index: &IndexV4<InvestigationState>,
    graph: &RelationGraph,
    id: &str,
    state: &InvestigationState,
) -> Result<(), IndexError> {
    let source = OffsetDateTime::parse(&state.formed_at, &Rfc3339)
        .map_err(|e| IndexError::Domain(e.to_string()))?;
    for edge in graph.outgoing(id) {
        let target = &index.entries[&edge.target];
        let target_time = OffsetDateTime::parse(&target.formed_at, &Rfc3339)
            .map_err(|e| IndexError::Domain(e.to_string()))?;
        if target_time > source {
            return Err(IndexError::Domain(format!(
                "relation target formed later: {}",
                edge.target
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn graph_stage_cost_missing_owner_reference_reports_first_resource() {
        let state = InvestigationState {
            formed_at: String::new(),
            name: String::new(),
            question: String::new(),
            relations: vec![],
            resource_ids: vec!["owner/a".into(), "owner/b".into()],
            source_path: String::new(),
            tags: vec![],
            title: String::new(),
        };
        let resources = HashMap::from([("owner", HashSet::from(["owner/b"]))]);
        let error = validate_resource_owners(&resources, &state).unwrap_err();
        assert!(
            error
                .to_string()
                .contains("resource owner/a missing owner reference")
        );
        let resources = HashMap::from([("owner", HashSet::from(["owner/a", "owner/b"]))]);
        assert!(validate_resource_owners(&resources, &state).is_ok());
    }
}
