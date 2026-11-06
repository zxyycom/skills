use super::*;

#[test]
fn planned_but_unwritten_namespace_member_is_never_treated_as_owned() {
    let dir = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut NamespaceProbe::Rival,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("collection/candidate.md")).unwrap(),
        b"rival"
    );
}
#[test]
fn same_path_candidate_identity_update_commits_only_actual_updated_content() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("candidates")).unwrap();
    std::fs::write(
        dir.path().join("candidates/legacy.md"),
        b"id: OLD-ID\nbody\n",
    )
    .unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut SamePathRename {
            fail_verify: false,
            corrupt_lock: false,
            fail_before_write: false,
        },
    );
    assert_eq!(result.status, TxStatus::Ok);
    assert!(result.committed && result.changed);
    assert_eq!(result.verification, VerificationStatus::Passed);
    assert_eq!(
        std::fs::read(dir.path().join("candidates/legacy.md")).unwrap(),
        b"id: NEW-ID\nbody\n"
    );
}
#[test]
fn same_path_candidate_identity_update_preserves_commit_on_postverify_or_unlock_failure() {
    for corrupt_lock in [false, true] {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("candidates")).unwrap();
        std::fs::write(
            dir.path().join("candidates/legacy.md"),
            b"id: OLD-ID\nbody\n",
        )
        .unwrap();
        let root = crate::source::open_root(dir.path()).unwrap();
        let result = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut SamePathRename {
                fail_verify: !corrupt_lock,
                corrupt_lock,
                fail_before_write: false,
            },
        );
        assert_eq!(result.status, TxStatus::Error);
        assert!(result.committed && result.changed);
        assert!(result.value.is_none());
        assert_eq!(
            result.outcome,
            if corrupt_lock {
                RecoveryStatus::CommittedCleanupPending
            } else {
                RecoveryStatus::PartialOrUnknown
            }
        );
        assert_eq!(
            std::fs::read(dir.path().join("candidates/legacy.md")).unwrap(),
            b"id: NEW-ID\nbody\n"
        );
    }
}
#[test]
fn same_path_candidate_identity_update_failure_before_write_is_unchanged() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("candidates")).unwrap();
    std::fs::write(
        dir.path().join("candidates/legacy.md"),
        b"id: OLD-ID\nbody\n",
    )
    .unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut SamePathRename {
            fail_verify: false,
            corrupt_lock: false,
            fail_before_write: true,
        },
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed && !result.changed);
    assert_eq!(
        std::fs::read(dir.path().join("candidates/legacy.md")).unwrap(),
        b"id: OLD-ID\nbody\n"
    );
}
#[test]
fn resource_owner_and_nested_directory_keep_exact_mode_when_natively_creatable() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::create_dir_all(dir.path().join("old-assets/nested")).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            dir.path().join("old-assets/nested"),
            std::fs::Permissions::from_mode(0o700),
        )
        .unwrap();
    }
    std::fs::write(dir.path().join("old-assets/nested/item.txt"), b"asset").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let before_owner =
        crate::source::enumerate_directory(&root, &RelativePath::new("old-assets").unwrap())
            .unwrap()
            .identity
            .mode;
    let before_nested =
        crate::source::enumerate_directory(&root, &RelativePath::new("old-assets/nested").unwrap())
            .unwrap()
            .identity
            .mode;
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ExactResourceModeMove { drift: false },
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    let after_owner =
        crate::source::enumerate_directory(&root, &RelativePath::new("new-assets").unwrap())
            .unwrap()
            .identity
            .mode;
    let after_nested =
        crate::source::enumerate_directory(&root, &RelativePath::new("new-assets/nested").unwrap())
            .unwrap()
            .identity
            .mode;
    assert_eq!(after_owner, before_owner);
    assert_eq!(after_nested, before_nested);
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/nested/item.txt")).unwrap(),
        b"asset"
    );
    assert!(!dir.path().join("old-assets").exists());
}
#[test]
fn resource_directory_mode_copy_rejects_source_membership_drift_before_writes() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::create_dir_all(dir.path().join("old-assets/nested")).unwrap();
    std::fs::write(dir.path().join("old-assets/nested/item.txt"), b"asset").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ExactResourceModeMove { drift: true },
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed && !result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("old-assets/rival.txt")).unwrap(),
        b"rival"
    );
    assert!(!dir.path().join("new-assets").exists());
}
#[test]
fn resource_directory_mode_mismatch_preserves_old_tree_without_chmod() {
    #[cfg(unix)]
    if std::env::var_os("RECORD_CLI_RESTRICTIVE_UMASK_CHILD").is_none() {
        let executable = std::env::current_exe().unwrap();
        let status = std::process::Command::new("sh").arg("-c")
            .arg("umask 077; exec \"$1\" --exact transaction::tests::candidate_and_modes::resource_directory_mode_mismatch_preserves_old_tree_without_chmod --nocapture")
            .arg("record-cli-test").arg(executable).env("RECORD_CLI_RESTRICTIVE_UMASK_CHILD", "1").status().unwrap();
        assert!(status.success(), "isolated restrictive-umask child failed");
        return;
    }
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::create_dir_all(dir.path().join("old-assets/nested")).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            dir.path().join("old-assets"),
            std::fs::Permissions::from_mode(0o775),
        )
        .unwrap();
    }
    std::fs::write(dir.path().join("old-assets/nested/item.txt"), b"asset").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let expected_mode =
        crate::source::enumerate_directory(&root, &RelativePath::new("old-assets").unwrap())
            .unwrap()
            .identity
            .mode;
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ExactResourceModeMove { drift: false },
    );
    #[cfg(unix)]
    {
        assert_eq!(result.status, TxStatus::Error);
        assert!(!result.committed);
        assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
        assert!(
            result
                .unknown_paths
                .contains(&RelativePath::new("new-assets").unwrap())
        );
        assert_eq!(
            std::fs::read(dir.path().join("old-assets/nested/item.txt")).unwrap(),
            b"asset"
        );
        assert_eq!(
            crate::source::enumerate_directory(&root, &RelativePath::new("old-assets").unwrap())
                .unwrap()
                .identity
                .mode,
            expected_mode
        );
        assert_eq!(result.recovery_backups.len(), 1);
        assert_eq!(
            std::fs::read(dir.path().join(result.recovery_backups[0].backup.as_path())).unwrap(),
            b"asset"
        );
    }
    #[cfg(windows)]
    {
        assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
        assert_eq!(
            crate::source::enumerate_directory(&root, &RelativePath::new("new-assets").unwrap())
                .unwrap()
                .identity
                .mode,
            expected_mode
        );
    }
}
