use super::*;
use std::fs;

#[test]
fn sparse_reallocation_publishes_distinct_successors_and_archives_both_predecessors() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for (name, id) in [("old-a", "261105-old-a"), ("old-b", "261105-old-b")] {
        fs::write(collection.join(format!("{name}.md")), candidate(id, "[]")).unwrap();
        let result = run_transaction(&root, &mut operation(name));
        assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    }
    fs::write(collection.join("next-a.md"), candidate("261106-next-a", "\n  - type: 重划\n    target: 261105-old-a\n    summary: first\n  - type: 重划\n    target: 261105-old-b\n    summary: second")).unwrap();
    fs::write(
        collection.join("next-b.md"),
        candidate(
            "261106-next-b",
            "\n  - type: 重划\n    target: 261105-old-b\n    summary: third",
        ),
    )
    .unwrap();
    let before = fs::read(collection.join("decision-index.json")).unwrap();
    let mut op = operation("next-a");
    op.publish_only = false;
    assert!(preflight(&root, &mut op).is_err());
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    assert!(collection.join("old-a.md").exists());
    assert!(collection.join("old-b.md").exists());
    op.successors.push(Successor {
        selector: "next-b".into(),
        alignment: Alignment::Aligned,
    });
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    let entries = &parsed.index().entries;
    assert_eq!(entries["261105-old-a"].status, "archived");
    assert_eq!(entries["261105-old-b"].status, "archived");
    assert_eq!(entries["261106-next-a"].alignment, "unaligned");
    assert_eq!(entries["261106-next-b"].alignment, "aligned");
    let a = &entries["261106-next-a"].relations;
    let b = &entries["261106-next-b"].relations;
    assert_eq!(
        a.iter()
            .map(|r| (r.target.as_str(), r.summary.as_deref()))
            .collect::<Vec<_>>(),
        vec![
            ("261105-old-a", Some("first")),
            ("261105-old-b", Some("second"))
        ]
    );
    assert_eq!(
        b.iter()
            .map(|r| (r.target.as_str(), r.summary.as_deref()))
            .collect::<Vec<_>>(),
        vec![("261105-old-b", Some("third"))]
    );
    assert!(
        record_cli::index::QuerySnapshot::new(parsed)
            .graph(&record_cli::domains::decision::Definition)
            .is_ok()
    );
    fs::write(
        collection.join("next-c.md"),
        candidate(
            "261106-next-c",
            "\n  - type: 重划\n    target: 261105-old-b",
        ),
    )
    .unwrap();
    let before_extension = fs::read(collection.join("decision-index.json")).unwrap();
    let mut extend = operation("next-c");
    extend.publish_only = false;
    extend.successors.push(Successor {
        selector: "next-a".into(),
        alignment: Alignment::Unaligned,
    });
    assert!(preflight(&root, &mut extend).is_err());
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before_extension
    );
    extend.successors.push(Successor {
        selector: "next-b".into(),
        alignment: Alignment::Aligned,
    });
    let result = run_transaction(&root, &mut extend);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert_eq!(
        parsed.index().entries["261106-next-c"].relations[0].target,
        "261105-old-b"
    );
    assert!(
        record_cli::index::QuerySnapshot::new(parsed)
            .graph(&record_cli::domains::decision::Definition)
            .is_ok()
    );
}

#[test]
fn split_extension_requires_all_established_successors_and_preserves_alignment() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    let relation = "\n  - type: 拆分\n    target: 261105-old";
    for name in ["first", "second", "third"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261106-{name}"), relation),
        )
        .unwrap();
    }
    let mut initial = operation("first");
    initial.publish_only = false;
    initial.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Aligned,
    });
    let result = run_transaction(&root, &mut initial);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    let before = fs::read(collection.join("decision-index.json")).unwrap();
    let first = fs::read(collection.join("first.md")).unwrap();
    let second = fs::read(collection.join("second.md")).unwrap();
    let mut extend = operation("third");
    extend.publish_only = false;
    extend.successors.push(Successor {
        selector: "first".into(),
        alignment: Alignment::Unaligned,
    });
    assert!(preflight(&root, &mut extend).is_err());
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    assert_eq!(fs::read(collection.join("first.md")).unwrap(), first);
    assert_eq!(fs::read(collection.join("second.md")).unwrap(), second);
    extend.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Unaligned,
    });
    assert!(preflight(&root, &mut extend).is_err());
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    extend.successors.last_mut().unwrap().alignment = Alignment::Aligned;
    let result = run_transaction(&root, &mut extend);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    for (name, alignment) in [
        ("first", "unaligned"),
        ("second", "aligned"),
        ("third", "unaligned"),
    ] {
        let state = &parsed.index().entries[&format!("261106-{name}")];
        assert_eq!(state.alignment, alignment);
        assert_eq!(state.relations.len(), 1);
        assert_eq!(state.relations[0].target, "261105-old");
    }
    assert!(
        record_cli::index::QuerySnapshot::new(parsed)
            .graph(&record_cli::domains::decision::Definition)
            .is_ok()
    );
    let mut shrink = operation("first");
    shrink.publish_only = false;
    shrink.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Aligned,
    });
    shrink.discard = Some("third".into());
    let result = run_transaction(&root, &mut shrink);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!collection.join("third.md").exists());
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert!(!parsed.index().entries.contains_key("261106-third"));
    for name in ["first", "second"] {
        assert_eq!(
            parsed.index().entries[&format!("261106-{name}")].relations[0].target,
            "261105-old"
        );
    }
    assert!(
        record_cli::index::QuerySnapshot::new(parsed)
            .graph(&record_cli::domains::decision::Definition)
            .is_ok()
    );
}

#[test]
fn split_rejects_mixed_edges_and_mixed_successor_strategies() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for name in ["old-a", "old-b"] {
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
    let first = collection.join("first.md");
    let second = collection.join("second.md");
    fs::write(
        &first,
        candidate(
            "261106-first",
            "\n  - type: 拆分\n    target: 261105-old-a\n  - type: 修订\n    target: 261105-old-b",
        ),
    )
    .unwrap();
    fs::write(
        &second,
        candidate(
            "261106-second",
            "\n  - type: 拆分\n    target: 261105-old-a",
        ),
    )
    .unwrap();
    let before = fs::read(collection.join("decision-index.json")).unwrap();
    let mut op = operation("first");
    op.publish_only = false;
    op.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Aligned,
    });
    let error = preflight(&root, &mut op)
        .err()
        .expect("mixed split edges must fail");
    assert!(
        format!("{error:?}").contains("invalid split relations"),
        "{error:?}"
    );
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    fs::write(
        &first,
        candidate("261106-first", "\n  - type: 拆分\n    target: 261105-old-a"),
    )
    .unwrap();
    fs::write(
        &second,
        candidate(
            "261106-second",
            "\n  - type: 修订\n    target: 261105-old-b",
        ),
    )
    .unwrap();
    assert!(preflight(&root, &mut op).is_err());
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    assert!(collection.join("old-a.md").exists());
    assert!(collection.join("old-b.md").exists());
}
