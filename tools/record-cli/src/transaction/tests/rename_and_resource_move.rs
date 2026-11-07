use super::*;

#[test]
fn rename_failure_before_exit_removes_only_owned_new_file() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut Rename { fail_delete: true },
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::RolledBack);
    assert!(!dir.path().join("new.md").exists());
    assert_eq!(std::fs::read(dir.path().join("old.md")).unwrap(), b"old");
}
#[test]
fn index_precommit_failure_restores_removed_original_and_removes_owned_copy() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut RecordExitFault::CopyThenDelete { rival: false },
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::RolledBack);
    assert_eq!(std::fs::read(dir.path().join("old.md")).unwrap(), b"old");
    assert!(!dir.path().join("new.md").exists());
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"old index"
    );
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut RecordExitFault::CopyThenDelete { rival: true },
    );
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(std::fs::read(dir.path().join("old.md")).unwrap(), b"winner");
    assert_eq!(std::fs::read(dir.path().join("new.md")).unwrap(), b"new");
}
#[test]
fn aliases_in_the_same_plan_are_rejected_before_writes() {
    struct Alias;
    impl TransactionOperation<()> for Alias {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let first = RelativePath::new("first.md").unwrap();
            let second = RelativePath::new("second.md").unwrap();
            Ok(Plan {
                value: (),
                writes: vec![WriteIntent {
                    before: capture(root, &first).unwrap(),
                    path: first,
                    after: Some(b"changed".to_vec()),
                    mode: None,
                }],
                guards: vec![Guard {
                    before: capture(root, &second).unwrap(),
                    path: second.clone(),
                }],
                resources: vec![],
                commit_point: CommitPoint::PublishedIndex(second),
            })
        }
        fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
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
    std::fs::write(dir.path().join("first.md"), b"original").unwrap();
    std::fs::hard_link(dir.path().join("first.md"), dir.path().join("second.md"))
        .expect("fixture requires native hard-link support");
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Alias);
    assert_eq!(result.errors[0].code, "invalid-plan");
    assert!(!result.changed);
    assert_eq!(
        std::fs::read(dir.path().join("first.md")).unwrap(),
        b"original"
    );
    assert_eq!(
        std::fs::read(dir.path().join("second.md")).unwrap(),
        b"original"
    );
}
#[test]
fn unlock_failure_preserves_committed_fact_and_withholds_review() {
    struct TamperLock;
    impl TransactionOperation<()> for TamperLock {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            Creation.prepare(root)
        }
        fn fresh(&mut self, root: &Root, plan: &Plan<()>) -> Result<(), TxError> {
            Creation.fresh(root, plan)
        }
        fn verify(&mut self, root: &Root, plan: &Plan<()>) -> Result<(), TxError> {
            Creation.verify(root, plan)?;
            std::fs::write(root.path().join(".lock"), b"rival").unwrap();
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut TamperLock);
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.committed && result.changed);
    assert_eq!(result.verification, VerificationStatus::Passed);
    assert_eq!(result.outcome, RecoveryStatus::CommittedCleanupPending);
    assert!(result.value.is_none());
    assert_eq!(
        std::fs::read(dir.path().join("candidate.md")).unwrap(),
        b"candidate"
    );
    assert_eq!(std::fs::read(dir.path().join(".lock")).unwrap(), b"rival");
}
#[test]
fn resource_tree_move_commits_and_reads_back_members() {
    let dir = resource_move_fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ResourceMove::Success,
    );
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(result.recovery_backups.is_empty());
    assert!(!std::fs::read_dir(dir.path()).unwrap().any(|entry| {
        entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".record-cli-recovery-")
    }));
    assert!(!dir.path().join("old-assets").exists());
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
    assert_eq!(
        std::fs::read(dir.path().join("new.md")).unwrap(),
        b"new record"
    );
}
#[test]
fn resource_recovery_preserves_unowned_directory_and_verified_backup() {
    let dir = resource_move_fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ResourceMove::FailAfterResources,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(
        result
            .unknown_paths
            .contains(&RelativePath::new("old-assets").unwrap())
    );
    assert!(!dir.path().join("old-assets/item.txt").exists());
    let backup = result
        .recovery_backups
        .iter()
        .find(|b| b.source == RelativePath::new("old-assets/item.txt").unwrap())
        .expect("resource backup");
    assert_eq!(
        backup.source,
        RelativePath::new("old-assets/item.txt").unwrap()
    );
    assert_eq!(
        std::fs::read(dir.path().join(backup.backup.as_path())).unwrap(),
        b"asset"
    );
    assert!(dir.path().join("new-assets").is_dir());
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
    assert_eq!(
        std::fs::read(dir.path().join("old.md")).unwrap(),
        b"old record"
    );
}
#[test]
fn resource_recovery_keeps_later_editor_and_verified_original_backup() {
    let dir = resource_move_fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut ResourceMove::RivalAfterResources,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!dir.path().join("old-assets/item.txt").exists());
    let backup = result
        .recovery_backups
        .iter()
        .find(|b| b.source == RelativePath::new("old-assets/item.txt").unwrap())
        .expect("resource backup");
    assert_eq!(
        std::fs::read(dir.path().join(backup.backup.as_path())).unwrap(),
        b"asset"
    );
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"rival"
    );
}
