use super::*;

#[test]
fn decision_candidate_rename_and_discard_keep_published_index() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    std::fs::copy(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/identity/decisions/draft.md"),
        base.join("draft.md"),
    )
    .unwrap();
    let before = std::fs::read(base.join("decision-index.json")).unwrap();
    let mut op = operation(Action::Rename {
        target: "renamed".into(),
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    op.action = Action::Rename {
        target: "original".into(),
        confirm_recorded: false,
    };
    let collision = transaction::preflight(&root, &mut op).unwrap_err();
    assert_eq!(
        collision.diagnostics[0].target.as_deref(),
        Some("261106-original")
    );
    assert!(
        collision.diagnostics[0]
            .recovery
            .as_deref()
            .unwrap()
            .contains("unused")
    );
    op.action = Action::Rename {
        target: "renamed".into(),
        confirm_recorded: false,
    };
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(!base.join("draft.md").exists());
    assert!(base.join("renamed.md").exists());
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        before
    );
    op.selector = "renamed".into();
    op.action = Action::Discard {
        confirm_recorded: false,
    };
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(!base.join("renamed.md").exists());
    assert_eq!(
        std::fs::read(base.join("decision-index.json")).unwrap(),
        before
    );
}
#[test]
fn decision_recorded_candidate_rename_requires_confirmation() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let candidate = "---\ntitle: Candidate title\nid: 261106-draft\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\n\n## 背景\n\n## 决策\n";
    std::fs::copy(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/identity/decisions/draft.md"),
        base.join("draft.md"),
    )
    .unwrap();
    commit_fixture(dir.path());
    let mut op = operation(Action::Rename {
        target: "new-draft".into(),
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    let out = transaction::run_transaction(&root, &mut op);
    assert!(!out.errors.is_empty());
    assert!(!out.changed);
    assert_eq!(out.errors[0].target.as_deref(), Some("261106-draft"));
    assert!(
        out.errors[0]
            .recovery
            .as_deref()
            .unwrap()
            .contains("--rename-recorded-decision")
    );
    assert_eq!(
        std::fs::read(base.join("draft.md")).unwrap(),
        candidate.as_bytes()
    );
    op.action = Action::Rename {
        target: "new-draft".into(),
        confirm_recorded: true,
    };
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(!base.join("draft.md").exists());
    assert!(base.join("new-draft.md").exists());
}
#[test]
fn decision_candidate_noop_checks_identity_without_normalizing_bad_body() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    let candidate=b"---\ntitle: Candidate\nid: 261106-draft\nstatus: candidate\n---\n\nunfinished arbitrary body\n";
    std::fs::write(base.join("draft.md"), candidate).unwrap();
    let mut op = operation(Action::Rename {
        target: "draft".into(),
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(!out.changed && !out.committed);
    assert_eq!(std::fs::read(base.join("draft.md")).unwrap(), candidate);
}
#[test]
fn decision_candidate_only_collection_does_not_create_an_index() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().join("decisions");
    std::fs::create_dir(&base).unwrap();
    let candidate = "---\ntitle: Candidate title\nid: 261106-draft\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\n\n## 背景\n\n## 决策\n";
    std::fs::write(base.join("draft.md"), candidate).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = operation(Action::Rename {
        target: "renamed".into(),
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(base.join("renamed.md").exists());
    assert!(!base.join("decision-index.json").exists());
    op.selector = "renamed".into();
    op.action = Action::Discard {
        confirm_recorded: false,
    };
    let discarded = transaction::run_transaction(&root, &mut op);
    assert!(
        discarded.committed && discarded.errors.is_empty(),
        "{:?}",
        discarded.errors
    );
    assert!(!base.join("renamed.md").exists());
    assert!(!base.join("decision-index.json").exists());
}
#[test]
fn decision_candidate_reusing_historical_formal_id_requires_confirmation() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    commit_fixture(dir.path());
    std::fs::remove_file(base.join("original.md")).unwrap();
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
    std::fs::write(
        base.join("decision-index.json"),
        index::serialize_index(&empty, &Definition).unwrap(),
    )
    .unwrap();
    let candidate = "---\ntitle: Candidate title\nid: 261106-original\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\n\n## 背景\n\n## 决策\n";
    std::fs::write(base.join("draft.md"), candidate).unwrap();
    let mut op = operation(Action::Discard {
        confirm_recorded: false,
    });
    op.selector = "261106-original".into();
    let out = transaction::run_transaction(&root, &mut op);
    assert!(!out.errors.is_empty());
    assert!(!out.changed);
    assert_eq!(
        std::fs::read(base.join("draft.md")).unwrap(),
        candidate.as_bytes()
    );
    op.action = Action::Discard {
        confirm_recorded: true,
    };
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
}
#[test]
fn decision_legacy_candidate_same_path_identity_update_commits() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().join("decisions");
    std::fs::create_dir(&base).unwrap();
    let candidate = "---\ntitle: Candidate title\nid: draft\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\n\n## 背景\n\n## 决策\n";
    std::fs::write(base.join("draft.md"), candidate).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = operation(Action::Rename {
        target: "261106-draft".into(),
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    let out = transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.changed && out.committed);
    let after = std::fs::read_to_string(base.join("draft.md")).unwrap();
    assert!(after.contains("261106-draft"));
    assert!(!base.join("decision-index.json").exists());
}
#[test]
fn decision_missing_index_with_formal_source_rejects_candidate_mutation() {
    let (dir, root) = fixture();
    let base = dir.path().join("decisions");
    std::fs::remove_file(base.join("decision-index.json")).unwrap();
    let candidate =
        b"---\ntitle: Candidate\nid: 261106-draft\nstatus: candidate\n---\n\nunfinished\n";
    std::fs::write(base.join("draft.md"), candidate).unwrap();
    let mut op = operation(Action::Rename {
        target: "draft".into(),
        confirm_recorded: false,
    });
    op.selector = "draft".into();
    let out = transaction::run_transaction(&root, &mut op);
    assert!(!out.errors.is_empty());
    assert!(!out.changed);
    assert_eq!(std::fs::read(base.join("draft.md")).unwrap(), candidate);
    assert!(!base.join("decision-index.json").exists());
}
