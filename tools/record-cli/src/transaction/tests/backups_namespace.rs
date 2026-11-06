use super::*;

#[test]
fn same_mode_rival_between_recovery_mkdir_and_open_keeps_bytes_in_durable_backup() {
    use std::sync::{Arc, Barrier};
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::create_dir(dir.path().join("old-assets")).unwrap();
    std::fs::create_dir(dir.path().join("rival-dir")).unwrap();
    std::fs::write(
        dir.path().join("old-assets/item.txt"),
        b"unique original bytes",
    )
    .unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let original_dir =
        crate::source::enumerate_directory(&root, &RelativePath::new("old-assets").unwrap())
            .unwrap();
    let rival_dir =
        crate::source::enumerate_directory(&root, &RelativePath::new("rival-dir").unwrap())
            .unwrap();
    assert_eq!(
        original_dir.identity.mode, rival_dir.identity.mode,
        "rival must have the same native representation"
    );
    let ExpectedFile::Present(original) =
        capture(&root, &RelativePath::new("old-assets/item.txt").unwrap()).unwrap()
    else {
        panic!("original missing")
    };
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let e = entered.clone();
    let r = resume.clone();
    let path = dir.path().to_path_buf();
    let worker = std::thread::spawn(move || {
        let root = crate::source::open_root(&path).unwrap();
        run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut DeleteOnly {
                mkdir_barrier: Some((e, r)),
            },
        )
    });
    entered.wait();
    std::fs::rename(
        dir.path().join("old-assets"),
        dir.path().join("our-created-dir"),
    )
    .unwrap();
    std::fs::rename(dir.path().join("rival-dir"), dir.path().join("old-assets")).unwrap();
    resume.wait();
    let result = worker.join().unwrap();
    assert_eq!(result.status, TxStatus::Error);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!result.committed);
    assert!(
        result
            .unknown_paths
            .contains(&RelativePath::new("old-assets").unwrap())
    );
    assert_eq!(
        std::fs::read_dir(dir.path().join("old-assets"))
            .unwrap()
            .count(),
        0,
        "rival directory must remain untouched"
    );
    assert_eq!(result.recovery_directories.len(), 1);
    assert_eq!(
        result.recovery_directories[0].path,
        RelativePath::new("old-assets").unwrap()
    );
    assert_eq!(
        result.recovery_directories[0].mode,
        exact_mode(original_dir.identity.mode)
    );
    assert_eq!(result.recovery_backups.len(), 1);
    let backup = &result.recovery_backups[0];
    assert_eq!(backup.source, original.path);
    assert_eq!(backup.mode, exact_mode(original.identity.mode));
    let ExpectedFile::Present(saved) = capture(&root, &backup.backup).unwrap() else {
        panic!("backup missing")
    };
    assert_eq!(saved.bytes, original.bytes);
    assert_eq!(saved.identity.mode, original.identity.mode);
}
#[test]
fn changed_backup_is_not_deleted_or_reported_as_verified_on_cleanup_failure() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::create_dir(dir.path().join("old-assets")).unwrap();
    std::fs::write(dir.path().join("old-assets/item.txt"), b"asset").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ResourceMove::TamperBackup,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.committed);
    assert_eq!(result.verification, VerificationStatus::Passed);
    assert_eq!(result.outcome, RecoveryStatus::CommittedCleanupPending);
    assert!(result.recovery_backups.is_empty());
    assert!(!result.unknown_paths.is_empty());
    let path = &result.unknown_paths[0];
    assert_eq!(
        std::fs::read(dir.path().join(path.as_path())).unwrap(),
        b"later editor"
    );
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
}
#[test]
fn newly_created_namespace_accepts_only_actual_candidate_write() {
    let dir = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut FirstNamespace { barrier: None },
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed && result.changed);
    assert_eq!(result.verification, VerificationStatus::Passed);
    assert_eq!(
        std::fs::read(dir.path().join("collection/candidate.md")).unwrap(),
        b"new candidate"
    );
}
#[test]
fn newly_created_namespace_rejects_concurrent_unjournaled_member_after_commit() {
    use std::sync::{Arc, Barrier};
    let dir = tempfile::tempdir().unwrap();
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let e = entered.clone();
    let r = resume.clone();
    let path = dir.path().to_path_buf();
    let worker = std::thread::spawn(move || {
        let root = crate::source::open_root(&path).unwrap();
        run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut FirstNamespace {
                barrier: Some((e, r)),
            },
        )
    });
    entered.wait();
    std::fs::write(dir.path().join("collection/rival.md"), b"rival").unwrap();
    resume.wait();
    let result = worker.join().unwrap();
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.committed && result.changed);
    assert_eq!(result.verification, VerificationStatus::FailedOrUnknown);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("collection/candidate.md")).unwrap(),
        b"new candidate"
    );
    assert_eq!(
        std::fs::read(dir.path().join("collection/rival.md")).unwrap(),
        b"rival"
    );
}
#[test]
fn newly_created_namespace_accepts_prior_actual_write_before_later_index_publication() {
    let dir = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut NamespaceProbe::PriorWrite,
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("collection/candidate.md")).unwrap(),
        b"new candidate"
    );
    assert_eq!(
        std::fs::read(dir.path().join("collection/index.json")).unwrap(),
        b"index"
    );
}
