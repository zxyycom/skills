use super::*;
use crate::index::serialize_index;
fn text(id: &str, status: &str) -> String {
    format!(
        "---\ntitle: Example title\nid: {id}\nstatus: {status}\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n"
    )
}
#[test]
fn private_set_relations_preserves_unselected_source_scope_and_reports_review() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir_all(collection.join("archive")).unwrap();
    let a = text("250102-a", "archived");
    let b = text("250102-b", "active");
    let index = crate::mutations::tests::decision_fixture::two_record_index(&a, &b);

    // The unselected predecessor is deliberately absent. Its published state
    // supplies the relation fact; this operation must not read its body.
    std::fs::write(collection.join("b.md"), &b).unwrap();
    let baseline = serialize_index(&index, &domains::decision::Definition).unwrap();
    std::fs::write(collection.join("decision-index.json"), &baseline).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = DecisionRelationsOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        groups: vec![RelationGroup {
            source: "b".into(),
            relations: vec![Relation {
                summary_selector: Some("250102-a".into()),
                kind: DecisionRelationKind::Revision,
                target: "a".into(),
                summary: Some(" reason ".into()),
            }],
        }],
    };
    std::fs::write(
        collection.join("250102-candidate.md"),
        text("250102-candidate", "candidate")
            .replace("alignment: unaligned", "alignment: null")
            .replace("createdAt: 2025-01-02T00:00:00Z", "createdAt: null"),
    )
    .unwrap();
    operation.groups[0].source = "candidate".into();
    let error = match crate::transaction::preflight(&root, &mut operation) {
        Err(error) => error,
        Ok(_) => panic!("candidate source accepted"),
    };
    assert_eq!(error.code, "source-selector");
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        baseline
    );
    operation.groups[0].source = "b".into();
    operation.groups[0].relations[0].summary_selector = Some("250101-a".into());
    assert!(crate::transaction::preflight(&root, &mut operation).is_err());
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        baseline
    );
    operation.groups[0].relations[0].summary_selector = Some("250102-a".into());
    let preview = crate::transaction::preflight(&root, &mut operation).unwrap();
    assert_eq!(preview.value.review[0].action, ReviewAction::Replace);
    assert_eq!(
        preview.value.review[0].after[0].summary.as_deref(),
        Some("reason")
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        baseline
    );
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!result.changed && !result.committed);
    let read_index = || {
        crate::index::parse_index(
            &std::fs::read(collection.join("decision-index.json")).unwrap(),
            &domains::decision::Definition,
        )
        .unwrap()
    };
    let saved = read_index();
    assert_eq!(
        saved.index().entries["250102-b"].relations[0].target,
        "250102-a"
    );
    assert_eq!(
        saved.index().entries["250102-b"].relations[0]
            .summary
            .as_deref(),
        Some("reason")
    );
    assert!(
        std::fs::read_to_string(collection.join("b.md"))
            .unwrap()
            .contains("reason")
    );
    operation.groups[0].relations[0].summary = None;
    let cleared = crate::transaction::run_transaction(&root, &mut operation);
    assert!(cleared.errors.is_empty(), "{:?}", cleared.errors);
    assert!(cleared.committed && cleared.changed);
    assert_eq!(
        read_index().index().entries["250102-b"].relations[0].summary,
        None
    );
    assert!(
        !std::fs::read_to_string(collection.join("b.md"))
            .unwrap()
            .contains("summary:")
    );
}
