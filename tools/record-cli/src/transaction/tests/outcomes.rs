use super::*;

#[test]
fn planned_value_is_retained_only_after_successful_prepare_and_never_as_success_on_failure() {
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum Stage {
        Success,
        Prepare,
        Fresh,
        Apply,
        Verify,
        Unlock,
    }
    struct Operation(Stage);
    impl TransactionOperation<String> for Operation {
        fn prepare(&mut self, root: &Root) -> Result<Plan<String>, TxError> {
            if self.0 == Stage::Prepare {
                return Err(TxError::new("prepare", "injected"));
            }
            let path = RelativePath::new("candidate.md").unwrap();
            Ok(Plan {
                value: "planned OLD -> NEW".into(),
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
        fn before_write(&mut self, _: &Root, _: usize) -> Result<(), TxError> {
            if self.0 == Stage::Apply {
                return Err(TxError::new("apply", "injected"));
            }
            Ok(())
        }
        fn fresh(&mut self, _: &Root, _: &Plan<String>) -> Result<(), TxError> {
            if self.0 == Stage::Fresh {
                return Err(TxError::new("fresh", "injected"));
            }
            Ok(())
        }
        fn verify(&mut self, root: &Root, _: &Plan<String>) -> Result<(), TxError> {
            if self.0 == Stage::Verify {
                return Err(TxError::new("verify", "injected"));
            }
            if self.0 == Stage::Unlock {
                std::fs::write(root.path().join(".lock"), b"rival").unwrap();
            }
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<String>) -> Result<(), TxError> {
            Ok(())
        }
    }
    for stage in [
        Stage::Success,
        Stage::Prepare,
        Stage::Fresh,
        Stage::Apply,
        Stage::Verify,
        Stage::Unlock,
    ] {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("candidate.md"), b"old").unwrap();
        let root = crate::source::open_root(dir.path()).unwrap();
        let result = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut Operation(stage),
        );
        match stage {
            Stage::Success => {
                assert_eq!(result.status, TxStatus::Ok);
                assert_eq!(result.value.as_deref(), Some("planned OLD -> NEW"));
                assert!(result.planned_value.is_none());
            }
            Stage::Prepare => {
                assert_eq!(result.status, TxStatus::Error);
                assert!(result.value.is_none() && result.planned_value.is_none());
            }
            _ => {
                assert_eq!(result.status, TxStatus::Error);
                assert!(result.value.is_none());
                assert_eq!(
                    result.planned_value.as_deref(),
                    Some("planned OLD -> NEW"),
                    "{stage:?}"
                );
            }
        }
        if matches!(stage, Stage::Verify | Stage::Unlock) {
            assert!(result.committed);
        }
        if matches!(stage, Stage::Prepare | Stage::Fresh | Stage::Apply) {
            assert!(!result.committed && !result.changed);
        }
    }
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("candidate.md"), b"old").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock_path = RelativePath::new(".lock").unwrap();
    let held = crate::source::acquire_collection_lock(&root, &lock_path).unwrap();
    let result = run_transaction(&root, &lock_path, &mut Operation(Stage::Success));
    assert_eq!(result.errors[0].code, "collection-lock");
    assert!(result.value.is_none() && result.planned_value.is_none());
    held.release(&root).unwrap();
}

#[test]
fn structured_prepare_diagnostics_survive_without_changing_no_write_outcome() {
    struct Invalid;
    impl TransactionOperation<()> for Invalid {
        fn prepare(&mut self, _: &Root) -> Result<Plan<()>, TxError> {
            let diagnostics = ["first", "second"]
                .into_iter()
                .map(|target| Diagnostic {
                    code: "selection".into(),
                    message: target.into(),
                    path: None,
                    target: Some(target.into()),
                    cause_category: None,
                    operation: None,
                    detail: None,
                    reason: Some("invalid".into()),
                    recovery: Some("retry".into()),
                })
                .collect();
            Err(TxError::new("selector", "invalid").with_diagnostics(diagnostics))
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
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut Invalid);
    assert_eq!(result.outcome, RecoveryStatus::NoChange);
    assert!(!result.changed && !result.committed);
    let targets: Vec<_> = result.errors.iter().map(|d| d.target.as_deref()).collect();
    assert_eq!(targets, [Some("first"), Some("second")]);
    let plain = diagnostic("old", "message".into());
    let serialized = serde_json::to_value(plain).unwrap();
    assert!(serialized.get("target").is_none());
}
