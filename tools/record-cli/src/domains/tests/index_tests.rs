use super::{SelectorError, decision, investigation, resolve_selector};
use crate::index::parse_index;
use serde_json::{Value, json};
fn envelope(namespace: &str, id: &str, state: Value) -> Value {
    let hash = format!("sha256:{}", "a".repeat(64));
    json!({"schemaVersion":4,"namespace":namespace,"definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{id:hash}},"entries":{id:state}})
}
fn decision() -> Value {
    json!({"name":"record","sourcePath":"record.md","title":"Title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["test"],"relations":[]})
}
fn investigation() -> Value {
    json!({"name":"report","sourcePath":"report.md","title":"Title","formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["test"],"relations":[],"resourceIds":[]})
}
fn bytes(v: &Value) -> Vec<u8> {
    serde_json::to_vec(v).unwrap()
}
#[test]
fn validates_both_domains_and_rejects_corruption() {
    let mut dr = envelope("decisions", "240229-record", decision());
    assert!(parse_index(&bytes(&dr), &decision::Definition).is_ok());
    dr["entries"]["240229-record"]["status"] = json!("candidate");
    assert!(parse_index(&bytes(&dr), &decision::Definition).is_err());
    let mut ir = envelope("investigations", "240229-report", investigation());
    assert!(parse_index(&bytes(&ir), &investigation::Definition).is_ok());
    let mut old_definition = ir.clone();
    old_definition["definitionVersion"] = json!(10);
    assert!(parse_index(&bytes(&old_definition), &investigation::Definition).is_err());
    let mut nonempty_metadata = ir.clone();
    nonempty_metadata["metadata"] = json!({"unexpected":"value"});
    assert!(parse_index(&bytes(&nonempty_metadata), &investigation::Definition).is_err());
    ir["entries"]["240229-report"]["resourceIds"] = json!(["report/../secret"]);
    assert!(parse_index(&bytes(&ir), &investigation::Definition).is_err());
}
#[test]
fn relation_null_rejected_and_decision_summary_normalized() {
    let mut state = decision();
    state["relations"] = json!([{"type":"修订","target":"old","summary":null}]);
    let mut dr = envelope("decisions", "240229-record", state);
    assert!(parse_index(&bytes(&dr), &decision::Definition).is_err());
    dr["entries"]["240229-record"]["relations"][0]["summary"] = json!("  reason  ");
    let parsed = parse_index(&bytes(&dr), &decision::Definition).unwrap();
    assert_eq!(
        parsed.index().entries["240229-record"].relations[0]
            .summary
            .as_deref(),
        Some("reason")
    );
}
#[test]
fn decision_graph_checks_archival_and_complete_events() {
    use crate::index::QuerySnapshot;
    let mut v = envelope("decisions", "240229-record", decision());
    let mut old = decision();
    old["name"] = json!("old");
    old["sourcePath"] = json!("archive/old.md");
    old["status"] = json!("archived");
    v["entries"]["230101-old"] = old;
    v["sourceRevision"]["entries"]["230101-old"] = json!(format!("sha256:{}", "a".repeat(64)));
    v["entries"]["240229-record"]["relations"] = json!([{"type":"修订","target":"230101-old"}]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_ok());
    v["entries"]["240229-record"]["relations"][0]["target"] = json!("240229-record");
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_err());
    v["entries"]["240229-record"]["relations"][0]["target"] = json!("230101-old");
    v["entries"]["230101-old"]["status"] = json!("active");
    v["entries"]["230101-old"]["sourcePath"] = json!("old.md");
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_err());
    v["entries"]["230101-old"]["status"] = json!("archived");
    v["entries"]["230101-old"]["sourcePath"] = json!("archive/old.md");
    v["entries"]["240229-record"]["relations"][0]["type"] = json!("拆分");
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_err());
    v["entries"]["240229-record"]["relations"][0]["type"] = json!("归并");
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_err());
}
#[test]
fn reallocation_component_requires_both_roles_and_two_sides() {
    use crate::index::QuerySnapshot;
    let mut v = envelope("decisions", "240229-record", decision());
    for (id, archived) in [
        ("230101-old-a", true),
        ("230101-old-b", true),
        ("240301-next", false),
    ] {
        let mut state = decision();
        state["name"] = json!(super::name_from_id(id));
        state["sourcePath"] = json!(if archived {
            format!("archive/{id}.md")
        } else {
            format!("{id}.md")
        });
        if archived {
            state["status"] = json!("archived");
        }
        v["entries"][id] = state;
        v["sourceRevision"]["entries"][id] = json!(format!("sha256:{}", "a".repeat(64)));
    }
    v["entries"]["240229-record"]["relations"] =
        json!([{"type":"重划","target":"230101-old-a"},{"type":"重划","target":"230101-old-b"}]);
    v["entries"]["240301-next"]["relations"] = json!([{"type":"重划","target":"230101-old-a"}]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_ok());
    let mut one_predecessor = v.clone();
    one_predecessor["entries"]["240229-record"]["relations"] =
        json!([{"type":"重划","target":"230101-old-a"}]);
    let mut mixed = v.clone();
    mixed["entries"]["240229-record"]["relations"] =
        json!([{"type":"重划","target":"230101-old-a"},{"type":"修订","target":"230101-old-b"}]);
    let mut crossed_roles = v.clone();
    crossed_roles["entries"]["230101-old-a"]["relations"] =
        json!([{"type":"重划","target":"230101-old-b"}]);
    let mut disconnected = v.clone();
    disconnected["entries"]["240229-record"]["relations"] =
        json!([{"type":"重划","target":"230101-old-a"}]);
    disconnected["entries"]["240301-next"]["relations"] =
        json!([{"type":"重划","target":"230101-old-b"}]);
    for invalid in [one_predecessor, mixed, crossed_roles, disconnected] {
        let snapshot =
            QuerySnapshot::new(parse_index(&bytes(&invalid), &decision::Definition).unwrap());
        assert!(snapshot.graph(&decision::Definition).is_err());
    }
    v["entries"]["240301-next"]["relations"] = json!([]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    assert!(snapshot.graph(&decision::Definition).is_err());
}
#[test]
fn graph_validates_relations_and_resource_owners() {
    use crate::index::QuerySnapshot;
    let mut v = envelope("investigations", "240229-report", investigation());
    let mut other = investigation();
    other["name"] = json!("old");
    other["sourcePath"] = json!("old.md");
    other["formedAt"] = json!("2023-01-01T00:00:00Z");
    v["entries"]["230101-old"] = other;
    v["sourceRevision"]["entries"]["230101-old"] = json!(format!("sha256:{}", "a".repeat(64)));
    v["entries"]["240229-report"]["relations"] = json!([{"type":"复查","target":"230101-old"}]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert_eq!(
        snapshot
            .graph(&investigation::Definition)
            .unwrap()
            .outgoing("240229-report")
            .len(),
        1
    );
    v["entries"]["240229-report"]["relations"][0]["target"] = json!("240229-report");
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert!(snapshot.graph(&investigation::Definition).is_err());
    v["entries"]["240229-report"]["relations"][0]["target"] = json!("230101-old");
    v["entries"]["230101-old"]["formedAt"] = json!("2025-01-01T00:00:00Z");
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert!(snapshot.graph(&investigation::Definition).is_err());
    v["entries"]["230101-old"]["formedAt"] = json!("2023-01-01T00:00:00Z");
    v["entries"]["240229-report"]["resourceIds"] = json!(["220101-missing/asset.png"]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert!(snapshot.graph(&investigation::Definition).is_err());
    v["entries"]["240229-report"]["resourceIds"] = json!(["230101-old/asset.png"]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert!(snapshot.graph(&investigation::Definition).is_err());
    v["entries"]["230101-old"]["resourceIds"] = json!(["230101-old/asset.png"]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert!(snapshot.graph(&investigation::Definition).is_ok());
    v["entries"]["230101-old"]["relations"] = json!([{"type":"复查","target":"240229-report"}]);
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &investigation::Definition).unwrap());
    assert!(snapshot.graph(&investigation::Definition).is_err());
}
#[test]
fn resolves_dated_ids_and_detects_ambiguous_names() {
    let entries = std::collections::BTreeMap::from([
        ("240229-report".into(), "report"),
        ("240301-report".into(), "report"),
    ]);
    assert_eq!(
        resolve_selector(&entries, "240229-report.MD", |x| x)
            .unwrap()
            .0,
        "240229-report"
    );
    assert!(matches!(
        resolve_selector(&entries, "report", |x| x),
        Err(SelectorError::Ambiguous(_))
    ));
    assert_eq!(
        resolve_selector(&entries, "240302-report", |x| x),
        Err(SelectorError::NotFound)
    );
}

#[test]
fn successive_reallocation_events_remain_separate_at_shared_historical_records() {
    use crate::index::QuerySnapshot;
    let mut v = envelope("decisions", "240101-old-a", decision());
    for (id, name, status, relations) in [
        ("240101-old-a", "old-a", "archived", json!([])),
        ("240101-old-b", "old-b", "archived", json!([])),
        (
            "240201-mid-a",
            "mid-a",
            "archived",
            json!([{"type":"重划","target":"240101-old-a"},{"type":"重划","target":"240101-old-b"}]),
        ),
        (
            "240201-mid-b",
            "mid-b",
            "archived",
            json!([{"type":"重划","target":"240101-old-a"},{"type":"重划","target":"240101-old-b"}]),
        ),
        (
            "240301-new-a",
            "new-a",
            "active",
            json!([{"type":"重划","target":"240201-mid-a"},{"type":"重划","target":"240201-mid-b"}]),
        ),
        (
            "240301-new-b",
            "new-b",
            "active",
            json!([{"type":"重划","target":"240201-mid-a"},{"type":"重划","target":"240201-mid-b"}]),
        ),
    ] {
        let mut state = decision();
        state["name"] = json!(name);
        state["status"] = json!(status);
        state["sourcePath"] = json!(if status == "archived" {
            format!("archive/{id}.md")
        } else {
            format!("{id}.md")
        });
        state["relations"] = relations;
        v["entries"][id] = state;
        v["sourceRevision"]["entries"][id] = json!(format!("sha256:{}", "a".repeat(64)));
    }
    let snapshot = QuerySnapshot::new(parse_index(&bytes(&v), &decision::Definition).unwrap());
    let graph = snapshot.graph(&decision::Definition).unwrap();
    assert_eq!(graph.outgoing("240201-mid-a").len(), 2);
    assert_eq!(graph.incoming("240201-mid-a").len(), 2);
    assert!(
        graph
            .outgoing("240201-mid-a")
            .iter()
            .all(|edge| edge.target.starts_with("240101-old"))
    );
    assert!(
        graph
            .incoming("240201-mid-a")
            .iter()
            .all(|edge| edge.source.starts_with("240301-new"))
    );
}
