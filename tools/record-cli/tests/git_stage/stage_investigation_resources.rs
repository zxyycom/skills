use super::*;

#[test]
fn investigation_foreign_resource_requires_pending_match_only_for_all_scope() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    use serde_json::json;
    use sha2::{Digest, Sha256};
    fn doc(title: &str) -> String {
        format!(
            "---\ntitle: \"{title}\"\nid: \"240229-report\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n## 随附资源\n- [file](./_resources/240229-owner/file.txt)\n"
        )
    }
    fn index(title: &str, source: &str) -> Vec<u8> {
        let mut h = Sha256::new();
        h.update(b"investigation-index-entry-v2\0");
        for s in ["240229-report", "report.md", source] {
            h.update(s.len().to_string().as_bytes());
            h.update(b":");
            h.update(s.as_bytes());
            h.update([0]);
        }
        let fp = format!("sha256:{:x}", h.finalize());
        let metadata = format!("sha256:{}", "a".repeat(64));
        let state = |name: &str, title: &str| json!({"name":name,"sourcePath":format!("{name}.md"),"title":title,"formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["tag"],"relations":[],"resourceIds":["240229-owner/file.txt"]});
        serde_json::to_vec(&json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":metadata,"entries":{"240229-owner":metadata,"240229-report":fp}},"entries":{"240229-owner":state("owner","Owner title"),"240229-report":state("report",title)}})).unwrap()
    }
    let dir = fixture();
    let root = dir.path();
    git(root, &["config", "core.filemode", "false"]);
    let old = include_str!("../fixtures/git-stage/foreign-resource/report.md");
    let new = doc("New title");
    fs::create_dir_all(root.join("_resources/240229-owner")).unwrap();
    fs::copy(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/git-stage/foreign-resource/_resources/240229-owner/file.txt"),
        root.join("_resources/240229-owner/file.txt"),
    )
    .unwrap();
    fs::copy(
        raw_git_fixture("foreign-resource/report.md"),
        root.join("report.md"),
    )
    .unwrap();
    fs::write(
        root.join("investigation-index.json"),
        index("Old title", old),
    )
    .unwrap();
    git(
        root,
        &[
            "add",
            "--",
            "_resources",
            "report.md",
            "investigation-index.json",
        ],
    );
    git(root, &["commit", "-qm", "foreign owner baseline"]);
    fs::write(
        root.join("_resources/240229-owner/file.txt"),
        b"worktree owner\n",
    )
    .unwrap();
    fs::write(root.join("report.md"), new.as_bytes()).unwrap();
    fs::write(
        root.join("investigation-index.json"),
        index("New title", &new),
    )
    .unwrap();
    let root_handle = open_root(root).unwrap();
    let index_path = RelativePath::new("investigation-index.json").unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    assert!(
        stage_investigations(
            &root_handle,
            &index_path,
            &["240229-report".into()],
            StageScope::All
        )
        .is_err()
    );
    assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));
    let result = stage_investigations(
        &root_handle,
        &index_path,
        &["240229-report".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert!(result.changed_paths.contains(&PathBuf::from("report.md")));
    assert_eq!(git(root, &["show", ":report.md"]), new.as_bytes());
    assert_eq!(
        git(root, &["show", ":_resources/240229-owner/file.txt"]),
        b"pending owner\n"
    );
    assert!(!root.join("owner.md").exists());
    fs::write(
        root.join("_resources/240229-owner/file.txt"),
        b"pending owner\n",
    )
    .unwrap();
    let all = stage_investigations(
        &root_handle,
        &index_path,
        &["240229-report".into()],
        StageScope::All,
    )
    .unwrap();
    assert!(
        all.updated_paths
            .contains(&PathBuf::from("investigation-index.json"))
    );
    assert!(
        !all.updated_paths
            .contains(&PathBuf::from("_resources/240229-owner/file.txt"))
    );
    assert!(!root.join("owner.md").exists());
}
#[test]
fn investigation_all_stages_deleted_owner_tree_when_directory_is_missing() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    use serde_json::json;
    use sha2::{Digest, Sha256};
    fn doc(link: bool) -> String {
        format!(
            "---\ntitle: \"Report title\"\nid: \"240229-report\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n{}",
            if link {
                "## 随附资源\n- [file](./_resources/240229-report/file.txt)\n"
            } else {
                ""
            }
        )
    }
    fn index(source: &str, link: bool) -> Vec<u8> {
        let mut hash = Sha256::new();
        hash.update(b"investigation-index-entry-v2\0");
        for value in ["240229-report", "report.md", source] {
            hash.update(value.len().to_string().as_bytes());
            hash.update(b":");
            hash.update(value.as_bytes());
            hash.update([0]);
        }
        let fp = format!("sha256:{:x}", hash.finalize());
        let meta = format!("sha256:{}", "a".repeat(64));
        serde_json::to_vec(&json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":meta,"entries":{"240229-report":fp}},"entries":{"240229-report":{"name":"report","sourcePath":"report.md","title":"Report title","formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["tag"],"relations":[],"resourceIds":if link {vec!["240229-report/file.txt"]} else {vec![]}}}})).unwrap()
    }
    let dir = fixture();
    let root = dir.path();
    git(root, &["config", "core.filemode", "false"]);
    let old = include_str!("../fixtures/git-stage/deleted-resource/report.md");
    let new = doc(false);
    fs::create_dir_all(root.join("_resources/240229-report")).unwrap();
    fs::copy(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/git-stage/deleted-resource/_resources/240229-report/file.txt"),
        root.join("_resources/240229-report/file.txt"),
    )
    .unwrap();
    fs::copy(
        raw_git_fixture("deleted-resource/report.md"),
        root.join("report.md"),
    )
    .unwrap();
    fs::write(root.join("investigation-index.json"), index(old, true)).unwrap();
    git(
        root,
        &[
            "add",
            "--",
            "_resources",
            "report.md",
            "investigation-index.json",
        ],
    );
    git(root, &["commit", "-qm", "resource baseline"]);
    fs::remove_file(root.join("_resources/240229-report/file.txt")).unwrap();
    fs::remove_dir(root.join("_resources/240229-report")).unwrap();
    fs::remove_dir(root.join("_resources")).unwrap();
    fs::write(root.join("report.md"), new.as_bytes()).unwrap();
    fs::write(root.join("investigation-index.json"), index(&new, false)).unwrap();
    let result = stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["240229-report".into()],
        StageScope::All,
    )
    .unwrap();
    assert!(
        result
            .changed_paths
            .contains(&PathBuf::from("_resources/240229-report/file.txt"))
    );
    assert!(
        git(
            root,
            &[
                "ls-files",
                "--stage",
                "-z",
                "--",
                "_resources/240229-report/file.txt"
            ]
        )
        .is_empty()
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
#[test]
fn investigation_all_selects_pending_only_name_from_canonical_locator() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    git(root, &["config", "core.filemode", "false"]);
    let hash = format!("sha256:{}", "a".repeat(64));
    let empty = serde_json::json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{}},"entries":{}});
    fs::write(
        root.join("investigation-index.json"),
        serde_json::to_vec(&empty).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", "investigation-index.json"]);
    git(root, &["commit", "-qm", "empty index"]);
    fs::write(
        root.join("240229-report.md"),
        b"---\ntitle: \"Pending\"\nid: \"240229-report\"\n---\n",
    )
    .unwrap();
    git(root, &["add", "--", "240229-report.md"]);
    fs::remove_file(root.join("240229-report.md")).unwrap();
    let result = stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["report".into()],
        StageScope::All,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-report"]);
    assert!(
        result
            .changed_paths
            .contains(&PathBuf::from("240229-report.md"))
    );
    assert!(
        git(
            root,
            &["ls-files", "--stage", "-z", "--", "240229-report.md"]
        )
        .is_empty()
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
