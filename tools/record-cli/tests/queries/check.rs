use super::*;

#[test]
fn decision_check_cli_reports_source_and_index_state_not_index_only() {
    use record_cli::{
        index::{IndexV4, Revision},
        source_revision::{self, Domain},
    };
    use std::{collections::BTreeMap, fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let text = "---\ntitle: Example title\nid: 250102-one\nstatus: active\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n";
    fs::write(dir.join("one.md"), text).unwrap();
    let state = decision::parse_established(text.as_bytes(), "250102-one", "one.md")
        .unwrap()
        .state;
    let projection = IndexV4 {
        schema_version: 4,
        namespace: "decisions".into(),
        definition_version: 11,
        metadata: json!({}),
        source_revision: Revision {
            metadata: source_revision::metadata_fingerprint(Domain::Decision),
            entries: BTreeMap::from([(
                "250102-one".into(),
                source_revision::fingerprint(Domain::Decision, "250102-one", "one.md", text),
            )]),
        },
        entries: BTreeMap::from([("250102-one".into(), state)]),
    };
    let index = record_cli::index::build_index(projection, &decision::Definition).unwrap();
    fs::write(
        dir.join("decision-index.json"),
        record_cli::index::serialize_index(&index, &decision::Definition).unwrap(),
    )
    .unwrap();
    let run = || {
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(["check", "--json", "--root", root.path().to_str().unwrap()])
            .output()
            .unwrap()
    };
    let ok = run();
    assert!(ok.status.success());
    let value: Value = serde_json::from_slice(&ok.stdout).unwrap();
    assert_eq!(value["ok"], true);
    assert_eq!(value["result"]["summary"]["activeCount"], 1);
    assert_eq!(value["result"]["indexState"], "current");
    fs::write(dir.join("one.md"), format!("{text}\nChanged.\n")).unwrap();
    let fail = run();
    assert!(!fail.status.success());
    let value: Value = serde_json::from_slice(&fail.stdout).unwrap();
    assert_eq!(value["ok"], false);
    assert_eq!(value["error"]["code"], "index-not-current");
}

#[test]
fn decision_check_cli_keeps_aggregated_diagnostics_and_partial_scope() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    for id in ["260101-one", "260102-two"] {
        fs::write(
            dir.join(format!("{id}.md")),
            format!("---\nid: {id}\nstatus: active\n---\ninvalid body\n"),
        )
        .unwrap();
    }
    let output = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args(["check", "--json", "--root", root.path().to_str().unwrap()])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["ok"], false);
    assert_eq!(value["diagnostics"].as_array().unwrap().len(), 2);
    assert_eq!(value["result"]["scope"], "partial");
    assert_ne!(value["result"]["indexState"], "current");
}

#[test]
fn investigation_check_cli_keeps_aggregated_diagnostics_and_partial_scope() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    for id in ["260101-one", "260102-two"] {
        fs::write(
            dir.join(format!("{id}.md")),
            format!("---\ntitle: \"Title\"\nid: \"{id}\"\n---\ninvalid body\n"),
        )
        .unwrap();
    }
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["check", "--json", "--root", root.path().to_str().unwrap()])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["ok"], false);
    assert_eq!(value["diagnostics"].as_array().unwrap().len(), 2);
    assert_eq!(value["result"]["scope"], "partial");
    assert_eq!(value["result"]["indexChecked"], false);
}

#[test]
fn investigation_check_cli_reports_unsupported_surrogate_in_source() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let text = "---\ntitle: \"\\ud800\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n";
    fs::write(dir.join("260101-one.md"), text).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["check", "--json", "--root", root.path().to_str().unwrap()])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    let diag = value["diagnostics"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["code"] == "unsupported-unpaired-surrogate")
        .unwrap();
    assert!(diag["path"].as_str().unwrap().ends_with("260101-one.md"));
    assert!(diag["recovery"].is_string());
}
