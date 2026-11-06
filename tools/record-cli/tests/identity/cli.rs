use super::*;

#[test]
fn decision_cli_preflight_rename_and_discard_are_real_transactions() {
    let (dir, _root) = fixture();
    let bin = env!("CARGO_BIN_EXE_decision-records");
    let invoke = |args: &[&str]| {
        std::process::Command::new(bin)
            .arg("--root")
            .arg(dir.path())
            .args(["--decisions-dir", "decisions"])
            .args(args)
            .arg("--json")
            .output()
            .unwrap()
    };
    let before = std::fs::read(dir.path().join("decisions/original.md")).unwrap();
    let pre = invoke(&["rename", "original", "renamed", "--preflight"]);
    assert!(
        pre.status.success(),
        "{}",
        String::from_utf8_lossy(&pre.stderr)
    );
    let preview: serde_json::Value = serde_json::from_slice(&pre.stdout).unwrap();
    assert_eq!(preview["ok"], true);
    assert_eq!(preview["result"]["plannedIndexChange"], true);
    assert_eq!(preview["result"]["oldName"], "original");
    assert_eq!(preview["result"]["newName"], "renamed");
    assert_eq!(preview["result"]["affectedCandidateRelationCount"], 0);
    assert_eq!(preview["result"]["affectedEstablishedRelationCount"], 0);
    assert_eq!(preview["result"]["planOutcome"], "preflight");
    assert_eq!(
        preview["result"]["indexPath"],
        "decisions/decision-index.json"
    );
    assert!(
        preview["result"]["plannedSourcePaths"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "decisions/renamed.md")
    );
    assert_eq!(
        std::fs::read(dir.path().join("decisions/original.md")).unwrap(),
        before
    );
    assert!(!dir.path().join("decisions/renamed.md").exists());
    let actual = invoke(&["rename", "original", "renamed"]);
    assert!(
        actual.status.success(),
        "{} {}",
        String::from_utf8_lossy(&actual.stdout),
        String::from_utf8_lossy(&actual.stderr)
    );
    let json: serde_json::Value = serde_json::from_slice(&actual.stdout).unwrap();
    assert_eq!(json["ok"], true);
    assert_eq!(json["result"]["changed"], true);
    assert_eq!(json["result"]["committed"], true);
    assert_eq!(json["result"]["oldName"], "original");
    assert_eq!(json["result"]["newName"], "renamed");
    assert_eq!(json["result"]["planOutcome"], "ready");
    assert_eq!(json["result"]["indexChanged"], true);
    assert_eq!(json["result"]["indexPath"], "decisions/decision-index.json");
    assert!(
        json["result"]["sourcePaths"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "decisions/renamed.md")
    );
    assert!(!dir.path().join("decisions/original.md").exists());
    assert!(dir.path().join("decisions/renamed.md").exists());
    let discard = invoke(&["discard", "renamed"]);
    assert!(
        discard.status.success(),
        "{} {}",
        String::from_utf8_lossy(&discard.stdout),
        String::from_utf8_lossy(&discard.stderr)
    );
    let json: serde_json::Value = serde_json::from_slice(&discard.stdout).unwrap();
    assert_eq!(json["ok"], true);
    assert_eq!(json["result"]["committed"], true);
    assert!(!dir.path().join("decisions/renamed.md").exists());
}
