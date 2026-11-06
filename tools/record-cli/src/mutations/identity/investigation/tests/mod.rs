use super::*;
struct FailAfterResourceMove(InvestigationIdentityOperation);
impl TransactionOperation<PreparedIdentity> for FailAfterResourceMove {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn before_write(&mut self, _: &Root, _: usize) -> Result<(), TxError> {
        Err(fail("injected", "before source write"))
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedIdentity>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
struct CompeteBeforeRollback(InvestigationIdentityOperation);
impl TransactionOperation<PreparedIdentity> for CompeteBeforeRollback {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn before_write(&mut self, root: &Root, _: usize) -> Result<(), TxError> {
        let path = root.path().join("investigations/_resources/261106-old");
        std::fs::create_dir(&path).map_err(|e| fail("fixture", e))?;
        std::fs::write(path.join("winner.txt"), b"concurrent").map_err(|e| fail("fixture", e))?;
        Err(fail("injected", "competing owner before rollback"))
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedIdentity>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
#[test]
fn competing_old_owner_prevents_rollback_and_preserves_both_sides() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old")).unwrap();
    let text = "---\ntitle: \"Example\"\nid: \"261106-old\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"example\"\nrelations: []\n---\n";
    std::fs::write(c.join("_candidate.old"), text).unwrap();
    std::fs::write(c.join("_resources/261106-old/file.txt"), b"original").unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = CompeteBeforeRollback(InvestigationIdentityOperation {
        collection: RelativePath::new("investigations").unwrap(),
        index_path: RelativePath::new("investigations/investigation-index.json").unwrap(),
        selector: "261106-old".into(),
        action: Action::Rename {
            target: "new".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        },
    });
    let out = crate::transaction::run_transaction(
        &root,
        &RelativePath::new("identity.lock").unwrap(),
        &mut op,
    );
    assert!(!out.committed);
    assert_eq!(
        out.outcome,
        crate::transaction::RecoveryStatus::PartialOrUnknown,
        "{out:?}"
    );
    assert_eq!(
        std::fs::read(c.join("_resources/261106-old/winner.txt")).unwrap(),
        b"concurrent"
    );
    assert_eq!(
        std::fs::read(c.join("_resources/261106-new/file.txt")).unwrap(),
        b"original"
    );
    assert_eq!(out.recovery_backups.len(), 1, "{out:?}");
    assert_eq!(
        std::fs::read(dir.path().join(out.recovery_backups[0].backup.as_path())).unwrap(),
        b"original"
    );
    assert_eq!(
        std::fs::read_to_string(c.join("_candidate.old")).unwrap(),
        text
    );
}
#[test]
fn failure_before_source_write_restores_moved_owner() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old")).unwrap();
    let text = "---\ntitle: \"Example\"\nid: \"261106-old\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"example\"\nrelations: []\n---\n\n## 随附资源\n- [file](./_resources/261106-old/file.txt)\n";
    std::fs::write(c.join("_candidate.old"), text).unwrap();
    std::fs::write(c.join("_resources/261106-old/file.txt"), b"original").unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = FailAfterResourceMove(InvestigationIdentityOperation {
        collection: RelativePath::new("investigations").unwrap(),
        index_path: RelativePath::new("investigations/investigation-index.json").unwrap(),
        selector: "261106-old".into(),
        action: Action::Rename {
            target: "new".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        },
    });
    let out = crate::transaction::run_transaction(
        &root,
        &RelativePath::new("identity.lock").unwrap(),
        &mut op,
    );
    assert!(!out.committed);
    let planned = out
        .planned_value
        .as_ref()
        .expect("prepared proposal retained");
    assert!(planned.owner_moved);
    assert_eq!(planned.impact.resource_references, 1);
    assert_eq!(planned.impact.candidate_relations, 0);
    assert!(out.value.is_none());
    assert_eq!(
        out.outcome,
        crate::transaction::RecoveryStatus::RolledBack,
        "{out:?}"
    );
    assert_eq!(
        std::fs::read(c.join("_candidate.old")).unwrap(),
        text.as_bytes()
    );
    assert_eq!(
        std::fs::read(c.join("_resources/261106-old/file.txt")).unwrap(),
        b"original"
    );
    assert!(!c.join("_resources/261106-new").exists());
    assert!(out.recovery_backups.is_empty());
}
