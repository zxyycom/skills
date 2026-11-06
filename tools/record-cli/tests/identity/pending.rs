use super::*;

#[test]
fn decision_rename_rejects_collection_pending_and_rechecks_before_write() {
    use record_cli::transaction::TransactionOperation;
    let (dir, root) = fixture();
    git(dir.path(), &["init", "-q"]);
    std::fs::create_dir(dir.path().join("decisions/archive")).unwrap();
    std::fs::write(dir.path().join("decisions/archive/note.bin"), b"nested").unwrap();
    std::fs::write(dir.path().join("decisions/archive-a.txt"), b"sibling").unwrap();
    git(dir.path(), &["add", "decisions"]);
    git(
        dir.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "baseline",
        ],
    );
    std::fs::write(dir.path().join("outside.txt"), "outside pending").unwrap();
    git(dir.path(), &["add", "outside.txt"]);
    let mut operation = operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: true,
    });
    let plan = operation
        .prepare(&root)
        .expect("outside pending does not block");
    std::fs::write(dir.path().join("decisions/note.txt"), "collection pending").unwrap();
    git(dir.path(), &["add", "decisions/note.txt"]);
    let fresh = operation.fresh(&root, &plan).unwrap_err();
    assert_eq!(fresh.code, "decision-records.rename-pending-stage-conflict");
    let before_index = std::fs::read(dir.path().join(".git/index")).unwrap();
    let out = transaction::run_transaction(
        &root,
        &RelativePath::new(".identity.lock").unwrap(),
        &mut operation,
    );
    assert!(!out.committed && !out.changed);
    assert!(
        out.errors
            .iter()
            .any(|error| error.code == "decision-records.rename-pending-stage-conflict")
    );
    let cli = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .arg("--root")
        .arg(dir.path())
        .args([
            "--decisions-dir",
            "decisions",
            "rename",
            "original",
            "new",
            "--rename-recorded-decision",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(!cli.status.success());
    let response: serde_json::Value = serde_json::from_slice(&cli.stdout).unwrap();
    assert_eq!(response["ok"], false);
    assert_eq!(
        response["diagnostics"][0]["code"],
        "decision-records.rename-pending-stage-conflict"
    );
    assert_eq!(
        response["diagnostics"][0]["target"],
        "decisions/decision-index.json"
    );
    assert!(response["diagnostics"][0]["recovery"].as_str().is_some());
    assert!(dir.path().join("decisions/original.md").exists());
    assert_eq!(
        std::fs::read(dir.path().join(".git/index")).unwrap(),
        before_index
    );
    let mut no_op = super::operation(Action::Rename {
        target: "original".into(),
        confirm_recorded: false,
    });
    let out = transaction::run_transaction(
        &root,
        &RelativePath::new(".identity.lock").unwrap(),
        &mut no_op,
    );
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(!out.changed);
    let (unborn_dir, unborn_root) = fixture();
    git(unborn_dir.path(), &["init", "-q"]);
    git(unborn_dir.path(), &["add", "decisions"]);
    let mut unborn = super::operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: true,
    });
    let error = transaction::preflight(&unborn_root, &mut unborn).unwrap_err();
    assert_eq!(error.code, "decision-records.rename-pending-stage-conflict");
    let (corrupt_dir, corrupt_root) = fixture();
    std::fs::create_dir(corrupt_dir.path().join(".git")).unwrap();
    let mut corrupt = super::operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: true,
    });
    assert!(transaction::preflight(&corrupt_root, &mut corrupt).is_err());
    assert!(corrupt_dir.path().join("decisions/original.md").exists());
    assert!(!corrupt_dir.path().join("decisions/new.md").exists());
}

#[test]
fn decision_pending_drift_before_write_retains_only_planned_identity() {
    use record_cli::mutations::identity::decision::{DecisionIdentityOperation, PreparedIdentity};
    use record_cli::transaction::{Plan, TransactionOperation, TxError};
    struct StageBeforeFresh(DecisionIdentityOperation);
    impl TransactionOperation<PreparedIdentity> for StageBeforeFresh {
        fn prepare(&mut self, root: &source::Root) -> Result<Plan<PreparedIdentity>, TxError> {
            self.0.prepare(root)
        }
        fn fresh(
            &mut self,
            root: &source::Root,
            plan: &Plan<PreparedIdentity>,
        ) -> Result<(), TxError> {
            std::fs::write(root.path().join("decisions/note.txt"), "concurrent staged").unwrap();
            git(root.path(), &["add", "decisions/note.txt"]);
            self.0.fresh(root, plan)
        }
        fn verify(
            &mut self,
            root: &source::Root,
            plan: &Plan<PreparedIdentity>,
        ) -> Result<(), TxError> {
            self.0.verify(root, plan)
        }
        fn verify_recovered(
            &mut self,
            root: &source::Root,
            plan: &Plan<PreparedIdentity>,
        ) -> Result<(), TxError> {
            self.0.verify_recovered(root, plan)
        }
    }
    let (dir, root) = fixture();
    git(dir.path(), &["init", "-q"]);
    git(dir.path(), &["add", "decisions"]);
    git(
        dir.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "baseline",
        ],
    );
    let mut operation = StageBeforeFresh(super::operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: true,
    }));
    let out = transaction::run_transaction(
        &root,
        &RelativePath::new(".identity.lock").unwrap(),
        &mut operation,
    );
    assert!(!out.committed && !out.changed);
    assert!(out.written_paths.is_empty() && out.unknown_paths.is_empty());
    assert!(out.value.is_none());
    assert_eq!(
        out.planned_value.as_ref().unwrap().new_id.as_deref(),
        Some("261106-new")
    );
    assert!(
        out.errors
            .iter()
            .any(|e| e.code == "decision-records.rename-pending-stage-conflict")
    );
    assert!(dir.path().join("decisions/original.md").exists());
    assert!(!dir.path().join("decisions/new.md").exists());
}
