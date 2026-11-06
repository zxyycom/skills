//! Cross-record resource ownership, relation shape, and chronology validation.
use super::InvestigationState;
use crate::index::{IndexError, IndexV4, RelationGraph};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

pub(super) fn validate(index: &IndexV4<InvestigationState>) -> Result<RelationGraph, IndexError> {
    let graph = super::super::build_graph(
        index
            .entries
            .iter()
            .map(|(id, state)| (id, &state.relations)),
    )?;
    for (id, state) in &index.entries {
        validate_resource_owners(index, state)?;
        validate_relation_shape(&graph, id)?;
        validate_chronology(index, &graph, id, state)?;
    }
    Ok(graph)
}

fn validate_resource_owners(
    index: &IndexV4<InvestigationState>,
    state: &InvestigationState,
) -> Result<(), IndexError> {
    for resource in &state.resource_ids {
        let owner = resource.split('/').next().expect("validated resource ID");
        if !index
            .entries
            .get(owner)
            .is_some_and(|owner_state| owner_state.resource_ids.contains(resource))
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
