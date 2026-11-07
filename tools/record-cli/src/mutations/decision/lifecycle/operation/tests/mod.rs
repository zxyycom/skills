use super::*;
use crate::{domains::decision::Definition, index::serialize_index};
#[test]
fn private_mark_aligned_preflight_and_transaction() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let (text, index) = crate::mutations::tests::decision_fixture::sample(false);
    let id = crate::mutations::tests::decision_fixture::ID;
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = MarkAlignedOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: "one".into(),
    };
    let preview = crate::transaction::preflight(&root, &mut operation).unwrap();
    assert_eq!(preview.writes.len(), 2);
    assert_eq!(
        std::fs::read(collection.join("one.md")).unwrap(),
        text.as_bytes()
    );
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
    let index = std::fs::read(collection.join("decision-index.json")).unwrap();
    let parsed = crate::index::parse_index(&index, &Definition).unwrap();
    assert_eq!(parsed.index().entries[id].alignment, "aligned");
    let text_after = std::fs::read_to_string(collection.join("one.md")).unwrap();
    assert!(text_after.contains("Body remains."));
    let rejected = crate::transaction::run_transaction(&root, &mut operation);
    assert_eq!(
        rejected.errors[0].code,
        "decision-records.lifecycle-invalid"
    );
    assert!(
        rejected.errors[0]
            .reason
            .as_deref()
            .unwrap()
            .contains("one.md")
    );
    assert!(rejected.errors[0].recovery.is_some());
    assert!(!rejected.changed);
}
#[test]
fn private_reactivate_moves_source_and_publishes_index() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir_all(collection.join("archive")).unwrap();
    let (text, index) = crate::mutations::tests::decision_fixture::sample(true);
    let id = crate::mutations::tests::decision_fixture::ID;
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("archive/one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = ReactivateOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: "one".into(),
        alignment: Alignment::Aligned,
    };
    assert_eq!(
        crate::transaction::preflight(&root, &mut operation)
            .unwrap()
            .writes
            .len(),
        3
    );
    assert!(!collection.join("one.md").exists());
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
    assert!(!collection.join("archive/one.md").exists());
    assert!(collection.join("one.md").is_file());
    let index = std::fs::read(collection.join("decision-index.json")).unwrap();
    let parsed = crate::index::parse_index(&index, &Definition).unwrap();
    assert_eq!(parsed.index().entries[id].alignment, "aligned");
    assert_eq!(parsed.index().entries[id].status, "active");
}
fn archive_fixture() -> (tempfile::TempDir, Root, &'static str, Vec<u8>) {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let (text, index) = crate::mutations::tests::decision_fixture::sample(false);
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    (dir, root, text, index_bytes)
}
#[test]
fn private_archive_requires_unborn_history_confirmation() {
    let (dir, root, _text, _index_bytes) = archive_fixture();
    let collection = dir.path().join("decisions");
    let initialized = std::process::Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(initialized.success());
    let mut operation = ArchiveOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selectors: vec!["one".into()],
        keep_unrecorded_history: false,
    };
    let unconfirmed = crate::transaction::run_transaction(&root, &mut operation);
    assert_eq!(
        unconfirmed.errors[0].code,
        "decision-records.unrecorded-history"
    );
    assert!(
        unconfirmed.errors[0]
            .target
            .as_deref()
            .unwrap()
            .contains("one")
    );
    assert!(
        unconfirmed.errors[0]
            .recovery
            .as_deref()
            .unwrap()
            .contains("--keep-unrecorded-history")
    );
    assert!(!unconfirmed.changed);
    operation.keep_unrecorded_history = true;
    std::fs::create_dir(collection.join("archive")).unwrap();
    std::fs::remove_dir(collection.join("archive")).unwrap();
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
    assert!(!collection.join("one.md").exists());
    assert!(collection.join("archive/one.md").is_file());
}
