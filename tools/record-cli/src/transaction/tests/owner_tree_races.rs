use super::*;

// Configure the real syscall barrier without changing the individual observations.
enum MoveRace {
    PostMoveEdit,
    TargetCollision,
    SourceChanged,
    SourceAndTargetChanged,
}
impl TransactionOperation<()> for MoveRace {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        OwnerTreeMove::Success.prepare(root)
    }
    fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        let parent = root.path().join("_resources");
        match self {
            Self::PostMoveEdit => crate::source::set_move_after_test_hook(move || {
                std::fs::write(parent.join("new/nested/item"), b"rival edit").unwrap();
            }),
            Self::TargetCollision => crate::source::set_move_before_test_hook(move || {
                std::fs::create_dir(parent.join("new")).unwrap();
                std::fs::write(parent.join("new/winner"), b"winner").unwrap();
            }),
            Self::SourceChanged => crate::source::set_move_before_test_hook(move || {
                replace_or_edit_source(&parent, b"winner", b"rival edit");
            }),
            Self::SourceAndTargetChanged => crate::source::set_move_before_test_hook(move || {
                replace_or_edit_source(&parent, b"source winner", b"source edit");
                std::fs::create_dir(parent.join("new")).unwrap();
                std::fs::write(parent.join("new/winner"), b"target winner").unwrap();
            }),
        }
        Ok(())
    }
    fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if matches!(self, Self::PostMoveEdit | Self::SourceChanged) {
            panic!("unknown move must not claim recovery");
        }
        Ok(())
    }
}
fn replace_or_edit_source(parent: &std::path::Path, winner: &[u8], edit: &[u8]) {
    #[cfg(unix)]
    {
        let _ = edit;
        std::fs::rename(parent.join("old"), parent.join("displaced")).unwrap();
        std::fs::create_dir(parent.join("old")).unwrap();
        std::fs::write(parent.join("old/winner"), winner).unwrap();
    }
    #[cfg(windows)]
    {
        let _ = winner;
        std::fs::write(parent.join("old/nested/item"), edit).unwrap();
    }
}

#[test]
fn owner_tree_move_syscall_unknown_never_uses_receipt_or_loses_verified_backup() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut MoveRace::PostMoveEdit,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(
        result
            .unknown_paths
            .contains(&RelativePath::new("_resources/old").unwrap())
    );
    assert!(
        result
            .unknown_paths
            .contains(&RelativePath::new("_resources/new").unwrap())
    );
    assert!(
        !dir.path().join("_resources/old").exists(),
        "an unknown move must not be inverted"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
        b"rival edit"
    );
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"old record"
    );
    assert_eq!(result.recovery_backups.len(), 1);
    assert_eq!(
        std::fs::read(dir.path().join(result.recovery_backups[0].backup.as_path())).unwrap(),
        b"old resource"
    );
    assert!(
        result
            .recovery_directories
            .iter()
            .any(|d| d.path == RelativePath::new("_resources/old/nested").unwrap())
    );
}
#[test]
fn owner_tree_move_syscall_target_collision_keeps_winner_and_original() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut MoveRace::TargetCollision,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/winner")).unwrap(),
        b"winner"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"old resource"
    );
    assert!(result.recovery_backups.is_empty());
}
#[test]
fn owner_tree_move_source_changes_at_syscall_are_unknown_and_never_inverted() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut MoveRace::SourceChanged,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert!(
        result
            .unknown_paths
            .contains(&RelativePath::new("_resources/old").unwrap())
    );
    assert!(
        result
            .unknown_paths
            .contains(&RelativePath::new("_resources/new").unwrap())
    );
    assert!(
        !dir.path().join("_resources/old").exists(),
        "unknown move must not be automatically inverted"
    );
    #[cfg(unix)]
    {
        assert_eq!(
            std::fs::read(dir.path().join("_resources/new/winner")).unwrap(),
            b"winner"
        );
        assert_eq!(
            std::fs::read(dir.path().join("_resources/displaced/nested/item")).unwrap(),
            b"old resource"
        );
    }
    #[cfg(windows)]
    {
        assert_eq!(
            std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
            b"rival edit"
        );
    }
    assert_eq!(result.recovery_backups.len(), 1);
    assert_eq!(
        std::fs::read(dir.path().join(result.recovery_backups[0].backup.as_path())).unwrap(),
        b"old resource"
    );
}
#[test]
fn owner_tree_move_notstarted_collision_keeps_backup_if_original_changed() {
    let (dir, root) = owner_tree_fixture();
    let result = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut MoveRace::SourceAndTargetChanged,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.committed);
    assert_eq!(result.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/winner")).unwrap(),
        b"target winner"
    );
    #[cfg(unix)]
    {
        assert_eq!(
            std::fs::read(dir.path().join("_resources/old/winner")).unwrap(),
            b"source winner"
        );
    }
    #[cfg(windows)]
    {
        assert_eq!(
            std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
            b"source edit"
        );
    }
    assert_eq!(result.recovery_backups.len(), 1);
    assert_eq!(
        std::fs::read(dir.path().join(result.recovery_backups[0].backup.as_path())).unwrap(),
        b"old resource"
    );
}
