use super::*;
#[test]
fn full_sync_tracks_resources_without_treating_in_place_bytes_as_index_revision() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir_all(collection.join("_resources/260828-same")).unwrap();
    let text = format!(
        "{}\n## 随附资源\n- [evidence](./_resources/260828-same/file.txt)\n",
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/investigation-same.md"
        ))
    );
    std::fs::write(collection.join("same.md"), &text).unwrap();
    std::fs::write(collection.join("_resources/260828-same/file.txt"), b"old").unwrap();
    std::fs::write(collection.join("investigation-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = InvestigationSyncOperation {
        directory: "investigations".into(),
    };
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.state, "previewed");
    assert!(!preview.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        b"broken"
    );
    let written = crate::transaction::run_transaction(&root, &mut operation);
    assert!(written.errors.is_empty(), "{:?}", written.errors);
    assert!(written.changed && written.committed);
    let before_index = std::fs::read(collection.join("investigation-index.json")).unwrap();
    std::fs::write(
        collection.join("_resources/260828-same/other.txt"),
        b"second",
    )
    .unwrap();
    std::fs::write(
        collection.join("same.md"),
        text.replace("260828-same/file.txt", "260828-same/other.txt"),
    )
    .unwrap();
    let changed_reference =
        crate::mutations::check::investigation(&root, "investigations", &[]).unwrap_err();
    assert_eq!(changed_reference.code, "index-not-current");
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        before_index
    );
    std::fs::write(collection.join("same.md"), &text).unwrap();
    std::fs::write(
        collection.join("_resources/260828-same/file.txt"),
        b"changed resource content",
    )
    .unwrap();
    let unchanged = crate::transaction::run_transaction(&root, &mut operation);
    assert!(unchanged.errors.is_empty(), "{:?}", unchanged.errors);
    assert!(!unchanged.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        before_index
    );
    std::fs::write(
        collection.join("same.md"),
        format!("{text}\nAdditional content.\n"),
    )
    .unwrap();
    std::fs::remove_file(collection.join("_resources/260828-same/file.txt")).unwrap();
    let rejected = crate::transaction::run_transaction(&root, &mut operation);
    assert!(!rejected.errors.is_empty());
    assert!(!rejected.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        before_index
    );
}
#[test]
fn unreferenced_unsafe_resource_root_is_warning() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    std::fs::write(
        collection.join("same.md"),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/investigation-same.md"
        )),
    )
    .unwrap();
    std::fs::write(collection.join("_resources"), b"not a directory").unwrap();
    std::fs::write(collection.join("investigation-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = InvestigationSyncOperation {
        directory: "investigations".into(),
    };
    let preview = operation.preflight(&root).unwrap();
    assert!(
        preview
            .warnings
            .iter()
            .any(|warning| warning.contains("unsafe"))
    );
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
}
