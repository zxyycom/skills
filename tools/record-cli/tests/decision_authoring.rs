use record_cli::{
    mutations::{
        authoring::decision::DecisionEvolutionOperation,
        contract::{Alignment, DecisionRelationOverride, Successor},
    },
    source::{RelativePath, open_root},
    transaction::{TxStatus, preflight, run_transaction},
};
fn candidate(id: &str, relations: &str) -> String {
    format!(
        "---\ntitle: Example title\nid: {id}\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - test\nrelations: {relations}\n---\n\n## 目的\n\nPurpose.\n\n## 背景\n\nBackground.\n\n## 决策\n\n- 采用：Decision.\n"
    )
}
fn operation(selector: &str) -> DecisionEvolutionOperation {
    DecisionEvolutionOperation {
        collection: RelativePath::new("decisions").unwrap(),
        successors: vec![Successor {
            selector: selector.into(),
            alignment: Alignment::Unaligned,
        }],
        relations: DecisionRelationOverride::Preserve,
        discard: None,
        delete_recorded: false,
        keep_unrecorded_history: false,
        publish_only: true,
        timestamp: "2026-11-06T12:00:00Z".into(),
    }
}

#[path = "decision_authoring/history_and_identity.rs"]
mod history_and_identity;
#[path = "decision_authoring/publication.rs"]
mod publication;
