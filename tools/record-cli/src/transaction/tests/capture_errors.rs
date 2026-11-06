use super::*;

enum Fault {
    PostRead,
    PostDrift,
    PostWritten,
    PostMissing,
    Recovery,
}
struct Operation(Fault);
impl TransactionOperation<()> for Operation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let writes = ["record", "index"]
            .into_iter()
            .map(|name| {
                let path = RelativePath::new(name).unwrap();
                WriteIntent {
                    before: capture(root, &path).unwrap(),
                    path,
                    after: Some(format!("new {name}").into_bytes()),
                    mode: None,
                }
            })
            .collect();
        let guards = ["guard-a", "guard-b", "missing/child"]
            .into_iter()
            .map(|name| {
                let path = RelativePath::new(name).unwrap();
                Guard {
                    before: capture(root, &path).unwrap(),
                    path,
                }
            })
            .collect();
        Ok(Plan {
            value: (),
            writes,
            guards,
            resources: vec![],
            commit_point: CommitPoint::PublishedIndex(RelativePath::new("index").unwrap()),
        })
    }
    fn before_write(&mut self, root: &Root, index: usize) -> Result<(), TxError> {
        if matches!(self.0, Fault::Recovery) && index == 1 {
            replace_guard_with_directory(root);
            std::fs::write(root.path().join("guard-b"), b"changed").unwrap();
            return Err(TxError::new("injected", "before index"));
        }
        Ok(())
    }
    fn before_postverify(&mut self, root: &Root) -> Result<(), TxError> {
        match self.0 {
            Fault::PostRead => replace_guard_with_directory(root),
            Fault::PostDrift => std::fs::write(root.path().join("guard-a"), b"changed").unwrap(),
            Fault::PostWritten => replace_with_directory(root, "record"),
            Fault::PostMissing => {
                let parent = root.path().join("missing");
                std::fs::remove_dir(&parent).unwrap();
                std::fs::write(parent, b"rival").unwrap();
            }
            Fault::Recovery => unreachable!(),
        }
        Ok(())
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
fn replace_guard_with_directory(root: &Root) {
    replace_with_directory(root, "guard-a");
}
fn replace_with_directory(root: &Root, name: &str) {
    let guard = root.path().join(name);
    std::fs::remove_file(&guard).unwrap();
    std::fs::create_dir(&guard).unwrap();
}
fn fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    for name in ["record", "index", "guard-a", "guard-b"] {
        std::fs::write(dir.path().join(name), format!("old {name}")).unwrap();
    }
    std::fs::create_dir(dir.path().join("missing")).unwrap();
    dir
}

#[test]
fn postverify_distinguishes_read_failure_from_drift_after_commit() {
    for fault in [Fault::PostRead, Fault::PostDrift] {
        let read_failure = matches!(fault, Fault::PostRead);
        let dir = fixture();
        let root = crate::source::open_root(dir.path()).unwrap();
        let result = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut Operation(fault),
        );
        assert!(result.committed && result.changed);
        assert_eq!(result.verification, VerificationStatus::FailedOrUnknown);
        assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
        assert_eq!(result.errors[0].code, "postverify-source");
        let message = &result.errors[0].message;
        assert!(message.contains("guard-a"), "{message}");
        if read_failure {
            assert!(message.contains("Unsafe"), "{message}");
        } else {
            assert!(message.contains("changed"), "{message}");
            assert!(!message.contains("Unsafe"));
        }
        assert_eq!(
            std::fs::read(dir.path().join("record")).unwrap(),
            b"new record"
        );
        assert_eq!(
            std::fs::read(dir.path().join("index")).unwrap(),
            b"new index"
        );
    }
}

#[test]
fn postverify_reports_failure_reading_an_actual_written_file() {
    let dir = fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut Operation(Fault::PostWritten),
    );
    assert!(result.committed);
    assert_eq!(result.verification, VerificationStatus::FailedOrUnknown);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(result.errors[0].code, "postverify-source");
    assert!(result.errors[0].message.contains("record"));
    assert!(result.errors[0].message.contains("Unsafe"));
    assert!(dir.path().join("record").is_dir());
    assert_eq!(
        std::fs::read(dir.path().join("index")).unwrap(),
        b"new index"
    );
}

#[test]
fn postverify_reports_failure_recapturing_a_missing_guard() {
    let dir = fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut Operation(Fault::PostMissing),
    );
    assert!(result.committed);
    assert_eq!(result.verification, VerificationStatus::FailedOrUnknown);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(result.errors[0].code, "postverify-source");
    let message = &result.errors[0].message;
    assert!(
        message.contains("missing/child") && message.contains("NotADirectory"),
        "{message}"
    );
    assert_eq!(std::fs::read(dir.path().join("missing")).unwrap(), b"rival");
    assert_eq!(
        std::fs::read(dir.path().join("index")).unwrap(),
        b"new index"
    );
}

#[test]
fn recovery_reports_read_failure_and_continues_checking_drift() {
    let dir = fixture();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut Operation(Fault::Recovery),
    );
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    let messages: Vec<_> = result
        .cleanup_errors
        .iter()
        .map(|item| item.message.as_str())
        .collect();
    assert!(
        messages
            .iter()
            .any(|m| m.contains("guard-a") && m.contains("Unsafe")),
        "{messages:?}"
    );
    assert!(
        messages
            .iter()
            .any(|m| m.contains("guard-b") && m.contains("changed")),
        "{messages:?}"
    );
    assert_eq!(
        std::fs::read(dir.path().join("record")).unwrap(),
        b"old record"
    );
    assert_eq!(
        std::fs::read(dir.path().join("index")).unwrap(),
        b"old index"
    );
}

#[test]
fn postverify_reports_removed_path_parent_read_failure() {
    struct Remove;
    impl TransactionOperation<()> for Remove {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let old = RelativePath::new("records/old").unwrap();
            let index = RelativePath::new("index").unwrap();
            Ok(Plan {
                value: (),
                writes: vec![
                    WriteIntent {
                        before: capture(root, &old).unwrap(),
                        path: old,
                        after: None,
                        mode: None,
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
        fn before_postverify(&mut self, root: &Root) -> Result<(), TxError> {
            let parent = root.path().join("records");
            std::fs::remove_dir(&parent).unwrap();
            std::fs::write(parent, b"rival").unwrap();
            Ok(())
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
    let dir = fixture();
    std::fs::create_dir(dir.path().join("records")).unwrap();
    std::fs::write(dir.path().join("records/old"), b"old").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Remove);
    assert!(result.committed);
    assert_eq!(result.verification, VerificationStatus::FailedOrUnknown);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(result.errors[0].code, "postverify-source");
    let message = &result.errors[0].message;
    assert!(message.contains("records/old"), "{message}");
    assert!(message.contains("NotADirectory"), "{message}");
    assert_eq!(std::fs::read(dir.path().join("records")).unwrap(), b"rival");
    assert_eq!(
        std::fs::read(dir.path().join("index")).unwrap(),
        b"new index"
    );
}
