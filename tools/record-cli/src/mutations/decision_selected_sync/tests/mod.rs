use super::*;
use crate::source;
use crate::source::RelativePath;
use crate::source_revision::fingerprint;
use crate::{
    index::{self, IndexV4, Revision, build_index, serialize_index},
    source_revision::metadata_fingerprint,
};
fn text(id: &str) -> String {
    format!(
        "---\ntitle: Example title\nid: {id}\nstatus: active\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n"
    )
}
#[test]
fn related_expands_selected_events_but_not_unrelated_components() {
    let template =
        domains::decision::parse_established(text("250102-a").as_bytes(), "250102-a", "a.md")
            .unwrap()
            .state;
    let mut entries = BTreeMap::new();
    for id in ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] {
        entries.insert(id.to_owned(), template.clone());
    }
    for (source, target, kind) in [
        ("a", "c", "拆分"),
        ("b", "c", "拆分"),
        ("d", "e", "重划"),
        ("f", "e", "重划"),
        ("f", "g", "重划"),
        ("h", "a", "修订"),
        ("i", "j", "归并"),
        ("i", "k", "归并"),
    ] {
        entries
            .get_mut(source)
            .unwrap()
            .relations
            .push(domains::Relation {
                relation_type: kind.into(),
                target: target.into(),
                summary: None,
            });
    }
    assert_eq!(
        related(&entries, &BTreeSet::from(["a".into()])),
        BTreeSet::from(["a".into(), "b".into(), "c".into(), "h".into()])
    );
    assert_eq!(
        related(&entries, &BTreeSet::from(["d".into()])),
        BTreeSet::from(["d".into(), "e".into(), "f".into(), "g".into()])
    );
    assert_eq!(
        related(&entries, &BTreeSet::from(["j".into()])),
        BTreeSet::from(["i".into(), "j".into(), "k".into()])
    );
}
#[test]
fn selected_sync_preserves_unread_baseline_and_requires_both_ids_for_rename() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let a = text("250102-a");
    let b = text("250102-b");
    let state_a = domains::decision::parse_established(a.as_bytes(), "250102-a", "a.md")
        .unwrap()
        .state;
    let state_b = domains::decision::parse_established(b.as_bytes(), "250102-b", "b.md")
        .unwrap()
        .state;
    let revision_b = fingerprint(Domain::Decision, "250102-b", "b.md", &b);
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::from([
                    (
                        "250102-a".into(),
                        fingerprint(Domain::Decision, "250102-a", "a.md", &a),
                    ),
                    ("250102-b".into(), revision_b.clone()),
                ]),
            },
            entries: BTreeMap::from([("250102-a".into(), state_a), ("250102-b".into(), state_b)]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(collection.join("a.md"), format!("{a}\nSelected edit.\n")).unwrap();
    std::fs::write(collection.join("b.md"), format!("{b}\nUnread edit.\n")).unwrap();
    std::fs::write(
        collection.join("decision-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    let mut operation =
        SelectedDecisionSyncOperation::new("decisions".into(), vec!["250102-a".into()]);
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.state, "previewed");
    assert_eq!(preview.coverage.checked_ids, vec!["250102-a"]);
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.changed && result.committed);
    let loaded = index::parse_index(
        &std::fs::read(collection.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        loaded.index().source_revision.entries["250102-b"],
        revision_b
    );
    std::fs::write(collection.join("a.md"), text("250102-new")).unwrap();
    assert!(operation.preflight(&root).is_err());
    operation.selectors = vec!["250102-a".into(), "250102-new.MD".into()];
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.changed_ids, vec!["250102-a", "250102-new"]);
    let renamed = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(renamed.errors.is_empty(), "{:?}", renamed.errors);
    assert!(renamed.committed);
    let loaded = index::parse_index(
        &std::fs::read(collection.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert!(!loaded.index().entries.contains_key("250102-a"));
    assert_eq!(loaded.index().entries["250102-new"].source_path, "a.md");
    std::fs::remove_file(collection.join("a.md")).unwrap();
    operation.selectors = vec!["250102-new".into()];
    let deleted = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(deleted.errors.is_empty(), "{:?}", deleted.errors);
    assert!(deleted.committed);
}
#[test]
fn selected_sync_rejects_stale_required_dependency() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir_all(collection.join("archive")).unwrap();
    let a = text("250102-a").replace("status: active", "status: archived");
    let b = text("250102-b").replace(
        "relations: []",
        "relations:\n  - type: 修订\n    target: 250102-a",
    );
    let index = crate::mutations::tests::decision_fixture::two_record_index(&a, &b);

    std::fs::write(
        collection.join("archive/a.md"),
        format!("{a}\nSelected edit.\n"),
    )
    .unwrap();
    std::fs::write(collection.join("b.md"), format!("{b}\nDependency edit.\n")).unwrap();
    std::fs::write(
        collection.join("decision-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let operation = SelectedDecisionSyncOperation::new("decisions".into(), vec!["250102-a".into()]);
    let rejected = operation.preflight(&root).unwrap_err();
    assert_eq!(rejected.code, "dependency-stale");
    assert_eq!(operation.observed_failure_state(), "source-invalid");
    assert_eq!(operation.observed_selected_ids(), ["250102-a"]);
    assert!(
        rejected.diagnostics[0]
            .reason
            .as_deref()
            .unwrap()
            .contains("250102-b")
    );
    assert!(rejected.diagnostics[0].recovery.is_some());
    std::fs::write(collection.join("b.md"), b).unwrap();
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.coverage.checked_ids, vec!["250102-a", "250102-b"]);
}
