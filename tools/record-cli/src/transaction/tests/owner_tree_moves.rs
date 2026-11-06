use super::*;

#[test]
fn owner_tree_move_preserves_directory_and_file_modes_under_restrictive_umask() {
    #[cfg(unix)]
    if std::env::var_os("RECORD_CLI_TRANSACTION_MOVE_UMASK_CHILD").is_none() {
        let status = std::process::Command::new("sh").arg("-c").arg("umask 077; exec \"$1\" --exact transaction::tests::owner_tree_moves::owner_tree_move_preserves_directory_and_file_modes_under_restrictive_umask --nocapture").arg("record-cli-test").arg(std::env::current_exe().unwrap()).env("RECORD_CLI_TRANSACTION_MOVE_UMASK_CHILD", "1").status().unwrap();
        assert!(status.success(), "isolated restrictive-umask child failed");
        return;
    }
    let (dir, root) = owner_tree_fixture();
    let owner_mode =
        crate::source::enumerate_directory(&root, &RelativePath::new("_resources/old").unwrap())
            .unwrap()
            .identity
            .mode;
    let nested_mode = crate::source::enumerate_directory(
        &root,
        &RelativePath::new("_resources/old/nested").unwrap(),
    )
    .unwrap()
    .identity
    .mode;
    let ExpectedFile::Present(file_before) = capture(
        &root,
        &RelativePath::new("_resources/old/nested/item").unwrap(),
    )
    .unwrap() else {
        panic!("missing")
    };
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut OwnerTreeMove::Success,
    );
    assert_eq!(
        result.status,
        TxStatus::Ok,
        "{:?} {:?}",
        result.errors,
        result.cleanup_errors
    );
    assert!(result.committed);
    assert!(!dir.path().join("_resources/old").exists());
    assert_eq!(
        crate::source::enumerate_directory(&root, &RelativePath::new("_resources/new").unwrap())
            .unwrap()
            .identity
            .mode,
        owner_mode
    );
    assert_eq!(
        crate::source::enumerate_directory(
            &root,
            &RelativePath::new("_resources/new/nested").unwrap()
        )
        .unwrap()
        .identity
        .mode,
        nested_mode
    );
    let ExpectedFile::Present(file_after) = capture(
        &root,
        &RelativePath::new("_resources/new/nested/item").unwrap(),
    )
    .unwrap() else {
        panic!("missing")
    };
    assert_eq!(file_after.identity.mode, file_before.identity.mode);
    assert_eq!(file_after.bytes, file_before.bytes);
    assert!(result.recovery_backups.is_empty());
}
#[test]
fn owner_tree_move_target_winner_is_not_overwritten() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut OwnerTreeMove::TargetWinner,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed && !result.changed);
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/winner")).unwrap(),
        b"winner"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"old resource"
    );
}
#[test]
fn owner_tree_move_preindex_failure_conditionally_restores_original_tree() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut OwnerTreeMove::FailBeforeIndex,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(
        result.outcome,
        RecoveryStatus::RolledBack,
        "{:?}",
        result.cleanup_errors
    );
    assert_eq!(result.planned_value, Some(()));
    assert!(result.value.is_none());
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"old resource"
    );
    assert!(!dir.path().join("_resources/new").exists());
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"old record"
    );
    assert!(result.recovery_backups.is_empty());
}
#[test]
fn owner_tree_move_postcommit_failure_keeps_moved_tree_and_verified_backup() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut OwnerTreeMove::FailPostverify,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!dir.path().join("_resources/old").exists());
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
        b"old resource"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"new index"
    );
    assert_eq!(result.recovery_backups.len(), 1);
    assert_eq!(
        std::fs::read(dir.path().join(result.recovery_backups[0].backup.as_path())).unwrap(),
        b"old resource"
    );
}
#[test]
fn owner_tree_move_recovery_never_overwrites_recreated_original_or_edited_target() {
    for original in [true, false] {
        let (dir, root) = owner_tree_fixture();
        let result = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut if original {
                OwnerTreeMove::RecreateOriginal
            } else {
                OwnerTreeMove::EditDestination
            },
        );
        assert_eq!(result.status, TxStatus::Error);
        assert!(!result.committed);
        assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
        if original {
            assert_eq!(
                std::fs::read(dir.path().join("_resources/old/winner")).unwrap(),
                b"winner"
            );
            assert_eq!(
                std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
                b"old resource"
            );
        } else {
            assert!(!dir.path().join("_resources/old").exists());
            assert_eq!(
                std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
                b"later edit"
            );
        }
        assert_eq!(result.recovery_backups.len(), 1);
        assert_eq!(
            std::fs::read(dir.path().join(result.recovery_backups[0].backup.as_path())).unwrap(),
            b"old resource"
        );
    }
}
