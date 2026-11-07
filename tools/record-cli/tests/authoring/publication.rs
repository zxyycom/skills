use super::*;

#[test]
fn publish_batch_closes_relations_without_reading_unselected_body() {
    use record_cli::{
        domains::investigation::Definition,
        index::{IndexV4, Revision, build_index, serialize_index},
        mutations::authoring::investigation_publish::InvestigationPublishOperation,
        source_revision::{Domain, metadata_fingerprint},
        transaction::preflight,
    };
    use std::collections::BTreeMap;
    let fixture = tempfile::tempdir().unwrap();
    // The cross-record warning is a Git history review, not just graph validation.
    let initialized = std::process::Command::new("git")
        .args(["init", "--quiet"])
        .current_dir(fixture.path())
        .status()
        .unwrap();
    assert!(initialized.success());
    let committed = std::process::Command::new("git")
        .args([
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--quiet",
            "--allow-empty",
            "-m",
            "base",
        ])
        .current_dir(fixture.path())
        .status()
        .unwrap();
    assert!(committed.success());
    let directory = fixture.path().join("reports");
    std::fs::create_dir(&directory).unwrap();
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: metadata_fingerprint(Domain::Investigation),
                entries: BTreeMap::new(),
            },
            entries: BTreeMap::new(),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(
        directory.join("investigation-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let report = |id: &str, relations: &str| {
        format!(
            "---\ntitle: \"Report title\"\nid: \"{id}\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"What happened?\"\ntags:\n  - \"test\"\n{relations}\n---\n\n## 形成时背景\n背景说明。\n\n## 调查目的\n目的说明。\n\n## 调查范围与依据\n依据说明。\n\n## 调查结果与边界\n结果说明。\n"
        )
    };
    let first = report(
        "261106-first",
        "relations:\n  - type: \"补充\"\n    target: \"261106-second\"",
    );
    let second = report("261106-second", "relations: []");
    std::fs::write(directory.join("_candidate.261106-first"), first).unwrap();
    std::fs::write(directory.join("_candidate.261106-second"), second).unwrap();
    let mut other = b"---\nid: \"261106-other\"\n---\n".to_vec();
    other.extend([0xff, 0xfe]);
    std::fs::write(directory.join("_candidate.261106-other"), other).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = InvestigationPublishOperation {
        collection: RelativePath::new("reports").unwrap(),
        selectors: vec!["first".into(), "second".into()],
    };
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.ids, vec!["261106-first", "261106-second"]);
    assert!(
        preview
            .value
            .warnings
            .iter()
            .any(|warning| warning.contains("261106-second") && warning.contains("261106-first"))
    );
    assert!(!directory.join("261106-first.md").exists());
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(directory.join("261106-first.md").is_file());
    assert!(directory.join("261106-second.md").is_file());
    assert!(!directory.join("_candidate.261106-first").exists());
    assert!(directory.join("_candidate.261106-other").is_file());
}
#[test]
fn first_publish_keeps_owned_resources_at_final_location() {
    use record_cli::mutations::authoring::investigation_publish::InvestigationPublishOperation;
    let fixture = tempfile::tempdir().unwrap();
    let directory = fixture.path().join("reports");
    std::fs::create_dir_all(directory.join("_resources/261106-report")).unwrap();
    let asset = directory.join("_resources/261106-report/evidence.txt");
    std::fs::write(&asset, b"original asset").unwrap();
    let doc = "---\ntitle: \"Report title\"\nid: \"261106-report\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"What happened?\"\ntags:\n  - \"test\"\nrelations: []\n---\n\n## 形成时背景\n背景。\n\n## 调查目的\n目的。\n\n## 调查范围与依据\n依据。\n\n## 调查结果与边界\n结果。\n\n## 随附资源\n- [evidence](./_resources/261106-report/evidence.txt)\n";
    std::fs::write(directory.join("_candidate.261106-report"), doc).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = InvestigationPublishOperation {
        collection: RelativePath::new("reports").unwrap(),
        selectors: vec!["report".into()],
    };
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(directory.join("investigation-index.json").is_file());
    assert!(directory.join("261106-report.md").is_file());
    assert_eq!(std::fs::read(asset).unwrap(), b"original asset");
}
#[test]
fn unready_publication_and_preflight_are_zero_write() {
    use record_cli::{
        mutations::authoring::investigation_publish::InvestigationPublishOperation,
        transaction::preflight,
    };
    let fixture = tempfile::tempdir().unwrap();
    let root = open_root(fixture.path()).unwrap();
    std::fs::create_dir(fixture.path().join("reports")).unwrap();
    let mut create = NewOperation::at(
        RelativePath::new("reports").unwrap(),
        "unready".into(),
        NewInput::Investigation {
            title: "Investigation title".into(),
            question: "A real question?".into(),
            tags: vec!["test".into()],
            relations: vec![],
            formed_at: None,
        },
        "2026-11-06T12:00:00Z".into(),
    )
    .unwrap();
    assert_eq!(run_transaction(&root, &mut create).status, TxStatus::Ok);
    let candidate = fixture.path().join("reports/_candidate.261106-unready");
    let original = std::fs::read(&candidate).unwrap();
    let mut op = InvestigationPublishOperation {
        collection: RelativePath::new("reports").unwrap(),
        selectors: vec!["unready".into()],
    };
    assert!(preflight(&root, &mut op).is_err());
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed);
    assert!(!result.committed);
    assert_eq!(std::fs::read(candidate).unwrap(), original);
    assert!(
        !fixture
            .path()
            .join("reports/investigation-index.json")
            .exists()
    );
}
#[test]
fn publication_rejects_duplicate_candidate_identity_without_writes() {
    use record_cli::mutations::authoring::investigation_publish::InvestigationPublishOperation;
    let fixture = tempfile::tempdir().unwrap();
    let directory = fixture.path().join("reports");
    std::fs::create_dir(&directory).unwrap();
    let candidate = "---\nid: \"261106-duplicate\"\n---\ncontent\n";
    std::fs::write(directory.join("_candidate.one"), candidate).unwrap();
    std::fs::write(directory.join("_candidate.two"), candidate).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = InvestigationPublishOperation {
        collection: RelativePath::new("reports").unwrap(),
        selectors: vec!["duplicate".into()],
    };
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed && !result.committed);
    assert!(
        result
            .errors
            .iter()
            .any(|error| error.code == "duplicate-id")
    );
    assert_eq!(
        std::fs::read_to_string(directory.join("_candidate.one")).unwrap(),
        candidate
    );
    assert!(!directory.join("investigation-index.json").exists());
}
