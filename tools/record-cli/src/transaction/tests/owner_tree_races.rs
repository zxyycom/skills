use super::*;

// These faults occur at the copy/publication boundary, not at an atomic tree rename.
enum CopyFault {
    TargetCollision,
    SourceEdit,
    TargetEdit,
    StopAfterCopy,
}
impl TransactionOperation<()> for CopyFault {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        OwnerTreeMove::Success.prepare(root)
    }
    fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if matches!(self, Self::TargetCollision) {
            std::fs::create_dir(root.path().join("_resources/new")).unwrap();
            std::fs::write(root.path().join("_resources/new/winner"), b"winner").unwrap();
        }
        Ok(())
    }
    fn before_write(&mut self, root: &Root, index: usize) -> Result<(), TxError> {
        if index != 0 {
            return Ok(());
        }
        match self {
            Self::SourceEdit => std::fs::write(
                root.path().join("_resources/old/nested/item"),
                b"source edit",
            )
            .unwrap(),
            Self::TargetEdit => std::fs::write(
                root.path().join("_resources/new/nested/item"),
                b"target edit",
            )
            .unwrap(),
            Self::StopAfterCopy => return Err(TxError::new("injected", "stop after copy")),
            Self::TargetCollision => {}
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

#[test]
fn target_collision_never_overwrites_winner_or_original() {
    let (dir, root) = owner_tree_fixture();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut CopyFault::TargetCollision,
    );
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(!outcome.committed);
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
fn source_edit_stops_exit_after_index_commit_and_preserves_both_trees() {
    let (dir, root) = owner_tree_fixture();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut CopyFault::SourceEdit,
    );
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(outcome.committed, "{:?}", outcome.errors);
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"source edit"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
        b"old resource"
    );
}

#[test]
fn target_edit_stops_publication_and_preserves_editor_and_source() {
    let (dir, root) = owner_tree_fixture();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut CopyFault::TargetEdit,
    );
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(!outcome.committed);
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"old resource"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
        b"target edit"
    );
}

#[test]
fn failure_after_copy_keeps_both_copies_for_reconciliation() {
    let (dir, root) = owner_tree_fixture();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut CopyFault::StopAfterCopy,
    );
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(!outcome.committed);
    assert_eq!(outcome.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"old resource"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
        b"old resource"
    );
}

#[test]
fn source_tree_hard_link_alias_is_rejected_before_copy() {
    let (dir, root) = owner_tree_fixture();
    std::fs::hard_link(
        dir.path().join("_resources/old/nested/item"),
        dir.path().join("_resources/old/nested/alias"),
    )
    .unwrap();
    let outcome = run_transaction(
        &root,
        &RelativePath::new(".lock").unwrap(),
        &mut OwnerTreeMove::Success,
    );
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(!outcome.committed && !outcome.changed);
    assert!(outcome.errors.iter().any(|e| e.code == "resource-alias"));
    assert!(!dir.path().join("_resources/new").exists());
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"old resource"
    );
}

#[test]
fn same_path_rename_waits_for_resource_exit_before_commit() {
    struct SamePath;
    impl TransactionOperation<()> for SamePath {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let mut plan = OwnerTreeMove::Success.prepare(root)?;
            plan.writes.truncate(1);
            plan.commit_point = CommitPoint::Updated(plan.writes[0].path.clone());
            Ok(plan)
        }
        fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn before_write(&mut self, root: &Root, _: usize) -> Result<(), TxError> {
            std::fs::write(
                root.path().join("_resources/old/nested/item"),
                b"source edit",
            )
            .unwrap();
            Ok(())
        }
        fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    let (dir, root) = owner_tree_fixture();
    let outcome = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut SamePath);
    assert_eq!(outcome.status, TxStatus::Error);
    assert!(outcome.changed && !outcome.committed);
    assert_eq!(outcome.outcome, RecoveryStatus::PartialOrUnknown);
    assert_eq!(
        std::fs::read(dir.path().join("record.md")).unwrap(),
        b"new record"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/old/nested/item")).unwrap(),
        b"source edit"
    );
    assert_eq!(
        std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
        b"old resource"
    );
}

#[test]
fn final_old_root_exit_commits_even_when_its_readback_fails_but_not_before_other_moves() {
    struct RootReadback {
        two_moves: bool,
    }
    impl TransactionOperation<()> for RootReadback {
        fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
            let mut plan = OwnerTreeMove::Success.prepare(root)?;
            plan.writes.truncate(1);
            plan.commit_point = CommitPoint::Updated(plan.writes[0].path.clone());
            if self.two_moves {
                plan.resources.push(ResourceIntent::MoveDirectory {
                    source: RelativePath::new("_resources/other").unwrap(),
                    destination: RelativePath::new("_resources/other-new").unwrap(),
                });
            }
            Ok(plan)
        }
        fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn before_write(&mut self, _: &Root, _: usize) -> Result<(), TxError> {
            crate::source::fail_directory_readback_for_test(
                RelativePath::new("_resources/old").unwrap(),
            );
            Ok(())
        }
        fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
        fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
            Ok(())
        }
    }
    for two_moves in [false, true] {
        let (dir, root) = owner_tree_fixture();
        if two_moves {
            std::fs::create_dir(dir.path().join("_resources/other")).unwrap();
            std::fs::write(dir.path().join("_resources/other/item"), b"second").unwrap();
        }
        let outcome = run_transaction(
            &root,
            &RelativePath::new(".lock").unwrap(),
            &mut RootReadback { two_moves },
        );
        let old = RelativePath::new("_resources/old").unwrap();
        assert_eq!(outcome.status, TxStatus::Error);
        assert_eq!(outcome.committed, !two_moves);
        assert!(
            outcome.changed
                && outcome.written_paths.contains(&old)
                && outcome.unknown_paths.contains(&old)
        );
        assert!(
            outcome
                .errors
                .iter()
                .any(|e| e.message.contains("injected directory readback failure"))
        );
        assert!(!dir.path().join("_resources/old").exists());
        assert_eq!(
            std::fs::read(dir.path().join("_resources/new/nested/item")).unwrap(),
            b"old resource"
        );
        if two_moves {
            assert_eq!(
                std::fs::read(dir.path().join("_resources/other/item")).unwrap(),
                b"second"
            );
        }
    }
}
