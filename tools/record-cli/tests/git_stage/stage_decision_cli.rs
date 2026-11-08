use super::stage_decision_fixture::dr_index_for;
use super::*;

#[test]
fn decision_stage_cli_rejects_invalid_scope_and_duplicate_selectors() {
    let dir = tempfile::tempdir().unwrap();
    let missing = dir.path().join("workspace");
    fs::create_dir(&missing).unwrap();
    let run = |args: &[&str]| {
        std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(["stage"])
            .args(args)
            .arg("--root")
            .arg(&missing)
            .args(["--decisions-dir", "records", "--json"])
            .output()
            .unwrap()
    };
    for args in [
        vec!["240229-record", "--scope", "everything"],
        vec!["240229-record", "240229-record"],
    ] {
        let output = run(&args);
        assert_eq!(
            output.status.code(),
            Some(2),
            "args={args:?} stdout={} stderr={}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(fs::read_dir(&missing).unwrap().next().is_none());
    }
    git(&missing, &["init", "-q"]);
    fs::create_dir(missing.join("records")).unwrap();
    fs::write(
        missing.join("records/decision-index.json"),
        dr_index_for(&[]),
    )
    .unwrap();
    let output = run(&["../record"]);
    assert!(!output.status.success());
    assert!(
        String::from_utf8_lossy(&output.stdout).contains("../record"),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    assert!(git(&missing, &["ls-files", "--stage", "-z"]).is_empty());
}

#[test]
fn decision_cli_stage_from_empty_index_wires_selector_and_scope() {
    let dir = fixture();
    let root = dir.path();
    fs::create_dir(root.join("records")).unwrap();
    fs::write(root.join("records/decision-index.json"), dr_index_for(&[])).unwrap();
    git(root, &["add", "--", "records/decision-index.json"]);
    git(root, &["commit", "-qm", "empty baseline"]);
    let doc = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("records/record.md"), doc).unwrap();
    fs::write(
        root.join("records/decision-index.json"),
        dr_index_for(&[("240229-record", "record.md", doc)]),
    )
    .unwrap();
    let run = |scope: &str| {
        std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(["stage", "record.MD", "--scope", scope, "--root"])
            .arg(root)
            .args(["--decisions-dir", "records", "--json"])
            .output()
            .unwrap()
    };
    let first = run("index");
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stdout)
    );
    let first_json: serde_json::Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(first_json["result"]["scope"], "index");
    assert!(
        git(
            root,
            &["ls-files", "--stage", "-z", "--", "records/record.md"]
        )
        .is_empty()
    );
    let index = git(root, &["show", ":records/decision-index.json"]);
    let parsed: serde_json::Value = serde_json::from_slice(&index).unwrap();
    assert!(parsed["entries"].get("240229-record").is_some());
    let second = run("domain");
    assert!(
        second.status.success(),
        "{}",
        String::from_utf8_lossy(&second.stdout)
    );
    let second_json: serde_json::Value = serde_json::from_slice(&second.stdout).unwrap();
    assert_eq!(second_json["result"]["scope"], "domain");
    assert_eq!(git(root, &["show", ":records/record.md"]), doc.as_bytes());
    assert_eq!(git(root, &["show", ":records/decision-index.json"]), index);
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
