use record_cli::{
    mutations::authoring::{NewInput, NewOperation},
    source::{RelativePath, open_root},
    transaction::{TxStatus, run_transaction},
};
fn decision() -> NewInput {
    NewInput::Decision {
        title: "Decision title".into(),
        purpose: "Purpose text".into(),
        background: "Background text".into(),
        decision: "Decision text".into(),
        tags: vec!["test".into()],
        relations: vec![],
        preflight_alignment: None,
    }
}
fn ready_report(id: &str, relations: &str, resources: &str) -> String {
    format!(
        "---\ntitle: \"Report title\"\nid: \"{id}\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"What happened?\"\ntags:\n  - \"test\"\n{relations}\n---\n\n## 形成时背景\n背景。\n\n## 调查目的\n目的。\n\n## 调查范围与依据\n依据。\n\n## 调查结果与边界\n结果。\n{resources}"
    )
}

#[path = "authoring/create.rs"]
mod create;
#[path = "authoring/publication.rs"]
mod publication;
#[path = "authoring/publication_freshness.rs"]
mod publication_freshness;
#[path = "authoring/selectors.rs"]
mod selectors;
