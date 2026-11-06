//! Projection of a validated graph's directly matching relationship evidence.
use super::trace::{RequestedDirection, compare_text};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterRelation {
    pub source_id: String,
    #[serde(rename = "type")]
    pub relation_type: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}
/// `anchor` has already been uniquely resolved. The caller validates the full
/// domain graph before calling; an absent anchor means type-only filtering.
/// Passing neither filter means there is no relation projection at all.
pub fn project<'a>(
    edges: impl IntoIterator<Item = &'a FilterRelation>,
    anchor: Option<&str>,
    direction: RequestedDirection,
    relation_type: Option<&str>,
) -> Option<HashMap<String, Vec<FilterRelation>>> {
    if anchor.is_none() && relation_type.is_none() {
        return None;
    }
    let mut evidence = Evidence::default();
    for edge in edges {
        if relation_type.is_some_and(|kind| edge.relation_type != kind) {
            continue;
        }
        for id in matching_records(edge, anchor, direction)
            .into_iter()
            .flatten()
        {
            evidence.insert(id, edge);
        }
    }
    Some(evidence.finish())
}
// Edge evidence is unique per projected record; a later duplicate replaces
// the prior value while preserving deterministic sorted output.
#[derive(Default)]
struct Evidence {
    records: HashMap<String, Vec<FilterRelation>>,
    positions: HashMap<(String, String, String, String), usize>,
}
impl Evidence {
    fn insert(&mut self, id: &str, edge: &FilterRelation) {
        let key = (
            id.to_owned(),
            edge.source_id.clone(),
            edge.relation_type.clone(),
            edge.target.clone(),
        );
        let relations = self.records.entry(id.to_owned()).or_default();
        if let Some(index) = self.positions.get(&key) {
            relations[*index] = edge.clone();
        } else {
            self.positions.insert(key, relations.len());
            relations.push(edge.clone());
        }
    }
    fn finish(mut self) -> HashMap<String, Vec<FilterRelation>> {
        for relations in self.records.values_mut() {
            relations.sort_by(|a, b| {
                compare_text(&a.source_id, &b.source_id)
                    .then_with(|| compare_text(&a.relation_type, &b.relation_type))
                    .then_with(|| compare_text(&a.target, &b.target))
            });
        }
        self.records
    }
}

fn matching_records<'a>(
    edge: &'a FilterRelation,
    anchor: Option<&str>,
    direction: RequestedDirection,
) -> [Option<&'a str>; 2] {
    let Some(id) = anchor else {
        return [Some(&edge.source_id), None];
    };
    [
        (direction != RequestedDirection::Successors && edge.source_id == id)
            .then_some(edge.target.as_str()),
        (direction != RequestedDirection::Predecessors && edge.target == id)
            .then_some(edge.source_id.as_str()),
    ]
}

/// Resolves the selector and obtains the graph from this same snapshot. Graph
/// validation remains lazy and is not requested for unfiltered queries.
pub fn from_snapshot<D>(
    snapshot: &crate::index::QuerySnapshot<D::State>,
    definition: &D,
    filter: &super::options::RelationFilter,
    name: impl Fn(&D::State) -> &str,
) -> Result<Option<HashMap<String, Vec<FilterRelation>>>, String>
where
    D: crate::index::DomainDefinition,
{
    if filter.related_to.is_none() && filter.relation_type.is_none() {
        return Ok(None);
    }
    let anchor = filter
        .related_to
        .as_ref()
        .map(|selector| {
            crate::domains::resolve_selector(&snapshot.index().index().entries, selector, &name)
                .map(|(id, _)| id)
                .map_err(|error| super::selector_message(selector, error))
        })
        .transpose()?;
    let graph = snapshot
        .graph(definition)
        .map_err(|error| error.to_string())?;
    let edges: Vec<_> = graph
        .nodes()
        .flat_map(|id| graph.outgoing(id))
        .map(|edge| FilterRelation {
            source_id: edge.source.clone(),
            relation_type: edge.relation_type.clone(),
            target: edge.target.clone(),
            summary: edge.summary.clone(),
        })
        .collect();
    Ok(project(
        &edges,
        anchor,
        filter
            .direction
            .unwrap_or(super::trace::RequestedDirection::Both),
        filter.relation_type.as_deref(),
    ))
}

/// Resolved search anchor and evidence, both from the same validated snapshot.
pub(crate) struct SearchRelations {
    pub evidence: Option<HashMap<String, Vec<FilterRelation>>>,
    pub anchor: Option<String>,
}
pub(crate) fn for_search<D>(
    snapshot: &crate::index::QuerySnapshot<D::State>,
    definition: &D,
    filter: &super::options::RelationFilter,
    name: impl Fn(&D::State) -> &str,
) -> Result<SearchRelations, String>
where
    D: crate::index::DomainDefinition,
{
    let evidence = from_snapshot(snapshot, definition, filter, &name)?;
    let anchor = filter
        .related_to
        .as_ref()
        .map(|selector| {
            crate::domains::resolve_selector(&snapshot.index().index().entries, selector, &name)
                .map(|(id, _)| id.to_owned())
                .map_err(|error| super::selector_message(selector, error))
        })
        .transpose()?;
    Ok(SearchRelations { evidence, anchor })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn filter_requires_same_edge_and_evidence_is_deduplicated() {
        let edges = [
            FilterRelation {
                source_id: "a".into(),
                target: "b".into(),
                relation_type: "补充".into(),
                summary: None,
            },
            FilterRelation {
                source_id: "a".into(),
                target: "b".into(),
                relation_type: "补充".into(),
                summary: None,
            },
            FilterRelation {
                source_id: "c".into(),
                target: "a".into(),
                relation_type: "复查".into(),
                summary: None,
            },
        ];
        let result = project(&edges, Some("a"), RequestedDirection::Both, Some("补充")).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result["b"].len(), 1);
        assert!(!result.contains_key("c"));
        assert!(project(&edges, None, RequestedDirection::Both, None).is_none());
    }
}
