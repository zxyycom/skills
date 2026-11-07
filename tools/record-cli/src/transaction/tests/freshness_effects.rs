use super::*;

fn record_exit_plan(root: &Root) -> Plan<()> {
    let path = RelativePath::new("record.md").unwrap();
    Plan {
        value: (),
        writes: vec![WriteIntent {
            path: path.clone(),
            before: capture(root, &path).unwrap(),
            after: None,
            mode: None,
        }],
        guards: vec![],
        resources: vec![],
        commit_point: CommitPoint::Exited(path),
    }
}

#[test]
fn update_accepts_same_content_replacement_during_fresh() {
    use std::os::unix::fs::PermissionsExt;
    struct ReplaceBeforeWrite;
    impl TransactionOperation<()> for ReplaceBeforeWrite {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let path = RelativePath::new("record.md").unwrap();
            Ok(Plan {
                value: (),
                writes: vec![WriteIntent {
                    before: capture(root, &path).unwrap(),
                    path: path.clone(),
                    after: Some(b"new".to_vec()),
                    mode: None,
                }],
                guards: vec![],
                resources: vec![],
                commit_point: CommitPoint::Updated(path),
            })
        }
        fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
            let original = root.path().join("record.md");
            let replacement = root.path().join("replacement");
            std::fs::write(&replacement, b"old").unwrap();
            std::fs::set_permissions(&replacement, std::fs::Permissions::from_mode(0o640)).unwrap();
            std::fs::rename(replacement, original).unwrap();
            Ok(())
        }
        fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old").unwrap();
    std::fs::set_permissions(
        dir.path().join("record.md"),
        std::fs::Permissions::from_mode(0o640),
    )
    .unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ReplaceBeforeWrite,
    );
    assert_eq!(outcome.status, TxStatus::Ok, "{:?}", outcome.errors);
    assert!(outcome.changed && outcome.committed);
    assert_eq!(std::fs::read(dir.path().join("record.md")).unwrap(), b"new");
}

#[test]
fn indeterminate_replace_reports_unknown_and_retains_backup() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("candidates")).unwrap();
    std::fs::write(dir.path().join("candidates/legacy.md"), b"old").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    crate::source::fail_after_replace_for_test();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut SamePathRename {
            fail_verify: false,
            corrupt_lock: false,
            fail_before_write: false,
        },
    );
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(!outcome.committed);
    assert_eq!(outcome.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(
        outcome
            .unknown_paths
            .contains(&RelativePath::new("candidates/legacy.md").unwrap())
    );
    assert!(
        outcome
            .errors
            .iter()
            .any(|e| e.message.contains("injected post-rename failure"))
    );
    assert_eq!(
        std::fs::read(dir.path().join("candidates/legacy.md")).unwrap(),
        b"id: NEW-ID\nbody\n"
    );
    assert_eq!(outcome.recovery_backups.len(), 1);
    assert_eq!(
        std::fs::read(
            dir.path()
                .join(outcome.recovery_backups[0].backup.as_path())
        )
        .unwrap(),
        b"old"
    );
}

#[test]
fn successful_exit_is_committed_even_if_readback_fails() {
    struct Exit;
    impl TransactionOperation<()> for Exit {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            Ok(record_exit_plan(root))
        }
        fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn before_write(&mut self, _: &Root, _: usize) -> Result<(), TxError> {
            crate::source::fail_after_remove_for_test();
            Ok(())
        }
        fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let outcome = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Exit);
    let path = RelativePath::new("record.md").unwrap();
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(outcome.changed && outcome.committed);
    assert!(outcome.written_paths.contains(&path) && outcome.unknown_paths.contains(&path));
    assert!(!dir.path().join("record.md").exists());
    assert_eq!(outcome.recovery_backups.len(), 1);
    assert_eq!(
        std::fs::read(
            dir.path()
                .join(outcome.recovery_backups[0].backup.as_path())
        )
        .unwrap(),
        b"old"
    );
}

#[test]
fn failed_creation_initialization_reports_actual_target_without_commit() {
    let dir = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    super::super::writes::fail_initialize_for_test();
    let outcome = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Creation);
    let path = RelativePath::new("candidate.md").unwrap();
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(outcome.changed && !outcome.committed);
    assert!(outcome.written_paths.contains(&path) && outcome.unknown_paths.contains(&path));
    assert_eq!(std::fs::read(dir.path().join("candidate.md")).unwrap(), b"");
    assert!(
        outcome
            .errors
            .iter()
            .any(|e| e.message.contains("injected create initialization failure"))
    );
}

#[test]
fn temporary_failures_report_path_and_primary_and_cleanup_causes_without_target_write() {
    for identity_failure in [true, false] {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("candidates")).unwrap();
        std::fs::write(dir.path().join("candidates/legacy.md"), b"old").unwrap();
        let root = crate::source::open_root(dir.path()).unwrap();
        if identity_failure {
            crate::source::fail_temp_identity_for_test();
        } else {
            crate::source::fail_temp_cleanup_for_test();
        }
        let outcome = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut SamePathRename {
                fail_verify: false,
                corrupt_lock: false,
                fail_before_write: false,
            },
        );
        assert_eq!(outcome.status, TxStatus::Error);
        assert!(!outcome.changed && !outcome.committed);
        assert_eq!(outcome.outcome, RecoveryStatus::NoChange);
        assert!(outcome.unknown_paths.is_empty());
        assert_eq!(
            std::fs::read(dir.path().join("candidates/legacy.md")).unwrap(),
            b"old"
        );
        let message = if identity_failure {
            "injected temporary identity failure"
        } else {
            "injected temporary write failure"
        };
        assert!(outcome.errors.iter().any(|e| e.message.contains(message)));
        let temp = std::fs::read_dir(dir.path().join("candidates"))
            .unwrap()
            .map(|e| e.unwrap().path())
            .find(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with(".record-cli-")
            })
            .expect("retained temp");
        assert!(
            outcome
                .cleanup_errors
                .iter()
                .any(|e| e.message.contains(temp.to_str().unwrap())
                    && (identity_failure
                        || e.message.contains("injected temporary cleanup failure")))
        );
        assert!(outcome.recovery_backups.is_empty());
    }
}

#[test]
fn delete_accepts_equal_replacement_but_preserves_changed_source() {
    use std::os::unix::fs::PermissionsExt;
    struct Delete {
        bytes: &'static [u8],
    }
    impl TransactionOperation<()> for Delete {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            Ok(record_exit_plan(root))
        }
        fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn before_write(&mut self, root: &Root, _: usize) -> Result<(), TxError> {
            let replacement = root.path().join("replacement");
            std::fs::write(&replacement, self.bytes).unwrap();
            std::fs::set_permissions(&replacement, std::fs::Permissions::from_mode(0o640)).unwrap();
            std::fs::rename(replacement, root.path().join("record.md")).unwrap();
            Ok(())
        }
        fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    for bytes in [b"old".as_slice(), b"edit".as_slice()] {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("record.md"), b"old").unwrap();
        std::fs::set_permissions(
            dir.path().join("record.md"),
            std::fs::Permissions::from_mode(0o640),
        )
        .unwrap();
        let root = crate::source::open_root(dir.path()).unwrap();
        let outcome = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut Delete { bytes },
        );
        if bytes == b"old" {
            assert_eq!(outcome.status, TxStatus::Ok, "{:?}", outcome.errors);
            assert!(outcome.committed && !dir.path().join("record.md").exists());
        } else {
            assert_eq!(outcome.status, TxStatus::Error);
            assert!(!outcome.committed);
            assert_eq!(
                std::fs::read(dir.path().join("record.md")).unwrap(),
                b"edit"
            );
        }
    }
}

#[test]
fn resource_copy_and_delete_accept_equal_inode_replacement() {
    use std::os::unix::fs::PermissionsExt;
    struct SwapResource;
    impl TransactionOperation<()> for SwapResource {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            ResourceMove::Success.prepare(root)
        }
        fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
            let path = root.path().join("old-assets/item.txt");
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            let replacement = root.path().join("old-assets/replacement");
            std::fs::write(&replacement, b"asset").unwrap();
            std::fs::set_permissions(&replacement, std::fs::Permissions::from_mode(mode)).unwrap();
            std::fs::rename(replacement, path).unwrap();
            Ok(())
        }
        fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    let dir = resource_move_fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut SwapResource,
    );
    assert_eq!(outcome.status, TxStatus::Ok, "{:?}", outcome.errors);
    assert!(outcome.committed);
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
}
