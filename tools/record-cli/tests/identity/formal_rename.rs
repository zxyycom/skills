use super::*;

fn write_two_record_index(base: &std::path::Path, original: &str, other: &str, other_path: &str) {
    let docs = [
        ("261106-original", "original.md", original),
        ("261105-other", other_path, other),
    ];
    let mut entries = BTreeMap::new();
    let mut revisions = BTreeMap::new();
    for (id, path, text) in docs {
        entries.insert(
            id.into(),
            decision::parse_established(text.as_bytes(), id, path)
                .unwrap()
                .state,
        );
        revisions.insert(
            id.into(),
            source_revision::fingerprint(Domain::Decision, id, path, text),
        );
    }
    let baseline = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: revisions,
            },
            entries,
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(
        base.join("decision-index.json"),
        index::serialize_index(&baseline, &Definition).unwrap(),
    )
    .unwrap();
}

#[test]
fn decision_rename_avoids_another_records_semantic_path() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let original = std::fs::read_to_string(base.join("original.md")).unwrap();
    let occupant = original
        .replace("261106-original", "261105-other")
        .replace("2026-11-06T12:00:00Z", "2026-11-05T12:00:00Z");
    std::fs::write(base.join("new.md"), &occupant).unwrap();
    write_two_record_index(&base, &original, &occupant, "new.md");
    let mut op = operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: false,
    });
    let result = transaction::run_transaction(&root, &mut op);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed);
    assert_eq!(
        std::fs::read_to_string(base.join("new.md")).unwrap(),
        occupant
    );
    assert!(!base.join("original.md").exists());
    let renamed = std::fs::read(base.join("261106-new.md")).unwrap();
    decision::parse_established(&renamed, "261106-new", "261106-new.md").unwrap();
}

#[test]
fn decision_formal_rename_ignores_unrelated_invalid_formal_body() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let original = std::fs::read_to_string(base.join("original.md")).unwrap();
    let other = original
        .replace("261106-original", "261105-other")
        .replace("2026-11-06T12:00:00Z", "2026-11-05T12:00:00Z");
    write_two_record_index(&base, &original, &other, "other.md");
    std::fs::write(base.join("other.md"), b"invalid unrelated source").unwrap();
    let mut op = operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: false,
    });
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(!base.join("original.md").exists());
    assert!(base.join("new.md").exists());
    assert_eq!(
        std::fs::read(base.join("other.md")).unwrap(),
        b"invalid unrelated source"
    );
    let bytes = std::fs::read(base.join("decision-index.json")).unwrap();
    let actual = index::parse_index(&bytes, &Definition).unwrap();
    assert_eq!(
        actual.index().entries["261105-other"].source_path,
        "other.md"
    );
}
