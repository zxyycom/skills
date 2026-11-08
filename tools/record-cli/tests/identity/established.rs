use super::*;

#[test]
fn decision_formal_rename_noop_date_and_discard() {
    let (dir, root) = fixture();
    let original = std::fs::read(dir.path().join("decisions/original.md")).unwrap();
    let mut no_op = operation(Action::Rename {
        target: "original".into(),
        confirm_recorded: false,
    });
    let result = transaction::run_transaction(&root, &mut no_op);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!result.changed && !result.committed);
    assert_eq!(
        std::fs::read(dir.path().join("decisions/original.md")).unwrap(),
        original
    );
    let mut bad = operation(Action::Rename {
        target: "261107-new".into(),
        confirm_recorded: false,
    });
    assert!(transaction::preflight(&root, &mut bad).is_err());
    let mut rename = operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: false,
    });
    let result = transaction::run_transaction(&root, &mut rename);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.changed && result.committed);
    assert!(!dir.path().join("decisions/original.md").exists());
    let renamed = std::fs::read_to_string(dir.path().join("decisions/new.md")).unwrap();
    assert!(renamed.contains("261106-new"));
    assert!(renamed.contains("title: Example # retained comment"));
    let mut discard = operation(Action::Discard {
        confirm_recorded: false,
    });
    discard.selector = "new".into();
    let result = transaction::run_transaction(&root, &mut discard);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.changed && result.committed);
    assert!(!dir.path().join("decisions/new.md").exists());
    let bytes = std::fs::read(dir.path().join("decisions/decision-index.json")).unwrap();
    assert!(
        index::parse_index(&bytes, &Definition)
            .unwrap()
            .index()
            .entries
            .is_empty()
    );
    let ready = include_str!("../fixtures/identity/decisions/draft.md").replace(
        "## 目的\n\n## 背景\n\n## 决策",
        "## 目的\nPurpose\n\n## 背景\nBackground\n\n## 决策\n- 采用: Choice",
    );
    std::fs::write(dir.path().join("decisions/draft.md"), ready).unwrap();
    let published = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args([
            "publish",
            "draft",
            "--alignment",
            "aligned",
            "--root",
            dir.path().to_str().unwrap(),
            "--decisions-dir",
            "decisions",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(
        published.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&published.stdout),
        String::from_utf8_lossy(&published.stderr)
    );
    let bytes = std::fs::read(dir.path().join("decisions/decision-index.json")).unwrap();
    assert!(
        index::parse_index(&bytes, &Definition)
            .unwrap()
            .index()
            .entries
            .contains_key("261106-draft")
    );
}

#[test]
fn decision_recorded_requires_confirmation_and_preserves_git_pending() {
    let (dir, root) = fixture();
    commit_fixture(dir.path());
    std::fs::write(dir.path().join("unrelated"), b"pending sentinel").unwrap();
    git(dir.path(), &["add", "unrelated"]);
    let pending_before = std::fs::read(dir.path().join(".git/index")).unwrap();
    let mut operation = operation(Action::Discard {
        confirm_recorded: false,
    });
    let out = transaction::run_transaction(&root, &mut operation);
    assert!(!out.errors.is_empty());
    assert!(!out.changed);
    assert!(dir.path().join("decisions/original.md").exists());
    assert_eq!(
        std::fs::read(dir.path().join(".git/index")).unwrap(),
        pending_before
    );
    operation.action = Action::Discard {
        confirm_recorded: true,
    };
    let out = transaction::run_transaction(&root, &mut operation);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert_eq!(
        std::fs::read(dir.path().join(".git/index")).unwrap(),
        pending_before
    );
}

#[test]
fn decision_rename_rewrites_index_visible_referrer_and_rejects_stale_source() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    std::fs::create_dir(base.join("archive")).unwrap();
    let original = std::fs::read_to_string(base.join("original.md"))
        .unwrap()
        .replace("status: active", "status: archived");
    std::fs::remove_file(base.join("original.md")).unwrap();
    std::fs::write(base.join("archive/original.md"), &original).unwrap();
    let referring = original
        .replace("261106-original", "261107-referrer")
        .replace("status: archived", "status: active")
        .replace("2026-11-06T12:00:00Z", "2026-11-07T12:00:00Z")
        .replace(
            "relations: []",
            "relations:\n  - type: 修订\n    target: 261106-original\n    summary: Reason",
        );
    std::fs::write(base.join("referrer.md"), &referring).unwrap();
    let entries = BTreeMap::from([
        (
            "261106-original".into(),
            decision::parse_established(
                original.as_bytes(),
                "261106-original",
                "archive/original.md",
            )
            .unwrap()
            .state,
        ),
        (
            "261107-referrer".into(),
            decision::parse_established(referring.as_bytes(), "261107-referrer", "referrer.md")
                .unwrap()
                .state,
        ),
    ]);
    let revisions = BTreeMap::from([
        (
            "261106-original".into(),
            source_revision::fingerprint(
                Domain::Decision,
                "261106-original",
                "archive/original.md",
                &original,
            ),
        ),
        (
            "261107-referrer".into(),
            source_revision::fingerprint(
                Domain::Decision,
                "261107-referrer",
                "referrer.md",
                &referring,
            ),
        ),
    ]);
    let baseline = index::build_index(
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
    std::fs::write(
        base.join("decision-index.json"),
        index::serialize_index(&baseline, &Definition).unwrap(),
    )
    .unwrap();
    let mut discard = operation(Action::Discard {
        confirm_recorded: false,
    });
    let blocked = transaction::preflight(&root, &mut discard).unwrap_err();
    assert_eq!(
        blocked.diagnostics[0].target.as_deref(),
        Some("261106-original")
    );
    assert!(
        blocked.diagnostics[0]
            .reason
            .as_deref()
            .unwrap()
            .contains("261107-referrer")
    );
    assert!(
        blocked.diagnostics[0]
            .recovery
            .as_deref()
            .unwrap()
            .contains("relation")
    );
    let mut op = operation(Action::Rename {
        target: "new".into(),
        confirm_recorded: false,
    });
    std::fs::write(base.join("referrer.md"), format!("{referring}\nconcurrent")).unwrap();
    assert!(transaction::preflight(&root, &mut op).is_err());
    assert!(!base.join("archive/new.md").exists());
    std::fs::write(base.join("referrer.md"), &referring).unwrap();
    let preview = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .arg("--root")
        .arg(dir.path())
        .args([
            "--decisions-dir",
            "decisions",
            "rename",
            "original",
            "new",
            "--preflight",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(
        preview.status.success(),
        "{}",
        String::from_utf8_lossy(&preview.stdout)
    );
    let json: serde_json::Value = serde_json::from_slice(&preview.stdout).unwrap();
    assert_eq!(json["result"]["affectedEstablishedRelationCount"], 1);
    assert_eq!(json["result"]["affectedCandidateRelationCount"], 0);
    assert_eq!(
        json["result"]["affectedCountsScope"],
        "selected-and-rewritten"
    );
    let result = transaction::run_transaction(&root, &mut op);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed);
    let impact = &result.value.as_ref().unwrap().impact;
    assert_eq!(impact.established_relations, 1);
    assert_eq!(impact.candidate_relations, 0);
    let actual = std::fs::read_to_string(base.join("referrer.md")).unwrap();
    assert!(actual.contains("261106-new"));
    assert!(actual.contains("title: Example # retained comment"));
    assert!(!actual.contains("261106-original"));
    assert!(base.join("archive/new.md").exists());
}

#[test]
fn decision_history_unavailable_fails_closed_before_any_write() {
    let (dir, _root) = fixture();
    let base = dir.path().join("decisions");
    let before = std::fs::read(base.join("original.md")).unwrap();
    let index_before = std::fs::read(base.join("decision-index.json")).unwrap();
    let out = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .env("PATH", "")
        .arg("--root")
        .arg(dir.path())
        .args([
            "--decisions-dir",
            "decisions",
            "rename",
            "original",
            "renamed",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(!out.status.success());
    assert_eq!(std::fs::read(base.join("original.md")).unwrap(), before);
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        index_before
    );
    assert!(!base.join("renamed.md").exists());
}
