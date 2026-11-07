use super::*;

#[test]
fn decision_rename_rejects_collection_pending() {
    let (dir, root) = fixture();
    initialize_git(dir.path());
    std::fs::create_dir(dir.path().join("decisions/archive")).unwrap();
    let raw = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/identity/pending/decisions");
    std::fs::copy(
        raw.join("archive/note.txt"),
        dir.path().join("decisions/archive/note.bin"),
    )
    .unwrap();
    std::fs::copy(
        raw.join("archive-a.txt"),
        dir.path().join("decisions/archive-a.txt"),
    )
    .unwrap();
    commit_baseline(dir.path());
    std::fs::write(dir.path().join("outside.txt"), "outside pending").unwrap();
    git(dir.path(), &["add", "outside.txt"]);
    let mut operation = operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: true,
    });
    transaction::preflight(&root, &mut operation).expect("outside pending does not block");
    std::fs::write(dir.path().join("decisions/note.txt"), "collection pending").unwrap();
    git(dir.path(), &["add", "decisions/note.txt"]);
    let before_index = std::fs::read(dir.path().join(".git/index")).unwrap();
    let out = transaction::run_transaction(&root, &mut operation);
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
    let out = transaction::run_transaction(&root, &mut no_op);
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
