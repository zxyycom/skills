use std::{fs, process::Command};

#[test]
fn check_keeps_metadata_summary_when_formal_body_is_invalid() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("decisions");
    fs::create_dir(&dir).unwrap();
    let original = include_str!("fixtures/identity/decisions/original.md");
    let bad_body = original.replace("## 目的", "## 意外");
    let bad_fields = original
        .replace("261106-original", "261107-other")
        .replace("title: Example", "title: Ab");
    fs::write(dir.join("a.md"), bad_body).unwrap();
    fs::write(dir.join("b.md"), bad_fields).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .arg("--root")
        .arg(root.path())
        .args(["--decisions-dir", "decisions", "check", "--json"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["result"]["summary"]["decisionCount"], 1, "{result}");
    assert_eq!(result["result"]["summary"]["activeCount"], 1);
    let diagnostics = result["diagnostics"].as_array().unwrap();
    assert_eq!(diagnostics.len(), 2, "{result}");
    assert_eq!(diagnostics[0]["path"], "a.md");
    assert_eq!(diagnostics[1]["path"], "b.md");
}
