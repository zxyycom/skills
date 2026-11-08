use super::*;

#[test]
fn investigation_cli_rejects_invalid_arguments_without_creating_collection() {
    let cases: &[&[&str]] = &[
        &["list", "--related-to", "one", "--related-to", "two"],
        &[
            "search",
            "query",
            "--direction",
            "both",
            "--direction",
            "both",
        ],
        &["list", "--relation-type", "补充", "--relation-type", "复查"],
        &["list", "--direction", "sideways"],
        &["list", "--relation-type", "unknown"],
        &["stage"],
        &["show"],
        &["stage", "one", "--scope", "unknown"],
        &["stage", "one", "--scope", "all", "--scope", "domain"],
        &["stage", "one", "one"],
        &["list", "--investigations-dir", "../outside"],
        &["list", "--investigations-dir", "/absolute"],
        &[
            "new",
            "one",
            "--title",
            "A",
            "--title",
            "B",
            "--question",
            "Question",
            "--tag",
            "test",
        ],
    ];
    for args in cases {
        let root = tempfile::tempdir().unwrap();
        let output = run(root.path(), args);
        assert!(!output.status.success(), "unexpected success: {args:?}");
        let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(response["ok"], false, "{args:?}");
        let expected = if args.contains(&"--investigations-dir") {
            "invalid-path"
        } else {
            "invalid-arguments"
        };
        assert_eq!(response["error"]["code"], expected, "{args:?}");
        assert!(!root.path().join("docs").exists(), "{args:?}");
    }
}

#[test]
fn investigation_cli_discard_path_selector_keeps_existing_candidate() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    assert!(new(root, "target", &[]).status.success());
    let path = root.join("docs/investigations/_candidate.261106-target");
    let before = fs::read(&path).unwrap();
    let output = run(root, &["discard", "../outside"]);
    assert_eq!(output.status.code(), Some(1));
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["error"]["code"], "selector");
    assert_eq!(fs::read(path).unwrap(), before);
    assert_eq!(candidate_names(root).len(), 1);
}

#[test]
fn investigation_empty_collection_requires_an_existing_empty_index() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    let directory = root.join("docs/investigations");
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("investigation-index.json");
    for command in ["check", "sync-index"] {
        let result = run(root, &[command]);
        assert_eq!(result.status.code(), Some(1));
        let value: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(value["error"]["code"], "empty-collection");
        assert!(!path.exists());
    }
    let empty = serde_json::json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":record_cli::source_revision::metadata_fingerprint(record_cli::source_revision::Domain::Investigation),"entries":{}},"entries":{}});
    let index = record_cli::index::parse_index(
        &serde_json::to_vec(&empty).unwrap(),
        &record_cli::domains::investigation::Definition,
    )
    .unwrap();
    fs::write(
        &path,
        record_cli::index::serialize_index(&index, &record_cli::domains::investigation::Definition)
            .unwrap(),
    )
    .unwrap();
    for command in ["check", "sync-index"] {
        let result = run(root, &[command]);
        assert!(
            result.status.success(),
            "{command}: {}",
            String::from_utf8_lossy(&result.stdout)
        );
    }
}

#[test]
fn investigation_show_candidate_distinguishes_invalid_scaffold_and_unready_content_resources() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    assert!(new(root, "example", &[]).status.success());
    let path = root.join("docs/investigations/_candidate.261106-example");
    let original = fs::read_to_string(&path).unwrap();
    let shown = run(root, &["show-candidate", "example"]);
    assert!(shown.status.success());
    let shown: serde_json::Value = serde_json::from_slice(&shown.stdout).unwrap();
    assert_eq!(
        shown["result"]["candidate"]["readiness"]["scaffoldValid"],
        true
    );
    assert_eq!(
        shown["result"]["candidate"]["readiness"]["bodyReady"],
        false
    );
    fs::write(
        &path,
        format!("{original}\n## 随附资源\n- [missing](./_resources/261106-example/missing.txt)\n"),
    )
    .unwrap();
    let missing = run(root, &["show-candidate", "example"]);
    assert!(missing.status.success());
    let missing: serde_json::Value = serde_json::from_slice(&missing.stdout).unwrap();
    assert_eq!(
        missing["result"]["candidate"]["readiness"]["resourceReady"],
        false
    );
    fs::write(&path, original.replace("  - \"test\"", "  - \"Bad_Tag\"")).unwrap();
    let invalid = run(root, &["show-candidate", "example"]);
    assert!(!invalid.status.success());
    let invalid: serde_json::Value = serde_json::from_slice(&invalid.stdout).unwrap();
    assert_eq!(invalid["ok"], false);
}

#[test]
fn investigation_publish_with_formal_sources_requires_valid_baseline_and_preserves_candidates() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    let dir = root.join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let old = ready_report("261106-old", "relations: []", "");
    let candidate = ready_report("261106-next", "relations: []", "");
    fs::write(dir.join("old.md"), &old).unwrap();
    fs::write(dir.join("_candidate.261106-next"), &candidate).unwrap();
    let index = dir.join("investigation-index.json");
    for broken in [false, true] {
        if broken {
            fs::write(&index, b"invalid index").unwrap();
        }
        let result = run(root, &["publish", "next"]);
        assert!(
            !result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stdout)
        );
        let response: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(
            response["error"]["code"],
            if broken {
                "index-invalid"
            } else {
                "index-missing"
            }
        );
        assert_eq!(fs::read_to_string(dir.join("old.md")).unwrap(), old);
        assert_eq!(
            fs::read_to_string(dir.join("_candidate.261106-next")).unwrap(),
            candidate
        );
        assert!(!dir.join("261106-next.md").exists());
        if broken {
            assert_eq!(fs::read(&index).unwrap(), b"invalid index");
        } else {
            assert!(!index.exists());
        }
    }
}
