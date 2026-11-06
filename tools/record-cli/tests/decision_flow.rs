use record_cli::{
    domains::decision::Definition,
    index::parse_index,
    mutations::{
        authoring::decision::DecisionEvolutionOperation,
        contract::{Alignment, DecisionRelationOverride, Successor},
    },
    source::{RelativePath, open_root},
    source_revision::{Domain, fingerprint},
    transaction::{TxStatus, run_transaction},
};

#[test]
fn publish_flow_yaml_preserves_untouched_bytes_and_indexes_actual_output() {
    let workspace = tempfile::tempdir().unwrap();
    let collection = workspace.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let source = "\u{feff}---\r\n{title: Example title, id: 261106-one, status: candidate, alignment: null, createdAt: null, purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: []}\r\n---\r\n\r\n## 目的\r\n目的\r\n## 背景\r\n背景\r\n## 决策\r\n- 采用: 方案\r\n";
    std::fs::write(collection.join("one.md"), source).unwrap();
    let root = open_root(workspace.path()).unwrap();
    let mut operation = DecisionEvolutionOperation {
        collection: RelativePath::new("decisions").unwrap(),
        successors: vec![Successor {
            selector: "261106-one".into(),
            alignment: Alignment::Unaligned,
        }],
        relations: DecisionRelationOverride::Preserve,
        discard: None,
        delete_recorded: false,
        keep_unrecorded_history: false,
        publish_only: true,
        timestamp: "2026-11-06T12:00:00Z".into(),
    };
    let result = run_transaction(
        &root,
        &RelativePath::new(".decision.lock").unwrap(),
        &mut operation,
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    let output = std::fs::read_to_string(collection.join("one.md")).unwrap();
    let expected = source
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: unaligned")
        .replace("createdAt: null", "createdAt: 2026-11-06T12:00:00Z");
    assert_eq!(output, expected);
    let index = parse_index(
        &std::fs::read(collection.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        index.index().source_revision.entries["261106-one"],
        fingerprint(Domain::Decision, "261106-one", "one.md", &output)
    );
}

#[test]
fn rename_flow_yaml_preserves_other_members_and_body() {
    use record_cli::mutations::identity::decision::{Action, DecisionIdentityOperation};
    let workspace = tempfile::tempdir().unwrap();
    let collection = workspace.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let source = "---\n{title: Example title, id: 261106-one, status: candidate, alignment: null, createdAt: null, purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: []}\n---\n\n## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用: 方案\n";
    std::fs::write(collection.join("one.md"), source).unwrap();
    let root = open_root(workspace.path()).unwrap();
    let mut op = DecisionIdentityOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: "261106-one".into(),
        action: Action::Rename {
            target: "two".into(),
            confirm_recorded: false,
        },
    };
    let result = run_transaction(
        &root,
        &RelativePath::new(".decision.lock").unwrap(),
        &mut op,
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    let output = std::fs::read_to_string(collection.join("two.md")).unwrap();
    let new_id = output
        .split_once("id: ")
        .unwrap()
        .1
        .split_once(',')
        .unwrap()
        .0;
    assert!(matches!(
        new_id,
        "261106-two" | "\"261106-two\"" | "'261106-two'"
    ));
    assert_eq!(
        output.replace(&format!("id: {new_id}"), "id: 261106-one"),
        source
    );
}
