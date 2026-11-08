use super::*;
use crate::source;
use crate::source_revision::fingerprint;
use crate::{
    index::{self, IndexV4, Revision, build_index, serialize_index},
    source_revision::metadata_fingerprint,
};
#[test]
fn selected_sync_preserves_unrelated_source_and_requires_old_owner_absence() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir_all(collection.join("_resources/unselected")).unwrap();
    std::fs::write(
        collection.join("_resources/unselected/note.txt"),
        b"unselected",
    )
    .unwrap();
    let a = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/investigation-same.md"
    ))
    .to_owned();
    let b = a
        .replace("260828-same", "260827-other")
        .replace("2026-08-28", "2026-08-27");
    let state_a = domains::investigation::parse_established(a.as_bytes(), "260828-same", "same.md")
        .unwrap()
        .state;
    let state_b =
        domains::investigation::parse_established(b.as_bytes(), "260827-other", "other.md")
            .unwrap()
            .state;
    let revision_b = fingerprint(Domain::Investigation, "260827-other", "other.md", &b);
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: metadata_fingerprint(Domain::Investigation),
                entries: BTreeMap::from([
                    (
                        "260828-same".into(),
                        fingerprint(Domain::Investigation, "260828-same", "same.md", &a),
                    ),
                    ("260827-other".into(), revision_b.clone()),
                ]),
            },
            entries: BTreeMap::from([
                ("260828-same".into(), state_a),
                ("260827-other".into(), state_b.clone()),
            ]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(collection.join("same.md"), format!("{a}\nSelected edit.\n")).unwrap();
    std::fs::write(
        collection.join("other.md"),
        format!("{b}\nUnselected edit.\n"),
    )
    .unwrap();
    std::fs::write(
        collection.join("investigation-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let missing =
        SelectedInvestigationSyncOperation::new("investigations".into(), vec!["missing".into()]);
    assert!(missing.preflight(&root).is_err());
    assert_eq!(missing.observed_baseline_count(), Some(2));
    let absent = SelectedInvestigationSyncOperation::new("absent".into(), vec!["missing".into()]);
    let failure = absent.preflight(&root).unwrap_err();
    assert_eq!(
        failure.diagnostics[0].code,
        "state-index.selected-baseline-invalid"
    );
    assert_eq!(
        failure.diagnostics[0].target.as_deref(),
        Some("investigation-index.json")
    );
    assert!(failure.diagnostics[0].recovery.is_some());
    assert_eq!(absent.observed_baseline_count(), None);
    let mut operation = SelectedInvestigationSyncOperation::new(
        "investigations".into(),
        vec!["260828-same".into()],
    );
    let selected_edit = format!("{a}\nSelected edit.\n");
    let relation = a.replace(
        "relations: []",
        "relations:\n  - type: \"复查\"\n    target: \"260827-other\"",
    );
    let baseline_bytes = std::fs::read(collection.join("investigation-index.json")).unwrap();
    std::fs::write(collection.join("same.md"), &relation).unwrap();
    let dependency_error = operation.preflight(&root).unwrap_err();
    assert_eq!(dependency_error.code, "dependency-stale");
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        baseline_bytes
    );
    let mut referenced: serde_json::Value = serde_json::from_slice(&baseline_bytes).unwrap();
    referenced["entries"]["260828-same"]["relations"] =
        serde_json::json!([{"type":"复查","target":"260827-other"}]);
    referenced["sourceRevision"]["entries"]["260828-same"] = serde_json::json!(fingerprint(
        Domain::Investigation,
        "260828-same",
        "same.md",
        &relation
    ));
    let referenced =
        index::parse_index(&serde_json::to_vec(&referenced).unwrap(), &Definition).unwrap();
    std::fs::write(
        collection.join("investigation-index.json"),
        serialize_index(&referenced, &Definition).unwrap(),
    )
    .unwrap();
    let before_deletion = std::fs::read(collection.join("investigation-index.json")).unwrap();
    std::fs::remove_file(collection.join("other.md")).unwrap();
    let deleting = SelectedInvestigationSyncOperation::new(
        "investigations".into(),
        vec!["260827-other".into()],
    );
    let deletion_error = deleting.preflight(&root).unwrap_err();
    assert_eq!(deletion_error.code, "projection-invalid");
    assert!(deletion_error.message.contains("260828-same"));
    assert!(deletion_error.message.contains("260827-other"));
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        before_deletion
    );
    std::fs::write(collection.join("investigation-index.json"), &baseline_bytes).unwrap();
    std::fs::write(collection.join("same.md"), &selected_edit).unwrap();
    std::fs::write(
        collection.join("other.md"),
        format!("{b}\nUnselected edit.\n"),
    )
    .unwrap();
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.coverage.checked_ids, vec!["260828-same"]);
    assert_eq!(preview.state, "previewed");
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.changed && result.committed);
    let loaded = index::parse_index(
        &std::fs::read(collection.join("investigation-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        loaded.index().source_revision.entries["260827-other"],
        revision_b
    );
    assert_eq!(loaded.index().entries["260827-other"], state_b);
    std::fs::write(
        collection.join("same.md"),
        a.replace("260828-same", "260828-new"),
    )
    .unwrap();
    assert!(operation.preflight(&root).is_err());
    operation.selectors = vec!["260828-same".into(), "260828-new.MD".into()];
    let renamed = crate::transaction::run_transaction(&root, &mut operation);
    assert!(renamed.errors.is_empty(), "{:?}", renamed.errors);
    assert!(renamed.committed);
    let after_rename = index::parse_index(
        &std::fs::read(collection.join("investigation-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert!(!after_rename.index().entries.contains_key("260828-same"));
    assert_eq!(
        after_rename.index().entries["260828-new"].source_path,
        "same.md"
    );
    assert_eq!(after_rename.index().entries["260827-other"], state_b);
    std::fs::remove_file(collection.join("same.md")).unwrap();
    std::fs::create_dir(collection.join("_resources/260828-new")).unwrap();
    operation.selectors = vec!["260828-new".into()];
    assert_eq!(
        operation.preflight(&root).unwrap_err().code,
        "resource-owner-present"
    );
    std::fs::remove_dir(collection.join("_resources/260828-new")).unwrap();
    #[cfg(unix)]
    let external = {
        use std::os::unix::fs::symlink;
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("sentinel"), b"outside").unwrap();
        symlink(
            temp.path(),
            collection.join("_resources/260101-unselected-link"),
        )
        .unwrap();
        temp
    };
    let deleted = crate::transaction::run_transaction(&root, &mut operation);
    assert!(deleted.errors.is_empty(), "{:?}", deleted.errors);
    assert!(deleted.committed);
    #[cfg(unix)]
    {
        assert!(
            std::fs::symlink_metadata(collection.join("_resources/260101-unselected-link"))
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert_eq!(
            std::fs::read(external.path().join("sentinel")).unwrap(),
            b"outside"
        );
    }
}
