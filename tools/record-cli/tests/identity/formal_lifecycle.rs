use super::*;

#[test]
fn decision_archive_reactivate_round_trip_preserves_creation_identity() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let run = |args: &[&str]| {
        let out = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .arg("--root")
            .arg(dir.path())
            .args(["--decisions-dir", "decisions"])
            .args(args)
            .arg("--json")
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "stdout={} stderr={}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
    };
    let id = "261106-original";
    let original = std::fs::read_to_string(base.join("original.md")).unwrap();
    let index_before = index::parse_index(
        &std::fs::read(base.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    let created = index_before.index().entries[id].created_at.clone();
    run(&["archive", "original"]);
    assert!(!base.join("original.md").exists());
    assert!(base.join("archive/original.md").exists());
    let archived = index::parse_index(
        &std::fs::read(base.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        archived.index().entries[id].source_path,
        "archive/original.md"
    );
    assert_eq!(archived.index().entries[id].created_at, created);
    run(&["reactivate", "original", "--alignment", "aligned"]);
    assert!(!base.join("archive/original.md").exists());
    let current = std::fs::read_to_string(base.join("original.md")).unwrap();
    assert!(current.contains("id: 261106-original"));
    assert!(current.contains("Body remains") || current.contains("title: Example"));
    assert!(original.contains("id: 261106-original"));
    let reactivated = index::parse_index(
        &std::fs::read(base.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(reactivated.index().entries[id].source_path, "original.md");
    assert_eq!(reactivated.index().entries[id].status, "active");
    assert_eq!(reactivated.index().entries[id].created_at, created);
}

#[test]
fn decision_discard_last_archived_retains_empty_index_for_next_publish() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let run = |args: &[&str]| {
        let out = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .arg("--root")
            .arg(dir.path())
            .args(["--decisions-dir", "decisions"])
            .args(args)
            .arg("--json")
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stdout)
        );
    };
    run(&["archive", "original"]);
    run(&["discard", "original"]);
    assert!(!base.join("archive/original.md").exists());
    let bytes = std::fs::read(base.join("decision-index.json")).unwrap();
    assert!(
        index::parse_index(&bytes, &Definition)
            .unwrap()
            .index()
            .entries
            .is_empty()
    );
    let draft = include_str!("../fixtures/identity/decisions/draft.md")
        .replace("\r\n", "\n")
        .replace(
            "## 目的\n\n## 背景\n\n## 决策",
            "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
        );
    std::fs::write(base.join("draft.md"), draft).unwrap();
    run(&["publish", "draft", "--alignment", "aligned"]);
    let bytes = std::fs::read(base.join("decision-index.json")).unwrap();
    assert!(
        index::parse_index(&bytes, &Definition)
            .unwrap()
            .index()
            .entries
            .contains_key("261106-draft")
    );
}

#[test]
fn decision_archived_unrecorded_predecessor_requires_history_confirmation() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let invoke = |args: &[&str]| {
        std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .arg("--root")
            .arg(dir.path())
            .args(["--decisions-dir", "decisions"])
            .args(args)
            .arg("--json")
            .output()
            .unwrap()
    };
    assert!(invoke(&["archive", "original"]).status.success());
    initialize_git(dir.path());
    let draft = include_str!("../fixtures/identity/decisions/draft.md")
        .replace("\r\n", "\n")
        .replace(
            "relations: []",
            "relations:\n  - type: 修订\n    target: 261106-original\n    summary: Reason",
        )
        .replace(
            "## 目的\n\n## 背景\n\n## 决策",
            "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
        );
    std::fs::write(base.join("draft.md"), &draft).unwrap();
    let before = std::fs::read(base.join("decision-index.json")).unwrap();
    let previous = std::fs::read(base.join("archive/original.md")).unwrap();
    let unconfirmed = invoke(&["publish", "draft", "--alignment", "aligned"]);
    assert!(!unconfirmed.status.success());
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        before
    );
    assert_eq!(
        std::fs::read_to_string(base.join("draft.md")).unwrap(),
        draft
    );
    assert_eq!(
        std::fs::read(base.join("archive/original.md")).unwrap(),
        previous
    );
    let confirmed = invoke(&[
        "publish",
        "draft",
        "--alignment",
        "aligned",
        "--keep-unrecorded-history",
    ]);
    assert!(
        confirmed.status.success(),
        "{}",
        String::from_utf8_lossy(&confirmed.stdout)
    );
    assert_eq!(
        std::fs::read(base.join("archive/original.md")).unwrap(),
        previous
    );
    let index = index::parse_index(
        &std::fs::read(base.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        index.index().entries["261106-draft"].relations[0].target,
        "261106-original"
    );
}

#[test]
fn decision_mark_aligned_requires_explicit_missing_index_recovery() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let before = std::fs::read(base.join("original.md")).unwrap();
    std::fs::remove_file(base.join("decision-index.json")).unwrap();
    let run = |args: &[&str]| {
        std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .arg("--root")
            .arg(dir.path())
            .args(["--decisions-dir", "decisions"])
            .args(args)
            .arg("--json")
            .output()
            .unwrap()
    };
    assert!(!run(&["mark-aligned", "original"]).status.success());
    assert_eq!(std::fs::read(base.join("original.md")).unwrap(), before);
    assert!(!base.join("decision-index.json").exists());
    let sync = run(&["sync-index"]);
    assert!(
        sync.status.success(),
        "{}",
        String::from_utf8_lossy(&sync.stdout)
    );
    let mark = run(&["mark-aligned", "original"]);
    assert!(
        mark.status.success(),
        "{}",
        String::from_utf8_lossy(&mark.stdout)
    );
    let bytes = std::fs::read(base.join("decision-index.json")).unwrap();
    let index = index::parse_index(&bytes, &Definition).unwrap();
    assert_eq!(
        index.index().entries["261106-original"].alignment,
        "aligned"
    );
}

#[test]
fn decision_discard_rejects_open_split_graph_without_writes() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let original = std::fs::read_to_string(base.join("original.md")).unwrap();
    let prior = original.replace("status: active", "status: archived");
    let first = original.replace("261106-original", "261106-first").replace(
        "relations: []",
        "relations:\n  - type: 拆分\n    target: 261106-original\n    summary: First",
    );
    let second = original
        .replace("261106-original", "261106-second")
        .replace(
            "relations: []",
            "relations:\n  - type: 拆分\n    target: 261106-original\n    summary: Second",
        );
    std::fs::create_dir(base.join("archive")).unwrap();
    std::fs::remove_file(base.join("original.md")).unwrap();
    let docs = [
        ("261106-original", "archive/original.md", prior.as_str()),
        ("261106-first", "first.md", first.as_str()),
        ("261106-second", "second.md", second.as_str()),
    ];
    let mut entries = BTreeMap::new();
    let mut revisions = BTreeMap::new();
    for (id, path, text) in docs {
        std::fs::write(base.join(path), text).unwrap();
        entries.insert(
            id.into(),
            decision::parse_established(text.as_bytes(), id, path)
                .unwrap()
                .state,
        );
        revisions.insert(
            id.into(),
            source_revision::fingerprint(Domain::Decision, id, path, text),
        );
    }
    let index = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: revisions,
            },
            entries,
        },
        &Definition,
    )
    .unwrap();
    let before = index::serialize_index(&index, &Definition).unwrap();
    std::fs::write(base.join("decision-index.json"), &before).unwrap();
    let mut op = operation(Action::Discard {
        confirm_recorded: false,
    });
    op.selector = "first".into();
    let result = transaction::run_transaction(&root, &mut op);
    assert!(!result.errors.is_empty());
    assert!(!result.changed && !result.committed);
    assert_eq!(
        std::fs::read_to_string(base.join("first.md")).unwrap(),
        first
    );
    assert_eq!(
        std::fs::read_to_string(base.join("second.md")).unwrap(),
        second
    );
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        before
    );
}
