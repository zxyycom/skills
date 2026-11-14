use super::*;

#[test]
fn decision_candidate_queries_respect_empty_and_trusted_published_index() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let formal = std::fs::read(base.join("original.md")).unwrap();
    let baseline = std::fs::read(base.join("decision-index.json")).unwrap();
    std::fs::copy(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/identity/decisions/draft.md"),
        base.join("draft.md"),
    )
    .unwrap();
    let empty = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::new(),
            },
            entries: BTreeMap::new(),
        },
        &Definition,
    )
    .unwrap();
    let run = |command: &str| {
        let mut call = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"));
        call.arg("--root")
            .arg(dir.path())
            .args(["--decisions-dir", "decisions", command]);
        if command == "show-candidate" {
            call.arg("draft");
        }
        call.arg("--json").output().unwrap()
    };
    std::fs::remove_file(base.join("original.md")).unwrap();
    std::fs::write(
        base.join("decision-index.json"),
        index::serialize_index(&empty, &Definition).unwrap(),
    )
    .unwrap();
    for command in ["candidates", "show-candidate"] {
        let out = run(command);
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stdout)
        );
        assert!(String::from_utf8_lossy(&out.stdout).contains("261106-draft"));
    }
    std::fs::write(base.join("original.md"), b"invalid unselected formal body").unwrap();
    std::fs::write(base.join("decision-index.json"), &baseline).unwrap();
    for command in ["candidates", "show-candidate"] {
        let out = run(command);
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stdout)
        );
        assert!(String::from_utf8_lossy(&out.stdout).contains("261106-draft"));
    }
    std::fs::write(base.join("original.md"), formal).unwrap();
    std::fs::write(base.join("decision-index.json"), b"not JSON").unwrap();
    for command in ["candidates", "show-candidate"] {
        assert!(!run(command).status.success());
    }
    std::fs::remove_file(base.join("decision-index.json")).unwrap();
    for command in ["candidates", "show-candidate"] {
        assert!(!run(command).status.success());
    }
}

#[test]
fn decision_publish_requires_ready_candidate_and_rejects_republication() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let draft = include_str!("../fixtures/identity/decisions/draft.md").replace("\r\n", "\n");
    std::fs::write(base.join("draft.md"), &draft).unwrap();
    let index_before = std::fs::read(base.join("decision-index.json")).unwrap();
    let run = |preflight: bool| {
        let mut cmd = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"));
        cmd.arg("--root").arg(dir.path()).args([
            "--decisions-dir",
            "decisions",
            "publish",
            "draft",
            "--alignment",
            "aligned",
            "--json",
        ]);
        if preflight {
            cmd.arg("--preflight");
        }
        cmd.output().unwrap()
    };
    assert!(!run(true).status.success());
    assert_eq!(
        std::fs::read_to_string(base.join("draft.md")).unwrap(),
        draft
    );
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        index_before
    );
    let ready = draft.replace(
        "## 目的\n\n## 背景\n\n## 决策",
        "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
    );
    std::fs::write(base.join("draft.md"), &ready).unwrap();
    assert!(run(true).status.success());
    assert_eq!(
        std::fs::read_to_string(base.join("draft.md")).unwrap(),
        ready
    );
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        index_before
    );
    let published = run(false);
    assert!(
        published.status.success(),
        "{}",
        String::from_utf8_lossy(&published.stdout)
    );
    let result = std::fs::read(base.join("draft.md")).unwrap();
    let index_after = std::fs::read(base.join("decision-index.json")).unwrap();
    let parsed = index::parse_index(&index_after, &Definition).unwrap();
    let entry = &parsed.index().entries["261106-draft"];
    assert_eq!(entry.alignment, "aligned");
    assert!(entry.created_at.ends_with('Z'));
    assert!(!run(false).status.success());
    assert_eq!(std::fs::read(base.join("draft.md")).unwrap(), result);
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        index_after
    );
}

#[test]
fn decision_legacy_numeric_name_candidate_can_be_discovered_and_published() {
    let (dir, _) = fixture();
    let base = dir.path().join("decisions");
    let doc = include_str!("../fixtures/identity/decisions/draft.md")
        .replace("\r\n", "\n")
        .replace("261106-draft", "2026-choice")
        .replace(
            "## 目的\n\n## 背景\n\n## 决策",
            "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
        );
    std::fs::write(base.join("2026-choice.md"), &doc).unwrap();
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
    let show = run(&["show-candidate", "2026-choice"]);
    assert!(
        show.status.success(),
        "{}",
        String::from_utf8_lossy(&show.stdout)
    );
    assert!(String::from_utf8_lossy(&show.stdout).contains("2026-choice"));
    let publish = run(&["publish", "2026-choice", "--alignment", "aligned"]);
    assert!(
        publish.status.success(),
        "{}",
        String::from_utf8_lossy(&publish.stdout)
    );
    let bytes = std::fs::read(base.join("decision-index.json")).unwrap();
    assert!(
        index::parse_index(&bytes, &Definition)
            .unwrap()
            .index()
            .entries
            .contains_key("2026-choice")
    );
}

#[test]
fn decision_new_candidates_keep_distinct_dated_and_legacy_identities() {
    use record_cli::mutations::authoring::{NewInput, NewOperation};
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let legacy = include_str!("../fixtures/identity/decisions/draft.md")
        .replace("\r\n", "\n")
        .replace("261106-draft", "draft");
    std::fs::write(base.join("draft.md"), &legacy).unwrap();
    let input = || NewInput::Decision {
        title: "Title".into(),
        purpose: "Purpose".into(),
        background: "Background".into(),
        decision: "Choice".into(),
        tags: vec!["test".into()],
        relations: vec![],
        preflight_alignment: None,
    };
    let make = |timestamp: &str| {
        NewOperation::at(
            RelativePath::new("decisions").unwrap(),
            "draft".into(),
            input(),
            timestamp.into(),
        )
        .unwrap()
    };
    let mut earlier = make("2026-11-05T12:00:00Z");
    let mut current = make("2026-11-06T12:00:00Z");
    assert!(transaction::run_transaction(&root, &mut earlier).committed);
    assert!(transaction::run_transaction(&root, &mut current).committed);
    let path = base.join("261106-draft.md");
    let before = std::fs::read(&path).unwrap();
    let duplicate = transaction::run_transaction(&root, &mut current);
    assert!(!duplicate.errors.is_empty() && !duplicate.committed);
    assert_eq!(std::fs::read(&path).unwrap(), before);
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
    assert!(!run(&["show-candidate", "draft"]).status.success());
    assert!(run(&["show-candidate", "261106-draft"]).status.success());
    let ready = String::from_utf8(before).unwrap().replace(
        "## 目的\n\n## 背景\n\n## 决策",
        "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
    );
    std::fs::write(&path, ready).unwrap();
    let publish = run(&["publish", "261106-draft", "--alignment", "aligned"]);
    assert!(
        publish.status.success(),
        "{}",
        String::from_utf8_lossy(&publish.stdout)
    );
    let bytes = std::fs::read(base.join("decision-index.json")).unwrap();
    let index = index::parse_index(&bytes, &Definition).unwrap();
    assert_eq!(
        index.index().entries["261106-draft"].source_path,
        "261106-draft.md"
    );
    assert_eq!(
        std::fs::read_to_string(base.join("draft.md")).unwrap(),
        legacy
    );
    assert!(base.join("261105-draft.md").exists());
}
