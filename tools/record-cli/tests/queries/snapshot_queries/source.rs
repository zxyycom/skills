use super::*;

#[test]
fn decision_cli_requires_name_and_alignment_in_index() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let valid = json!({"name":"example","sourcePath":"240229-example.md","title":"Example","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["example"],"relations":[]});
    let run = |entry: Value| {
        fs::write(
            dir.join("decision-index.json"),
            fixture("decisions", json!({"240229-example":entry})),
        )
        .unwrap();
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args([
                "list",
                "--json",
                "--status",
                "all",
                "--root",
                root.path().to_str().unwrap(),
            ])
            .output()
            .unwrap()
    };
    assert!(run(valid.clone()).status.success());
    let mut archived = valid.clone();
    archived["status"] = json!("archived");
    archived["alignment"] = json!("unaligned");
    archived["sourcePath"] = json!("archive/240229-example.md");
    assert!(run(archived).status.success());
    let mut missing_alignment = valid.clone();
    missing_alignment
        .as_object_mut()
        .unwrap()
        .remove("alignment");
    let mut null_alignment = valid.clone();
    null_alignment["alignment"] = Value::Null;
    let mut missing_name = valid.clone();
    missing_name.as_object_mut().unwrap().remove("name");
    let mut empty_name = valid;
    empty_name["name"] = json!("");
    for invalid in [missing_alignment, null_alignment, missing_name, empty_name] {
        let out = run(invalid);
        assert_eq!(out.status.code(), Some(1));
        let response: Value = serde_json::from_slice(&out.stdout).unwrap();
        assert_eq!(response["error"]["code"], "invalid-index");
    }
}

#[test]
fn investigation_cli_json_list_and_missing_index_are_separate_outcomes() {
    use std::{fs, process::Command};
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join("docs/investigations");
    fs::create_dir_all(&directory).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"First question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"First report"}}),
    );
    fs::write(directory.join("investigation-index.json"), bytes).unwrap();
    let invoke = |dir: &str| {
        Command::new(env!("CARGO_BIN_EXE_investigation-report"))
            .args([
                "list",
                "--json",
                "--root",
                temp.path().to_str().unwrap(),
                "--investigations-dir",
                dir,
            ])
            .output()
            .unwrap()
    };
    let ok = invoke("docs/investigations");
    assert!(ok.status.success());
    let body: Value = serde_json::from_slice(&ok.stdout).unwrap();
    assert_eq!(body["version"], 2);
    assert_eq!(body["ok"], true);
    assert_eq!(body["result"]["entries"][0]["id"], "260101-one");
    let failure = invoke("missing");
    assert!(!failure.status.success());
    let body: Value = serde_json::from_slice(&failure.stdout).unwrap();
    assert_eq!(body["ok"], false);
    assert_eq!(body["error"]["code"], "index-not-found");
}

#[test]
fn show_reads_selected_utf8_checks_identity_and_reports_stale_revision() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let directory = root.path().join("docs/investigations");
    fs::create_dir_all(&directory).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"First question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"First report"}}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let path = directory.join("260101-one.md");
    let text = "\u{feff}---\ntitle: \"First report\"\nid: \"260101-one\"\n---\nCurrent body\n";
    fs::write(&path, text).unwrap();
    let root = record_cli::source::open_root(root.path()).unwrap();
    let result = iq::show(&root, "docs/investigations", &snapshot, "one").unwrap();
    assert_eq!(result.markdown, text);
    assert_eq!(result.warnings.len(), 1);
    // ID and indexed sourcePath are independent: the semantic filename wins.
    fs::write(directory.join("semantic.md"), text).unwrap();
    let mut semantic: Value = serde_json::from_slice(&bytes).unwrap();
    semantic["entries"]["260101-one"]["sourcePath"] = json!("semantic.md");
    let semantic_snapshot = QuerySnapshot::new(
        parse_index(
            &serde_json::to_vec(&semantic).unwrap(),
            &investigation::Definition,
        )
        .unwrap(),
    );
    fs::remove_file(&path).unwrap();
    assert_eq!(
        iq::show(&root, "docs/investigations", &semantic_snapshot, "one")
            .unwrap()
            .markdown,
        text
    );
    fs::write(&path, text).unwrap();
    let mut current: Value = serde_json::from_slice(&bytes).unwrap();
    current["sourceRevision"]["entries"]["260101-one"] =
        json!("sha256:df83172e686dfbbc6f90fdf6a1bc70f210f7405c9dad10e8ba8023417c974949");
    let current_snapshot = QuerySnapshot::new(
        parse_index(
            &serde_json::to_vec(&current).unwrap(),
            &investigation::Definition,
        )
        .unwrap(),
    );
    assert!(
        iq::show(&root, "docs/investigations", &current_snapshot, "one")
            .unwrap()
            .warnings
            .is_empty()
    );
    // The persisted fingerprint above includes the BOM; removing only that
    // character must make the current source stale, not silently normalize it.
    fs::write(&path, text.strip_prefix('\u{feff}').unwrap()).unwrap();
    assert_eq!(
        iq::show(&root, "docs/investigations", &current_snapshot, "one")
            .unwrap()
            .warnings
            .len(),
        1
    );
    fs::write(&path, "---\ntitle: \"Wrong\"\nid: \"260101-other\"\n---\n").unwrap();
    assert!(iq::show(&root, "docs/investigations", &snapshot, "one").is_err());
    fs::write(&path, [0xff]).unwrap();
    assert!(iq::show(&root, "docs/investigations", &snapshot, "one").is_err());
}

#[test]
fn decision_show_rejects_mismatched_identity_and_keeps_current_body() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let directory = root.path().join("docs/decisions");
    fs::create_dir_all(&directory).unwrap();
    let bytes = fixture(
        "decisions",
        json!({"260101-one":{"name":"one","sourcePath":"260101-one.md","title":"A clear title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":[]}}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let root_handle = record_cli::source::open_root(root.path()).unwrap();
    let path = directory.join("260101-one.md");
    let body = "---\nid: 260101-one\n---\nNot a valid full decision, but readable.\n";
    fs::write(&path, body).unwrap();
    let result = dq::show(&root_handle, "docs/decisions", &snapshot, "one").unwrap();
    assert_eq!(result.body, body);
    assert_eq!(result.warnings.len(), 1);
    fs::write(&path, "---\nid: 260101-other\n---\nBody\n").unwrap();
    assert!(dq::show(&root_handle, "docs/decisions", &snapshot, "one").is_err());
}

#[test]
fn decision_cli_rejects_obsolete_index_definition() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = json!({"name":"example","sourcePath":"240229-example.md","title":"Example","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["example"],"relations":[]});
    let raw = fixture("decisions", json!({"240229-example":state}));
    let mut index: Value = serde_json::from_slice(&raw).unwrap();
    index["definitionVersion"] = json!(10);
    fs::write(
        dir.join("decision-index.json"),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    let result = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args(["list", "--json", "--root", root.path().to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(result.status.code(), Some(1));
    let response: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(response["error"]["code"], "invalid-index");
}
