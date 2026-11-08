use super::*;
use std::fs;

#[test]
fn body_ready_candidate_with_future_target_cannot_publish_and_remains_unchanged() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let path = collection.join("next.md");
    let root = open_root(dir.path()).unwrap();
    for relation in ["修订", "重划"] {
        let text = candidate(
            "261106-next",
            &format!("\n  - type: {relation}\n    target: 261231-future"),
        );
        fs::write(&path, &text).unwrap();
        let (candidates, warnings) =
            record_cli::queries::decision::candidates(&root, "decisions", None).unwrap();
        assert_eq!(candidates.len(), 1);
        assert!(candidates[0].0.body_ready);
        assert!(
            warnings
                .iter()
                .any(|warning| warning.contains("261231-future"))
        );
        let error = preflight(&root, &mut operation("next"))
            .err()
            .expect("missing target must fail");
        assert!(format!("{error:?}").contains("261231-future"), "{error:?}");
        assert_eq!(fs::read(&path).unwrap(), text.as_bytes());
        assert!(!collection.join("decision-index.json").exists());
    }
}

#[test]
fn evolution_rejects_multiple_unrelated_successors_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for name in ["first", "second"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261106-{name}"), "[]"),
        )
        .unwrap();
    }
    let before_first = fs::read(collection.join("first.md")).unwrap();
    let before_second = fs::read(collection.join("second.md")).unwrap();
    let mut op = operation("first");
    op.publish_only = false;
    op.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Aligned,
    });
    assert!(preflight(&root, &mut op).is_err());
    assert_eq!(fs::read(collection.join("first.md")).unwrap(), before_first);
    assert_eq!(
        fs::read(collection.join("second.md")).unwrap(),
        before_second
    );
    assert!(!collection.join("decision-index.json").exists());
}

#[test]
fn group_source_and_summary_must_bind_to_selected_successor_and_target() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation, RelationGroup};
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for name in ["next", "other"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261106-{name}"), "[]"),
        )
        .unwrap();
    }
    for name in ["old", "wrong"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261105-{name}"), "[]"),
        )
        .unwrap();
        assert_eq!(
            run_transaction(&root, &mut operation(name)).status,
            TxStatus::Ok
        );
    }
    let before_index = fs::read(collection.join("decision-index.json")).unwrap();
    let before = fs::read(collection.join("next.md")).unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.relations = DecisionRelationOverride::Groups(vec![RelationGroup {
        source: "other".into(),
        relations: vec![],
    }]);
    assert_eq!(
        preflight(&root, &mut op).err().unwrap().code,
        "relation-source"
    );
    op.relations = DecisionRelationOverride::Groups(vec![RelationGroup {
        source: "next".into(),
        relations: vec![Relation {
            summary_selector: Some("261105-wrong".into()),
            kind: DecisionRelationKind::Revision,
            target: "261105-old".into(),
            summary: Some("reason".into()),
        }],
    }]);
    assert_eq!(
        preflight(&root, &mut op).err().unwrap().code,
        "relation-summary"
    );
    assert_eq!(fs::read(collection.join("next.md")).unwrap(), before);
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before_index
    );
}

#[test]
fn candidate_relation_stays_out_of_formal_index_until_publication() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    let index_path = collection.join("decision-index.json");
    let before = fs::read(&index_path).unwrap();
    fs::write(
        collection.join("first.md"),
        candidate(
            "261106-first",
            "\n  - type: 修订\n    target: 261106-second",
        ),
    )
    .unwrap();
    fs::write(
        collection.join("second.md"),
        candidate("261106-second", "[]"),
    )
    .unwrap();
    let (found, _) = record_cli::queries::decision::candidates(&root, "decisions", None).unwrap();
    assert_eq!(found.len(), 2);
    let after = fs::read(&index_path).unwrap();
    assert_eq!(before, after);
    let parsed =
        record_cli::index::parse_index(&after, &record_cli::domains::decision::Definition).unwrap();
    assert!(!parsed.index().entries.contains_key("261106-first"));
    assert!(!parsed.index().entries.contains_key("261106-second"));
    assert_eq!(parsed.index().entries["261105-old"].status, "active");
    assert!(
        record_cli::index::QuerySnapshot::new(parsed)
            .graph(&record_cli::domains::decision::Definition)
            .is_ok()
    );
}
