use super::*;

fn report_index(title: &str, source: &str, resources: &[&str]) -> Vec<u8> {
    use serde_json::json;
    use sha2::{Digest, Sha256};
    let mut hash = Sha256::new();
    hash.update(b"investigation-index-entry-v2\0");
    for value in ["240229-report", "report.md", source] {
        hash.update(value.len().to_string().as_bytes());
        hash.update(b":");
        hash.update(value.as_bytes());
        hash.update([0]);
    }
    let fingerprint = format!("sha256:{:x}", hash.finalize());
    let metadata = format!("sha256:{}", "a".repeat(64));
    serde_json::to_vec(&json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":metadata,"entries":{"240229-report":fingerprint}},"entries":{"240229-report":{"name":"report","sourcePath":"report.md","title":title,"formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["tag"],"relations":[],"resourceIds":resources}}})).unwrap()
}

#[test]
fn investigation_source_scopes_stage_when_resource_root_is_proven_absent() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    use serde_json::Value;
    fn doc(title: &str) -> String {
        format!(
            "---\ntitle: \"{title}\"\nid: \"240229-report\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n"
        )
    }
    for scope in [StageScope::All, StageScope::Domain] {
        let dir = fixture();
        let root = dir.path();
        git(root, &["config", "core.filemode", "false"]);
        let old = include_str!("../../fixtures/git-stage/documents/report-no-resources.md");
        let new = doc("New title");
        let old_index = report_index("Old title", old, &[]);
        let new_index = report_index("New title", &new, &[]);
        fs::copy(
            raw_document("report-no-resources.md"),
            root.join("report.md"),
        )
        .unwrap();
        fs::write(root.join("investigation-index.json"), &old_index).unwrap();
        git(
            root,
            &["add", "--", "report.md", "investigation-index.json"],
        );
        git(root, &["commit", "-qm", "reports baseline"]);
        fs::write(root.join("report.md"), new.as_bytes()).unwrap();
        fs::write(root.join("investigation-index.json"), &new_index).unwrap();
        let result = stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-report".into()],
            scope,
        )
        .unwrap();
        assert_eq!(result.selected_ids, ["240229-report"]);
        assert!(result.changed_paths.contains(&PathBuf::from("report.md")));
        assert_eq!(git(root, &["show", ":report.md"]), new.as_bytes());
        let pending: Value =
            serde_json::from_slice(&git(root, &["show", ":investigation-index.json"])).unwrap();
        assert_eq!(
            pending["entries"]["240229-report"]["title"],
            if scope == StageScope::All {
                "New title"
            } else {
                "Old title"
            }
        );
        assert_eq!(fs::read(root.join("report.md")).unwrap(), new.as_bytes());
        assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
        fs::create_dir(root.join("_resources")).unwrap();
        let before = git(root, &["ls-files", "--stage", "-z"]);
        assert!(
            stage_investigations(
                &open_root(root).unwrap(),
                &RelativePath::new("investigation-index.json").unwrap(),
                &["240229-report".into()],
                scope
            )
            .unwrap()
            .changed_paths
            .is_empty()
        );
        assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));
    }
}
#[test]
fn investigation_source_scopes_stage_managed_owner_tree_and_ignore_extras() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    use serde_json::Value;
    fn doc(title: &str) -> String {
        format!(
            "---\ntitle: \"{title}\"\nid: \"240229-report\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n## 随附资源\n- [file](./_resources/240229-report/file.txt)\n"
        )
    }
    for scope in [StageScope::All, StageScope::Domain] {
        let dir = fixture();
        let root = dir.path();
        git(root, &["config", "core.filemode", "false"]);
        let old = include_str!("../../fixtures/git-stage/resources/report.md");
        let new = doc("New title");
        fs::create_dir_all(root.join("_resources/240229-report")).unwrap();
        let raw = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/git-stage/resources/_resources/240229-report");
        for name in ["file.txt", "remove.txt", "revive.txt"] {
            fs::copy(
                raw.join(name),
                root.join("_resources/240229-report").join(name),
            )
            .unwrap();
        }
        let revived_bytes = fs::read(root.join("_resources/240229-report/revive.txt")).unwrap();
        fs::copy(
            raw_git_fixture("resources/report.md"),
            root.join("report.md"),
        )
        .unwrap();
        fs::write(
            root.join("investigation-index.json"),
            report_index("Old title", old, &["240229-report/file.txt"]),
        )
        .unwrap();
        git(
            root,
            &[
                "add",
                "--",
                "report.md",
                "investigation-index.json",
                "_resources",
            ],
        );
        git(root, &["commit", "-qm", "baseline with resources"]);
        fs::create_dir_all(root.join("_resources/240229-other")).unwrap();
        fs::write(
            root.join("_resources/240229-other/unreadable.txt"),
            b"private unrelated object\n",
        )
        .unwrap();
        git(
            root,
            &["add", "--", "_resources/240229-other/unreadable.txt"],
        );
        let unrelated_oid = String::from_utf8(git(
            root,
            &["rev-parse", ":_resources/240229-other/unreadable.txt"],
        ))
        .unwrap();
        let oid = unrelated_oid.trim();
        fs::remove_file(root.join(".git/objects").join(&oid[..2]).join(&oid[2..])).unwrap();
        git(
            root,
            &[
                "rm",
                "--cached",
                "-q",
                "--",
                "_resources/240229-report/revive.txt",
            ],
        );
        git(
            root,
            &[
                "update-index",
                "--chmod=+x",
                "_resources/240229-report/file.txt",
            ],
        );
        fs::write(
            root.join("_resources/240229-report/file.txt"),
            b"new file\n",
        )
        .unwrap();
        fs::remove_file(root.join("_resources/240229-report/remove.txt")).unwrap();
        fs::write(
            root.join("_resources/240229-report/new-extra.txt"),
            b"new extra\n",
        )
        .unwrap();
        fs::write(
            root.join("_resources/240229-report/new extra.txt"),
            b"space name\n",
        )
        .unwrap();
        fs::write(
            root.join(".gitignore"),
            b"_resources/240229-report/ignored.txt\n_resources/240229-report/revive.txt\n",
        )
        .unwrap();
        fs::write(
            root.join("_resources/240229-report/ignored.txt"),
            b"ignored sentinel\n",
        )
        .unwrap();
        fs::write(root.join("report.md"), new.as_bytes()).unwrap();
        fs::write(
            root.join("investigation-index.json"),
            report_index("New title", &new, &["240229-report/file.txt"]),
        )
        .unwrap();
        let result = stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-report".into()],
            scope,
        )
        .unwrap();
        for path in [
            "_resources/240229-report/revive.txt",
            "report.md",
            "_resources/240229-report/file.txt",
            "_resources/240229-report/new-extra.txt",
            "_resources/240229-report/remove.txt",
        ] {
            assert!(
                result.updated_paths.contains(&PathBuf::from(path)),
                "{path}"
            );
        }
        assert_eq!(
            git(root, &["show", ":_resources/240229-report/revive.txt"]),
            revived_bytes
        );
        assert_eq!(
            git(root, &["show", ":_resources/240229-report/file.txt"]),
            b"new file\n"
        );
        let modes = String::from_utf8(git(
            root,
            &[
                "ls-files",
                "--stage",
                "--",
                "_resources/240229-report/file.txt",
            ],
        ))
        .unwrap();
        assert!(modes.starts_with("100755 "));
        assert!(
            git(
                root,
                &[
                    "ls-files",
                    "--stage",
                    "-z",
                    "--",
                    "_resources/240229-report/remove.txt"
                ]
            )
            .is_empty()
        );
        assert_eq!(
            git(root, &["show", ":_resources/240229-report/new-extra.txt"]),
            b"new extra\n"
        );
        assert!(
            git(
                root,
                &[
                    "ls-files",
                    "--stage",
                    "-z",
                    "--",
                    "_resources/240229-report/ignored.txt"
                ]
            )
            .is_empty()
        );
        assert_eq!(
            fs::read(root.join("_resources/240229-report/ignored.txt")).unwrap(),
            b"ignored sentinel\n"
        );
        assert_eq!(
            String::from_utf8(git(
                root,
                &["rev-parse", ":_resources/240229-other/unreadable.txt"]
            ))
            .unwrap(),
            unrelated_oid
        );
        let pending: Value =
            serde_json::from_slice(&git(root, &["show", ":investigation-index.json"])).unwrap();
        assert_eq!(
            pending["entries"]["240229-report"]["title"],
            if scope == StageScope::All {
                "New title"
            } else {
                "Old title"
            }
        );
        assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
        assert_eq!(
            git(root, &["show", ":_resources/240229-report/new extra.txt"]),
            b"space name\n"
        );
        fs::remove_file(root.join("_resources/240229-report/new extra.txt")).unwrap();
        stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-report".into()],
            scope,
        )
        .unwrap();
        assert!(
            git(
                root,
                &["ls-files", "--", "_resources/240229-report/new extra.txt"]
            )
            .is_empty()
        );
        fs::remove_file(root.join("_resources/240229-report/file.txt")).unwrap();
        let before_missing = git(root, &["ls-files", "--stage", "-z"]);
        assert!(
            stage_investigations(
                &open_root(root).unwrap(),
                &RelativePath::new("investigation-index.json").unwrap(),
                &["240229-report".into()],
                scope
            )
            .is_err()
        );
        assert_eq!(before_missing, git(root, &["ls-files", "--stage", "-z"]));
    }
}
