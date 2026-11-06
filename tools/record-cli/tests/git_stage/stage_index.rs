use super::*;

#[test]
fn index_scope_refreshes_selected_id_over_pending_baseline() {
    use record_cli::{
        domains::decision,
        source::{RelativePath, open_root},
        stage::index_scope::stage_index,
    };
    use serde_json::{Value, json};
    fn index(a: &str, b: &str) -> Vec<u8> {
        let hash = format!("sha256:{}", "a".repeat(64));
        let state = |name: &str, title: &str| json!({"name":name,"sourcePath":format!("{name}.md"),"title":title,"status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["test"],"relations":[]});
        serde_json::to_vec_pretty(&json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-alpha":hash,"240229-beta":hash}},"entries":{"240229-alpha":state("alpha",a),"240229-beta":state("beta",b)}})).unwrap()
    }
    let dir = fixture();
    let root = dir.path();
    fs::write(root.join("decision-index.json"), index("head-a", "head-b")).unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    git(root, &["commit", "-qm", "index baseline"]);
    fs::write(
        root.join("decision-index.json"),
        index("head-a", "pending-b"),
    )
    .unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    let workspace = index("work-a", "work-b");
    fs::write(root.join("decision-index.json"), &workspace).unwrap();
    let other = git(root, &["show", ":unselected"]);
    let result = stage_index(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &decision::Definition,
        &["240229-alpha".into()],
        |state| &state.name,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-alpha"]);
    assert_eq!(result.updated_paths, [PathBuf::from("decision-index.json")]);
    assert_eq!(result.caller_owned_paths, [PathBuf::from("alpha.md")]);
    assert!(
        result
            .preserved_pending_paths
            .contains(&PathBuf::from("unselected"))
    );
    assert_eq!(result.changed_paths, [PathBuf::from("decision-index.json")]);
    let actual: Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert_eq!(actual["entries"]["240229-alpha"]["title"], "work-a");
    assert_eq!(actual["entries"]["240229-beta"]["title"], "pending-b");
    assert_eq!(
        fs::read(root.join("decision-index.json")).unwrap(),
        workspace
    );
    assert_eq!(git(root, &["show", ":unselected"]), other);
}
#[test]
fn investigation_index_scope_preserves_unselected_pending_projection() {
    use record_cli::{
        domains::investigation,
        source::{RelativePath, open_root},
        stage::index_scope::stage_index,
    };
    use serde_json::{Value, json};
    fn index(a: &str, b: &str) -> Vec<u8> {
        let hash = format!("sha256:{}", "a".repeat(64));
        let state = |name: &str, title: &str| json!({"name":name,"sourcePath":format!("{name}.md"),"title":title,"formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["test"],"relations":[],"resourceIds":[]});
        serde_json::to_vec(&json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-alpha":hash,"240229-beta":hash}},"entries":{"240229-alpha":state("alpha",a),"240229-beta":state("beta",b)}})).unwrap()
    }
    let dir = fixture();
    let root = dir.path();
    fs::write(
        root.join("investigation-index.json"),
        index("head-a", "head-b"),
    )
    .unwrap();
    git(root, &["add", "--", "investigation-index.json"]);
    git(root, &["commit", "-qm", "index baseline"]);
    git(root, &["rm", "--cached", "-q", "--", "unselected"]);
    fs::write(
        root.join("investigation-index.json"),
        index("head-a", "pending-b"),
    )
    .unwrap();
    git(root, &["add", "--", "investigation-index.json"]);
    let workspace = index("work-a", "work-b");
    fs::write(root.join("investigation-index.json"), &workspace).unwrap();
    let result = stage_index(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &investigation::Definition,
        &["alpha".into()],
        |state| &state.name,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-alpha"]);
    assert!(
        result
            .preserved_pending_paths
            .contains(&PathBuf::from("unselected"))
    );
    assert!(result.caller_owned_paths.is_empty());
    let actual: Value =
        serde_json::from_slice(&git(root, &["show", ":investigation-index.json"])).unwrap();
    assert_eq!(actual["entries"]["240229-alpha"]["title"], "work-a");
    assert_eq!(actual["entries"]["240229-beta"]["title"], "pending-b");
    assert_eq!(
        fs::read(root.join("investigation-index.json")).unwrap(),
        workspace
    );
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "unselected"]).is_empty());
    let absent = stage_index(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &investigation::Definition,
        &["240229-absent.Md".into()],
        |state| &state.name,
    )
    .unwrap();
    assert_eq!(absent.selected_ids, ["240229-absent"]);
    assert!(absent.changed_paths.is_empty());
    assert_eq!(
        absent.updated_paths,
        [PathBuf::from("investigation-index.json")]
    );
    assert!(
        !absent
            .preserved_pending_paths
            .contains(&PathBuf::from("investigation-index.json"))
    );
}
#[test]
fn index_scope_refuses_deleted_pending_index_without_restaging_it() {
    use record_cli::{
        domains::decision,
        source::{RelativePath, open_root},
        stage::index_scope::stage_index,
    };
    let dir = fixture();
    let root = dir.path();
    let hash = format!("sha256:{}", "a".repeat(64));
    let index = serde_json::json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-record":hash}},"entries":{"240229-record":{"name":"record","sourcePath":"record.md","title":"Title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["test"],"relations":[]}}});
    let bytes = serde_json::to_vec(&index).unwrap();
    fs::write(root.join("decision-index.json"), &bytes).unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    git(root, &["commit", "-qm", "index baseline"]);
    git(root, &["rm", "--cached", "-q", "--", "decision-index.json"]);
    let before = git(root, &["ls-files", "--stage", "-z"]);
    assert!(
        stage_index(
            &open_root(root).unwrap(),
            &RelativePath::new("decision-index.json").unwrap(),
            &decision::Definition,
            &["240229-record".into()],
            |state| &state.name
        )
        .is_err()
    );
    assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));
    assert_eq!(fs::read(root.join("decision-index.json")).unwrap(), bytes);
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn index_scope_stages_in_unborn_repository_without_existing_index() {
    use record_cli::{
        domains::decision,
        source::{RelativePath, open_root},
        stage::index_scope::stage_index,
    };
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git(root, &["init", "-q"]);
    let hash = format!("sha256:{}", "a".repeat(64));
    let index = serde_json::json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-record":hash}},"entries":{"240229-record":{"name":"record","sourcePath":"record.md","title":"Title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["test"],"relations":[]}}});
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    assert!(!root.join(".git/index").exists());
    let result = stage_index(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &decision::Definition,
        &["240229-record".into()],
        |state| &state.name,
    )
    .unwrap();
    assert_eq!(result.changed_paths, [PathBuf::from("decision-index.json")]);
    let staged: serde_json::Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert_eq!(staged["entries"]["240229-record"]["title"], "Title");
    assert!(!root.join(".git/index.lock").exists());
}

#[test]
fn cli_unresolved_selector_reports_target_recovery_and_unchanged_pending() {
    let dir = fixture();
    let root = dir.path();
    fs::create_dir(root.join("records")).unwrap();
    let hash = format!("sha256:{}", "a".repeat(64));
    for (namespace, index) in [
        ("decisions", "decision-index.json"),
        ("investigations", "investigation-index.json"),
    ] {
        let value = serde_json::json!({"schemaVersion":4,"namespace":namespace,"definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{}},"entries":{}});
        fs::write(
            root.join("records").join(index),
            serde_json::to_vec(&value).unwrap(),
        )
        .unwrap();
    }
    git(root, &["add", "--", "records"]);
    git(root, &["commit", "-qm", "empty record indexes"]);
    let before = git(root, &["ls-files", "--stage", "-z"]);
    for (bin, directory, is_decision) in [
        (
            env!("CARGO_BIN_EXE_decision-records"),
            "--decisions-dir",
            true,
        ),
        (
            env!("CARGO_BIN_EXE_investigation-report"),
            "--investigations-dir",
            false,
        ),
    ] {
        let output = Command::new(bin)
            .args(["stage", "missing", "--root"])
            .arg(root)
            .args([directory, "records", "--json"])
            .output()
            .unwrap();
        assert_eq!(
            output.status.code(),
            Some(1),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        let diagnostic = &value["diagnostics"][0];
        assert_eq!(diagnostic["target"], "missing");
        assert!(diagnostic["reason"].as_str().unwrap().contains("missing"));
        assert!(!diagnostic["recovery"].as_str().unwrap().is_empty());
        assert_eq!(value["result"]["scope"], "all");
        assert_eq!(value["result"]["pending"]["outcome"], "no-change");
        assert_eq!(value["result"]["changed"], false);
        if is_decision {
            assert_eq!(
                value["result"]["selectionScope"],
                "Pending decision snapshot"
            );
            assert!(diagnostic.get("path").is_none());
        } else {
            assert_eq!(
                diagnostic["path"],
                root.join("records/investigation-index.json")
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .as_ref()
            );
            assert!(
                diagnostic["recovery"]
                    .as_str()
                    .unwrap()
                    .contains("sync-index")
            );
        }
        assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
    }
}

#[test]
fn cli_stale_selected_source_reports_identity_path_and_sync_recovery() {
    use sha2::{Digest, Sha256};
    let dir = fixture();
    let root = dir.path();
    fs::create_dir(root.join("records")).unwrap();
    let metadata = format!("sha256:{}", "a".repeat(64));
    let decision = "---\ntitle: Old title\nid: 240229-record\nstatus: active\nalignment: aligned\ncreatedAt: \"2024-02-29T00:00:00Z\"\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用: 选择\n";
    let report = "---\ntitle: \"Old title\"\nid: \"240229-record\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n";
    for (bin, directory, namespace, index_name, document, state) in [
        (
            env!("CARGO_BIN_EXE_decision-records"),
            "--decisions-dir",
            "decisions",
            "decision-index.json",
            decision,
            serde_json::json!({"name":"record","sourcePath":"record.md","title":"Old title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose text","background":"Background text","decision":"Decision text","tags":["tag"],"relations":[]}),
        ),
        (
            env!("CARGO_BIN_EXE_investigation-report"),
            "--investigations-dir",
            "investigations",
            "investigation-index.json",
            report,
            serde_json::json!({"name":"record","sourcePath":"record.md","title":"Old title","formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["tag"],"relations":[],"resourceIds":[]}),
        ),
    ] {
        let mut hash = Sha256::new();
        hash.update(if namespace == "decisions" {
            b"decision-index-entry-v2\0".as_slice()
        } else {
            b"investigation-index-entry-v2\0".as_slice()
        });
        for value in ["240229-record", "record.md", document] {
            hash.update(value.len().to_string().as_bytes());
            hash.update(b":");
            hash.update(value.as_bytes());
            hash.update([0]);
        }
        let fingerprint = format!("sha256:{:x}", hash.finalize());
        let index = serde_json::json!({"schemaVersion":4,"namespace":namespace,"definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":metadata,"entries":{"240229-record":fingerprint}},"entries":{"240229-record":state}});
        fs::write(
            root.join("records").join(index_name),
            serde_json::to_vec(&index).unwrap(),
        )
        .unwrap();
        fs::write(root.join("records/record.md"), document).unwrap();
        git(root, &["add", "--", "records"]);
        git(root, &["commit", "-qm", "record baseline"]);
        fs::write(
            root.join("records/record.md"),
            document.replace("Old title", "New title"),
        )
        .unwrap();
        let before = git(root, &["ls-files", "--stage", "-z"]);
        let output = Command::new(bin)
            .args(["stage", "record", "--root"])
            .arg(root)
            .args([directory, "records", "--json"])
            .output()
            .unwrap();
        assert_eq!(
            output.status.code(),
            Some(1),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        let diagnostic = &value["diagnostics"][0];
        assert_eq!(diagnostic["target"], "240229-record");
        assert_eq!(diagnostic["path"], "records/record.md");
        assert_eq!(diagnostic["causeCategory"], "index-stale");
        assert!(
            diagnostic["recovery"]
                .as_str()
                .unwrap()
                .contains("sync-index")
        );
        assert_eq!(value["result"]["pending"]["outcome"], "no-change");
        assert_eq!(value["result"]["changed"], false);
        assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
        // Reset only this isolated fixture's source so the other domain can be committed.
        fs::write(root.join("records/record.md"), document).unwrap();
    }
}
