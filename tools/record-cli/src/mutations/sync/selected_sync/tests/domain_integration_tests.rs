use super::*;
use crate::domains::{
    Relation,
    decision::{DecisionState, Definition},
};
use crate::index::{IndexV4, Revision, build_index};

fn state() -> DecisionState {
    DecisionState {
        name: "one".into(),
        source_path: "one.md".into(),
        title: "title".into(),
        status: "active".into(),
        alignment: "aligned".into(),
        created_at: "2025-01-02T00:00:00Z".into(),
        purpose: "purpose".into(),
        background: "background".into(),
        decision: "decision".into(),
        tags: vec!["tag".into()],
        relations: vec![],
    }
}
#[test]
fn combined_projection_rechecks_real_decision_graph() {
    let hash = format!("sha256:{}", "a".repeat(64));
    let index = IndexV4 {
        schema_version: 4,
        namespace: "decisions".into(),
        definition_version: 11,
        metadata: serde_json::json!({}),
        source_revision: Revision {
            metadata: hash.clone(),
            entries: BTreeMap::from([("250102-one".into(), hash.clone())]),
        },
        entries: BTreeMap::from([("250102-one".into(), state())]),
    };
    let baseline = build_index(index, &Definition).unwrap();
    let mut bad = state();
    bad.relations.push(Relation {
        relation_type: "修订".into(),
        target: "250102-missing".into(),
        summary: None,
    });
    let update = SelectedUpdate {
        id: "250102-one".into(),
        current: Some(Entry {
            state: bad,
            revision: hash,
        }),
        located_from: None,
    };
    assert!(matches!(
        build_validated_selected(&baseline, &Definition, &[update], &[]),
        Err(SelectedError::InvalidProjection(_))
    ));
}
