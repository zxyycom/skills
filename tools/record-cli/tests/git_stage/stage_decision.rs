use super::*;

fn commit_empty_decision_index(root: &Path) {
    let hash = format!("sha256:{}", "a".repeat(64));
    let empty = serde_json::json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{}},"entries":{}});
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&empty).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    git(root, &["commit", "-qm", "empty index"]);
}

#[test]
fn decision_source_scopes_stage_selected_document_and_preserve_unrelated() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    use serde_json::{Value, json};
    use sha2::{Digest, Sha256};
    fn document(title: &str) -> String {
        format!(
            "---\ntitle: {title}\nid: 240229-record\nstatus: active\nalignment: aligned\ncreatedAt: \"2024-02-29T00:00:00Z\"\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用: 选择\n"
        )
    }
    fn fingerprint(text: &str) -> String {
        let mut hash = Sha256::new();
        hash.update(b"decision-index-entry-v2\0");
        for value in ["240229-record", "record.md", text] {
            hash.update(value.len().to_string().as_bytes());
            hash.update(b":");
            hash.update(value.as_bytes());
            hash.update([0]);
        }
        format!("sha256:{:x}", hash.finalize())
    }
    fn index(title: &str, doc: &str) -> Vec<u8> {
        let hash = format!("sha256:{}", "a".repeat(64));
        serde_json::to_vec(&json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-record":fingerprint(doc)}},"entries":{"240229-record":{"name":"record","sourcePath":"record.md","title":title,"status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose text","background":"Background text","decision":"Decision text","tags":["tag"],"relations":[]}}})).unwrap()
    }
    for (scope, unreadable_locator) in [
        (StageScope::All, false),
        (StageScope::Domain, false),
        (StageScope::Domain, true),
    ] {
        let dir = fixture();
        let root = dir.path();
        let old = document("Old title");
        let new = document("New title");
        let old_index = index("Old title", &old);
        let new_index = index("New title", &new);
        fs::write(root.join("record.md"), old.as_bytes()).unwrap();
        fs::write(root.join("decision-index.json"), &old_index).unwrap();
        git(root, &["add", "--", "record.md", "decision-index.json"]);
        git(root, &["commit", "-qm", "records baseline"]);
        if scope == StageScope::Domain {
            fs::write(root.join("decision-index.json"), b"not valid JSON").unwrap();
            git(root, &["add", "--", "decision-index.json"]);
        }
        let pending_index_oid =
            String::from_utf8(git(root, &["rev-parse", ":decision-index.json"])).unwrap();
        if unreadable_locator {
            let oid = pending_index_oid.trim();
            fs::remove_file(root.join(".git/objects").join(&oid[..2]).join(&oid[2..])).unwrap();
        }
        fs::write(root.join("record.md"), new.as_bytes()).unwrap();
        fs::write(root.join("decision-index.json"), &new_index).unwrap();
        let result = stage_decisions(
            &open_root(root).unwrap(),
            &RelativePath::new("decision-index.json").unwrap(),
            &["240229-record".into()],
            scope,
        )
        .unwrap();
        assert_eq!(result.selected_ids, ["240229-record"]);
        assert_eq!(
            result.caller_owned_paths,
            if scope == StageScope::Domain {
                vec![PathBuf::from("decision-index.json")]
            } else {
                vec![]
            }
        );
        assert!(result.updated_paths.contains(&PathBuf::from("record.md")));
        assert!(
            !result
                .preserved_pending_paths
                .contains(&PathBuf::from("record.md"))
        );
        assert!(result.changed_paths.contains(&PathBuf::from("record.md")));
        assert_eq!(git(root, &["show", ":record.md"]), new.as_bytes());
        assert_eq!(fs::read(root.join("record.md")).unwrap(), new.as_bytes());
        if unreadable_locator {
            assert_eq!(
                String::from_utf8(git(root, &["rev-parse", ":decision-index.json"])).unwrap(),
                pending_index_oid
            );
            assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
            continue;
        }
        let index_pending = git(root, &["show", ":decision-index.json"]);
        if scope == StageScope::All {
            let actual: Value = serde_json::from_slice(&index_pending).unwrap();
            assert_eq!(actual["entries"]["240229-record"]["title"], "New title");
        } else {
            assert_eq!(index_pending, b"not valid JSON");
        }
        assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
        fs::write(root.join("record.md"), document("Tampered title")).unwrap();
        assert!(
            stage_decisions(
                &open_root(root).unwrap(),
                &RelativePath::new("decision-index.json").unwrap(),
                &["240229-record".into()],
                scope
            )
            .is_err()
        );
        assert_eq!(git(root, &["show", ":record.md"]), new.as_bytes());
        fs::write(root.join("record.md"), b"invalid pending body").unwrap();
        git(root, &["add", "--", "record.md"]);
        fs::write(root.join("record.md"), new.as_bytes()).unwrap();
        let invalid_before = git(root, &["ls-files", "--stage", "-z"]);
        assert!(
            stage_decisions(
                &open_root(root).unwrap(),
                &RelativePath::new("decision-index.json").unwrap(),
                &["240229-record".into()],
                scope
            )
            .is_err()
        );
        assert_eq!(invalid_before, git(root, &["ls-files", "--stage", "-z"]));
    }
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git(root, &["init", "-q"]);
    let source = document("First title");
    fs::write(root.join("record.md"), source.as_bytes()).unwrap();
    fs::write(
        root.join("decision-index.json"),
        index("First title", &source),
    )
    .unwrap();
    let result = stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::All,
    )
    .unwrap();
    assert!(result.changed_paths.contains(&PathBuf::from("record.md")));
    assert_eq!(git(root, &["show", ":record.md"]), source.as_bytes());
}
#[test]
fn decision_all_scope_stages_selected_deletion_without_touching_other_pending() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    use serde_json::{Value, json};
    let dir = fixture();
    let root = dir.path();
    let hash = format!("sha256:{}", "a".repeat(64));
    let doc = "---\ntitle: Old title\nid: 240229-record\nstatus: active\nalignment: aligned\ncreatedAt: \"2024-02-29T00:00:00Z\"\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用: 选择\n";
    let old = json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-record":hash}},"entries":{"240229-record":{"name":"record","sourcePath":"record.md","title":"Old title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose text","background":"Background text","decision":"Decision text","tags":["tag"],"relations":[]}}});
    let new = json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{}},"entries":{}});
    fs::write(root.join("record.md"), doc).unwrap();
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&old).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", "record.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "records baseline"]);
    fs::remove_file(root.join("record.md")).unwrap();
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&new).unwrap(),
    )
    .unwrap();
    let result = stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::All,
    )
    .unwrap();
    assert!(result.changed_paths.contains(&PathBuf::from("record.md")));
    let pending = git(root, &["ls-files", "--stage", "-z", "--", "record.md"]);
    assert!(pending.is_empty());
    let index: Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert_eq!(index["entries"], json!({}));
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
#[test]
fn decision_all_selects_dated_pending_only_locator_without_scanning_other_blobs() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    commit_empty_decision_index(root);
    fs::write(
        root.join("240229-record.md"),
        b"---\nid: 240229-record\n---\n",
    )
    .unwrap();
    git(root, &["add", "--", "240229-record.md"]);
    fs::remove_file(root.join("240229-record.md")).unwrap();
    let result = stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::All,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-record"]);
    assert!(
        result
            .changed_paths
            .contains(&PathBuf::from("240229-record.md"))
    );
    assert!(
        git(
            root,
            &["ls-files", "--stage", "-z", "--", "240229-record.md"]
        )
        .is_empty()
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
#[test]
fn decision_all_uses_pending_index_to_remove_third_old_location() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    use serde_json::json;
    use sha2::{Digest, Sha256};
    let doc = "---\ntitle: Old title\nid: 240229-record\nstatus: active\nalignment: aligned\ncreatedAt: \"2024-02-29T00:00:00Z\"\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用: 选择\n";
    let mut digest = Sha256::new();
    digest.update(b"decision-index-entry-v2\0");
    for s in ["240229-record", "record.md", doc] {
        digest.update(s.len().to_string().as_bytes());
        digest.update(b":");
        digest.update(s.as_bytes());
        digest.update([0]);
    }
    let fingerprint = format!("sha256:{:x}", digest.finalize());
    let hash = format!("sha256:{}", "a".repeat(64));
    let mut index = json!({"schemaVersion":4,"namespace":"decisions","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-record":fingerprint}},"entries":{"240229-record":{"name":"record","sourcePath":"record.md","title":"Old title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose text","background":"Background text","decision":"Decision text","tags":["tag"],"relations":[]}}});
    let dir = fixture();
    let root = dir.path();
    fs::write(root.join("record.md"), doc).unwrap();
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", "record.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "records baseline"]);
    fs::create_dir(root.join("archive")).unwrap();
    fs::write(root.join("archive/record.md"), doc).unwrap();
    git(root, &["rm", "--cached", "-q", "--", "record.md"]);
    git(root, &["add", "--", "archive/record.md"]);
    fs::remove_file(root.join("archive/record.md")).unwrap();
    index["entries"]["240229-record"]["sourcePath"] = json!("archive/record.md");
    index["entries"]["240229-record"]["status"] = json!("archived");
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    index["entries"]["240229-record"]["sourcePath"] = json!("record.md");
    index["entries"]["240229-record"]["status"] = json!("active");
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    let result = stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::All,
    )
    .unwrap();
    assert!(
        result
            .changed_paths
            .contains(&PathBuf::from("archive/record.md"))
    );
    assert!(result.changed_paths.contains(&PathBuf::from("record.md")));
    assert!(
        git(
            root,
            &["ls-files", "--stage", "-z", "--", "archive/record.md"]
        )
        .is_empty()
    );
    assert_eq!(git(root, &["show", ":record.md"]), doc.as_bytes());
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
#[test]
fn decision_all_resolves_pending_only_name_from_selected_payload() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    commit_empty_decision_index(root);
    fs::write(root.join("record.md"), b"---\nid: 240229-record\n---\n").unwrap();
    git(root, &["add", "--", "record.md"]);
    fs::remove_file(root.join("record.md")).unwrap();
    let result = stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["record".into()],
        StageScope::All,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-record"]);
    assert!(result.changed_paths.contains(&PathBuf::from("record.md")));
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "record.md"]).is_empty());
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
