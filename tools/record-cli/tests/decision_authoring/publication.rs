use super::*;

#[test]
fn first_publish_preflight_and_unselected_invalid_body() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("decisions")).unwrap();
    let c = dir.path().join("decisions");
    let original = candidate("261106-one", "[]").replace(
        "title: Example title",
        "title: Example title # retained header comment",
    );
    std::fs::write(c.join("one.md"), &original).unwrap();
    let mut other = candidate("261106-other", "[]").into_bytes();
    other.extend_from_slice(&[0xff]);
    std::fs::write(c.join("other.md"), &other).unwrap();
    let root = open_root(dir.path()).unwrap();
    let mut op = operation("261106-one.md");
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.established, vec!["261106-one"]);
    assert_eq!(
        std::fs::read(c.join("one.md")).unwrap(),
        original.as_bytes()
    );
    assert!(!c.join("decision-index.json").exists());
    op.successors[0].selector = "261106-one.MD".into();
    let result = run_transaction(
        &root,
        &RelativePath::new(".decision.lock").unwrap(),
        &mut op,
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert_eq!(std::fs::read(c.join("other.md")).unwrap(), other);
    let text = std::fs::read_to_string(c.join("one.md")).unwrap();
    assert!(text.contains("status: active"));
    assert!(text.contains("- 采用：Decision."));
    assert!(text.contains("title: Example title # retained header comment"));
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert_eq!(
        parsed.index().source_revision.entries["261106-one"],
        record_cli::source_revision::fingerprint(
            record_cli::source_revision::Domain::Decision,
            "261106-one",
            "one.md",
            &text
        )
    );
}
#[test]
fn publish_successor_archives_predecessor_in_new_directory() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".decision.lock").unwrap();
    let mut old = operation("old");
    assert_eq!(run_transaction(&root, &lock, &mut old).status, TxStatus::Ok);
    let next = candidate(
        "261106-next",
        "\n  - type: 修订\n    target: 261105-old\n    summary: A reason",
    );
    std::fs::write(c.join("next.md"), next).unwrap();
    let mut op = operation("next");
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.archived, vec!["261105-old"]);
    assert!(!c.join("archive").exists());
    let result = run_transaction(&root, &lock, &mut op);
    assert_eq!(
        result.status,
        TxStatus::Ok,
        "{:?} {:?}",
        result.errors,
        result.cleanup_errors
    );
    assert!(result.committed);
    assert!(!c.join("old.md").exists());
    assert!(c.join("archive/old.md").exists());
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert_eq!(parsed.index().entries["261105-old"].status, "archived");
    assert_eq!(
        parsed.index().entries["261106-next"].relations[0].target,
        "261105-old"
    );
}
#[test]
fn split_requires_complete_successor_graph_and_fails_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".decision.lock").unwrap();
    assert_eq!(
        run_transaction(&root, &lock, &mut operation("old")).status,
        TxStatus::Ok
    );
    let relations = "\n  - type: 拆分\n    target: 261105-old\n    summary: A reason";
    std::fs::write(c.join("first.md"), candidate("261106-first", relations)).unwrap();
    std::fs::write(c.join("second.md"), candidate("261106-second", relations)).unwrap();
    let before = std::fs::read(c.join("decision-index.json")).unwrap();
    let mut op = operation("first");
    assert!(preflight(&root, &mut op).is_err());
    assert_eq!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        before
    );
    assert!(c.join("old.md").exists());
    op.publish_only = false;
    op.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Unaligned,
    });
    let result = run_transaction(&root, &lock, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(c.join("archive/old.md").exists());
}
#[test]
fn unchanged_evolution_still_uses_preflight_and_no_commit() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("one.md"), candidate("261106-one", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".decision.lock").unwrap();
    let mut op = operation("one");
    assert_eq!(run_transaction(&root, &lock, &mut op).status, TxStatus::Ok);
    let before = std::fs::read(c.join("decision-index.json")).unwrap();
    op.publish_only = false;
    let preview = preflight(&root, &mut op).unwrap();
    assert!(preview.writes.is_empty());
    let result = run_transaction(&root, &lock, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!result.changed);
    assert!(!result.committed);
    assert_eq!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        before
    );
}
#[test]
fn grouped_relations_bind_to_successors_and_discard_candidate() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation, RelationGroup};
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let root = open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".decision.lock").unwrap();
    for (name, id) in [("old-one", "261105-old-one"), ("old-two", "261105-old-two")] {
        std::fs::write(c.join(format!("{name}.md")), candidate(id, "[]")).unwrap();
        assert_eq!(
            run_transaction(&root, &lock, &mut operation(name)).status,
            TxStatus::Ok
        );
    }
    for (name, id) in [
        ("first", "261106-first"),
        ("second", "261106-second"),
        ("discarded", "261106-discarded"),
    ] {
        std::fs::write(c.join(format!("{name}.md")), candidate(id, "[]")).unwrap();
    }
    let mut op = operation("first.md");
    op.publish_only = false;
    op.successors.push(Successor {
        selector: "261106-second.MD".into(),
        alignment: Alignment::Aligned,
    });
    op.discard = Some("discarded.MD".into());
    op.relations = DecisionRelationOverride::Groups(vec![
        RelationGroup {
            source: "first.MD".into(),
            relations: vec![Relation {
                kind: DecisionRelationKind::Revision,
                target: "old-one.md".into(),
                summary: Some("  first reason  ".into()),
            }],
        },
        RelationGroup {
            source: "261106-second.md".into(),
            relations: vec![Relation {
                kind: DecisionRelationKind::Replacement,
                target: "261105-old-two.MD".into(),
                summary: Some("second reason".into()),
            }],
        },
    ]);
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.review.len(), 2);
    assert!(c.join("discarded.md").exists());
    let result = run_transaction(&root, &lock, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!c.join("discarded.md").exists());
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    let first = &parsed.index().entries["261106-first"].relations[0];
    let second = &parsed.index().entries["261106-second"].relations[0];
    assert_eq!(
        (&*first.target, first.summary.as_deref()),
        ("261105-old-one", Some("first reason"))
    );
    assert_eq!(
        (&*second.target, second.summary.as_deref()),
        ("261105-old-two", Some("second reason"))
    );
}
