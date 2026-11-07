use super::*;

#[test]
fn missing_parent_replacement_before_fresh_uses_safe_current_parent() {
    struct SwapParent;
    impl TransactionOperation<()> for SwapParent {
        fn prepare(&mut self, _: &Root) -> Result<Plan<()>, TxError> {
            let path = RelativePath::new("parent/item.md").unwrap();
            Ok(Plan {
                value: (),
                writes: vec![WriteIntent {
                    path: path.clone(),
                    before: ExpectedFile::Missing,
                    after: Some(b"new".to_vec()),
                    mode: Some(WriteMode::Native(0o600)),
                }],
                guards: vec![],
                resources: vec![],
                commit_point: CommitPoint::Created(path),
            })
        }
        fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
            {
                std::fs::rename(root.path().join("parent"), root.path().join("old-parent"))
                    .unwrap();
                std::fs::create_dir(root.path().join("parent")).unwrap();
            }
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
    std::fs::create_dir(dir.path().join("parent")).unwrap();
    std::fs::write(dir.path().join("parent/sentinel"), b"keep").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut SwapParent);
    {
        assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
        assert!(result.changed && result.committed);
        assert_eq!(
            std::fs::read(dir.path().join("parent/item.md")).unwrap(),
            b"new"
        );
        assert_eq!(
            std::fs::read(dir.path().join("old-parent/sentinel")).unwrap(),
            b"keep"
        );
    }
}
#[test]
fn resource_nested_created_parents_extend_original_missing_proof() {
    struct Nested;
    impl TransactionOperation<()> for Nested {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let mut plan = ResourceMove::Success.prepare(root)?;
            plan.resources.insert(
                1,
                ResourceIntent::CreateDirectory {
                    path: RelativePath::new("new-assets/nested").unwrap(),
                },
            );
            plan.resources[2] = ResourceIntent::CopyFile {
                source: RelativePath::new("old-assets/item.txt").unwrap(),
                destination: RelativePath::new("new-assets/nested/item.txt").unwrap(),
            };
            Ok(plan)
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
    let dir = resource_move_fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Nested);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/nested/item.txt")).unwrap(),
        b"asset"
    );
}
#[test]
fn deleted_record_recovery_rejects_replaced_parent_before_creating() {
    use std::sync::Arc;
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("records")).unwrap();
    std::fs::write(dir.path().join("records/old.md"), b"old").unwrap();
    std::fs::write(dir.path().join("index.json"), b"index").unwrap();
    let entered = Arc::new(TimedBarrier::new("entered"));
    let resume = Arc::new(TimedBarrier::new("resume"));
    let e = entered.clone();
    let r = resume.clone();
    let path = dir.path().to_path_buf();
    let worker = std::thread::spawn(move || {
        let root = crate::source::open_root(&path).unwrap();
        run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut RecordExitFault::DeleteUnderReplacedParent {
                entered: e,
                resume: r,
            },
        )
    });
    let worker = wait_for_worker(&entered, worker);
    std::fs::rename(
        dir.path().join("records"),
        dir.path().join("original-records"),
    )
    .unwrap();
    std::fs::create_dir(dir.path().join("records")).unwrap();
    std::fs::write(dir.path().join("records/winner.txt"), b"winner").unwrap();
    resume.wait();
    let result = worker.join().unwrap();
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!result.committed);
    assert!(!dir.path().join("records/old.md").exists());
    assert_eq!(
        std::fs::read(dir.path().join("records/winner.txt")).unwrap(),
        b"winner"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"index"
    );
}
#[test]
fn removed_resource_ancestor_replacement_fails_postverify_without_rollback() {
    let dir = resource_ancestor_fixture();
    let (worker, entered, resume) =
        start_resource_parent_swap(dir.path(), SwapPhase::BeforePostverify, true);
    let worker = wait_for_worker(&entered, worker);
    std::fs::rename(dir.path().join("outer"), dir.path().join("original-outer")).unwrap();
    std::fs::create_dir(dir.path().join("outer")).unwrap();
    std::fs::write(dir.path().join("outer/winner.txt"), b"winner").unwrap();
    resume.wait();
    let result = worker.join().unwrap();
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.committed);
    assert_eq!(result.verification, VerificationStatus::FailedOrUnknown);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("outer/winner.txt")).unwrap(),
        b"winner"
    );
    assert_eq!(
        std::fs::read(dir.path().join("new-assets/item.txt")).unwrap(),
        b"asset"
    );
    assert_eq!(
        std::fs::read(dir.path().join("new.md")).unwrap(),
        b"new record"
    );
}
