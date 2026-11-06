use super::*;

#[test]
fn unchanged_requires_fresh_read_and_independent_verification() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"original").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut op = Operation {
        path: RelativePath::new("record.md").unwrap(),
        change: false,
        drift: false,
        events: vec![],
    };
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut op);
    assert!(result.errors.is_empty() && result.cleanup_errors.is_empty());
    assert!(!result.changed && !result.committed);
    assert_eq!(result.verification, VerificationStatus::Passed);
    assert_eq!(op.events, ["prepare", "fresh", "verify"]);
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"original"
    );
    assert!(!dir.path().join(".lock").exists());
}
#[test]
fn fresh_drift_or_unsupported_write_never_overwrites() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"original").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let path = RelativePath::new("record.md").unwrap();
    let lock = RelativePath::new(".lock").unwrap();
    let mut drift = Operation {
        path: path.clone(),
        change: false,
        drift: true,
        events: vec![],
    };
    let result = run_transaction(&root, &lock, &mut drift);
    assert_eq!(result.errors[0].code, "source-changed");
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"rival"
    );
    std::fs::write(dir.path().join("record.md"), b"original").unwrap();
    let mut write = Operation {
        path,
        change: true,
        drift: false,
        events: vec![],
    };
    let result = run_transaction(&root, &lock, &mut write);
    assert_eq!(result.errors[0].code, "invalid-plan");
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"original"
    );
}
#[test]
fn publication_writes_and_independently_verifies_real_files() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old record").unwrap();
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut op = Publication {
        fail_verify: false,
        drift_after_first: false,
        fail_second: false,
    };
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut op);
    assert_eq!(result.status, TxStatus::Ok);
    assert!(result.changed && result.committed);
    assert_eq!(result.verification, VerificationStatus::Passed);
    assert_eq!(result.written_paths.len(), 2);
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"new record"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"new index"
    );
}
#[test]
fn postcommit_failure_never_rolls_back_or_overwrites_rival() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old record").unwrap();
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut op = Publication {
        fail_verify: true,
        drift_after_first: true,
        fail_second: false,
    };
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut op);
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.changed && result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"rival"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"new index"
    );
}
#[test]
fn candidate_create_is_exclusive_and_existing_winner_is_preserved() {
    let dir = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".lock").unwrap();
    let result = run_transaction(&root, &lock, &mut Creation);
    assert_eq!(result.status, TxStatus::Ok);
    assert!(result.changed && result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("candidate.md")).unwrap(),
        b"candidate"
    );
    std::fs::write(dir.path().join("candidate.md"), b"winner").unwrap();
    let result = run_transaction(&root, &lock, &mut Creation);
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed && !result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("candidate.md")).unwrap(),
        b"winner"
    );
}
#[test]
fn precommit_failure_restores_only_actual_writes() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old record").unwrap();
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut op = Publication {
        fail_verify: false,
        drift_after_first: false,
        fail_second: true,
    };
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut op);
    assert_eq!(result.status, TxStatus::Error);
    assert!(result.changed && !result.committed);
    assert_eq!(result.outcome, RecoveryStatus::RolledBack);
    assert_eq!(result.written_paths.len(), 1);
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"old record"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"old index"
    );
}
#[test]
fn precommit_recovery_preserves_noncooperative_later_edit() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old record").unwrap();
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut op = Publication {
        fail_verify: false,
        drift_after_first: true,
        fail_second: true,
    };
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut op);
    assert_eq!(result.status, TxStatus::Error);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(!result.cleanup_errors.is_empty());
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"rival"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"old index"
    );
}
#[test]
fn cooperative_transactions_do_not_prepare_at_the_same_time() {
    use std::sync::{Arc, Barrier};
    struct Blocking {
        entered: Arc<Barrier>,
        resume: Arc<Barrier>,
    }
    impl TransactionOperation<()> for Blocking {
        fn prepare(&mut self, _: &Root) -> Result<Plan<()>, TxError> {
            self.entered.wait();
            self.resume.wait();
            Ok(Plan {
                value: (),
                writes: vec![],
                guards: vec![],
                resources: vec![],
                commit_point: CommitPoint::NoCommit,
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
    let path = dir.path().to_path_buf();
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let e = entered.clone();
    let r = resume.clone();
    let worker = std::thread::spawn(move || {
        let root = crate::source::open_root(&path).unwrap();
        run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut Blocking {
                entered: e,
                resume: r,
            },
        )
    });
    entered.wait();
    let root = crate::source::open_root(dir.path()).unwrap();
    let second = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Creation);
    assert_eq!(second.errors[0].code, "collection-lock");
    assert!(!dir.path().join("candidate.md").exists());
    resume.wait();
    assert_eq!(worker.join().unwrap().status, TxStatus::Ok);
}
#[test]
fn index_publication_with_creation_commits_after_index_write() {
    struct Mixed;
    impl TransactionOperation<()> for Mixed {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let path = RelativePath::new("new.md").unwrap();
            let index = RelativePath::new("index.json").unwrap();
            Ok(Plan {
                value: (),
                writes: vec![
                    WriteIntent {
                        path,
                        before: ExpectedFile::Missing,
                        after: Some(b"new".to_vec()),
                        mode: Some(WriteMode::Native(0o600)),
                    },
                    WriteIntent {
                        before: capture(root, &index).unwrap(),
                        path: index.clone(),
                        after: Some(b"new index".to_vec()),
                        mode: None,
                    },
                ],
                guards: vec![],
                resources: vec![],
                commit_point: CommitPoint::PublishedIndex(index),
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
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Mixed);
    assert_eq!(result.status, TxStatus::Ok);
    assert!(result.changed && result.committed);
    assert_eq!(std::fs::read(dir.path().join("new.md")).unwrap(), b"new");
    assert_eq!(
        std::fs::read(dir.path().join("index.json")).unwrap(),
        b"new index"
    );
}
#[test]
fn rename_commits_only_after_old_name_exits() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut Rename { fail_delete: false },
    );
    assert_eq!(result.status, TxStatus::Ok);
    assert!(result.committed);
    assert!(!dir.path().join("old.md").exists());
    assert_eq!(
        std::fs::read(dir.path().join("new.md")).unwrap(),
        b"renamed"
    );
}
