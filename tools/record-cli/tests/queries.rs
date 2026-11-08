//! Private, hand-authored v4 fixtures exercise the actual validation boundary.
use record_cli::{
    domains::{decision, investigation},
    index::{QuerySnapshot, parse_index},
    queries::{
        decision::{self as dq, AlignmentFilter, StatusFilter},
        investigation as iq,
        options::{ListOptions, RelationFilter},
    },
};
use serde_json::{Value, json};
fn options() -> ListOptions {
    ListOptions {
        tags: vec![],
        relation: RelationFilter {
            related_to: None,
            direction: None,
            relation_type: None,
        },
        limit: 1,
        offset: 0,
        detail: false,
    }
}
fn fixture(namespace: &str, entries: Value) -> Vec<u8> {
    let fingerprint = format!("sha256:{}", "0".repeat(64));
    let revisions: serde_json::Map<String, Value> = entries
        .as_object()
        .unwrap()
        .keys()
        .map(|id| (id.clone(), json!(fingerprint)))
        .collect();
    serde_json::to_vec(&json!({"schemaVersion":4,"namespace":namespace,"definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":fingerprint,"entries":revisions},"entries":entries})).unwrap()
}

#[path = "queries/candidates.rs"]
mod candidates;
#[path = "queries/check.rs"]
mod check;
#[path = "queries/content_search.rs"]
mod content_search;
#[path = "queries/graph_dependencies.rs"]
mod graph_dependencies;
#[path = "queries/investigation_filters.rs"]
mod investigation_filters;
#[path = "queries/investigation_query_contracts.rs"]
mod investigation_query_contracts;
#[path = "queries/metadata_search.rs"]
mod metadata_search;
#[path = "queries/snapshot_queries.rs"]
mod snapshot_queries;

#[path = "queries/decision_content_contracts.rs"]
mod decision_content_contracts;
