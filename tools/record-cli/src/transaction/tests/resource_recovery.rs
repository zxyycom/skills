use super::*;

#[test]
fn removed_resource_recovery_rejects_replaced_parent_before_creating() {
    let dir = resource_ancestor_fixture();
    let (worker, entered, resume) =
        start_resource_parent_swap(dir.path(), SwapPhase::BeforeWrite, true);
    let worker = wait_for_worker(&entered, worker);
    std::fs::rename(dir.path().join("outer"), dir.path().join("original-outer")).unwrap();
    std::fs::create_dir(dir.path().join("outer")).unwrap();
    std::fs::write(dir.path().join("outer/winner.txt"), b"winner").unwrap();
    resume.wait();
    let result = worker.join().unwrap();
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("outer/winner.txt")).unwrap(),
        b"winner"
    );
    assert!(!dir.path().join("outer/old-assets").exists());
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
}
#[test]
fn deleted_resource_file_recovery_does_not_write_into_replaced_parent() {
    let dir = resource_ancestor_fixture();
    let (worker, entered, resume) =
        start_resource_parent_swap(dir.path(), SwapPhase::BeforeWrite, false);
    let worker = wait_for_worker(&entered, worker);
    std::fs::rename(dir.path().join("outer"), dir.path().join("original-outer")).unwrap();
    std::fs::create_dir_all(dir.path().join("outer/old-assets")).unwrap();
    std::fs::write(dir.path().join("outer/old-assets/winner.txt"), b"winner").unwrap();
    resume.wait();
    let result = worker.join().unwrap();
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("outer/old-assets/winner.txt")).unwrap(),
        b"winner"
    );
    assert!(!dir.path().join("outer/old-assets/item.txt").exists());
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
}
#[test]
fn pure_resource_deletion_keeps_durable_bytes_and_mode_when_directory_ownership_unknown() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::create_dir(dir.path().join("old-assets")).unwrap();
    std::fs::write(dir.path().join("old-assets/item.txt"), b"unique old bytes").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let ExpectedFile::Present(original) =
        capture(&root, &RelativePath::new("old-assets/item.txt").unwrap()).unwrap()
    else {
        panic!("missing resource")
    };
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut DeleteOnly {
            mkdir_barrier: None,
        },
    );
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!result.committed);
    let backup = result
        .recovery_backups
        .iter()
        .find(|b| b.source == original.path)
        .expect("original resource backup");
    assert_eq!(backup.mode, exact_mode(original.identity.mode));
    let ExpectedFile::Present(saved) = capture(&root, &backup.backup).unwrap() else {
        panic!("backup missing")
    };
    assert_eq!(saved.bytes, original.bytes);
    assert_eq!(saved.identity.mode, original.identity.mode);
    assert!(!dir.path().join("old-assets/item.txt").exists());
}
