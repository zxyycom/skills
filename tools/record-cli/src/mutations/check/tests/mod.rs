use super::*;
#[test]
fn decision_full_check_rebuilds_source_projection_not_just_index() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let text = "---\ntitle: Example title\nid: 250102-one\nstatus: active\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n";
    std::fs::write(collection.join("one.md"), text).unwrap();
    let parsed =
        domains::decision::parse_established(text.as_bytes(), "250102-one", "one.md").unwrap();
    let id = "250102-one";
    let projection = IndexV4 {
        schema_version: 4,
        namespace: "decisions".into(),
        definition_version: 11,
        metadata: serde_json::json!({}),
        source_revision: Revision {
            metadata: source_revision::metadata_fingerprint(Domain::Decision),
            entries: BTreeMap::from([(
                id.into(),
                source_revision::fingerprint(Domain::Decision, id, "one.md", text),
            )]),
        },
        entries: BTreeMap::from([(id.into(), parsed.state)]),
    };
    let index = crate::index::build_index(projection, &Definition).unwrap();
    std::fs::write(
        collection.join("decision-index.json"),
        crate::index::serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let checked = decision(&root, "decisions", &[]).unwrap();
    assert_eq!(checked.formal_count, 1);
    assert_eq!(checked.index_state, "current");
    std::fs::write(
        collection.join("one.md"),
        format!("{text}\nAdditional body.\n"),
    )
    .unwrap();
    let stale = decision(&root, "decisions", &[]).unwrap_err();
    assert_eq!(stale.code, "index-not-current");
    assert_eq!(stale.diagnostics.len(), 1);
    let partial = stale.partial.unwrap();
    assert_eq!(partial.index_checked, Some(false));
    assert_eq!(partial.summary.unwrap().decision_count, 1);
}
#[test]
fn investigation_full_check_rebuilds_sources_and_reports_unreferenced_resources() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    let text = include_str!(
        "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
    );
    let id = "260828-same";
    std::fs::write(collection.join("same.md"), text).unwrap();
    let parsed = domains::investigation::parse_established(text.as_bytes(), id, "same.md").unwrap();
    let projection = IndexV4 {
        schema_version: 4,
        namespace: "investigations".into(),
        definition_version: 11,
        metadata: serde_json::json!({}),
        source_revision: Revision {
            metadata: source_revision::metadata_fingerprint(Domain::Investigation),
            entries: BTreeMap::from([(
                id.into(),
                source_revision::fingerprint(Domain::Investigation, id, "same.md", text),
            )]),
        },
        entries: BTreeMap::from([(id.into(), parsed.state)]),
    };
    let index = crate::index::build_index(projection, &domains::investigation::Definition).unwrap();
    std::fs::write(
        collection.join("investigation-index.json"),
        crate::index::serialize_index(&index, &domains::investigation::Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &[])
            .unwrap()
            .formal_count,
        1
    );
    std::fs::create_dir(collection.join("_resources")).unwrap();
    let checked = investigation(&root, "investigations", &[]).unwrap();
    assert!(checked.warnings.is_empty());
    std::fs::create_dir(collection.join("_resources/orphan")).unwrap();
    std::fs::write(collection.join("_resources/orphan/file.txt"), b"fixture").unwrap();
    let checked = investigation(&root, "investigations", &[]).unwrap();
    assert!(
        checked
            .warnings
            .iter()
            .any(|warning| warning.contains("orphan/file.txt"))
    );
    let selected = investigation(&root, "investigations", &[id.into()]).unwrap();
    assert_eq!(selected.scope, "selected");
    assert_eq!(selected.index_state, "not-checked");
    std::fs::write(collection.join("unrelated.md"), b"invalid unrelated source").unwrap();
    assert!(investigation(&root, "investigations", &[id.into()]).is_ok());
    assert!(investigation(&root, "investigations", &[]).is_err());
}
#[test]
fn investigation_formal_resource_missing_fails_then_present_passes() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir_all(collection.join("_resources/260828-same")).unwrap();
    let text = format!(
        "{}\n## 随附资源\n- [evidence](./_resources/260828-same/file.txt)\n",
        include_str!(
            "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
        )
    );
    let id = "260828-same";
    std::fs::write(collection.join("same.md"), &text).unwrap();
    let parsed = domains::investigation::parse_established(text.as_bytes(), id, "same.md").unwrap();
    let projection = IndexV4 {
        schema_version: 4,
        namespace: "investigations".into(),
        definition_version: 11,
        metadata: serde_json::json!({}),
        source_revision: Revision {
            metadata: source_revision::metadata_fingerprint(Domain::Investigation),
            entries: BTreeMap::from([(
                id.into(),
                source_revision::fingerprint(Domain::Investigation, id, "same.md", &text),
            )]),
        },
        entries: BTreeMap::from([(id.into(), parsed.state)]),
    };
    let index = crate::index::build_index(projection, &domains::investigation::Definition).unwrap();
    std::fs::write(
        collection.join("investigation-index.json"),
        crate::index::serialize_index(&index, &domains::investigation::Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &[])
            .unwrap_err()
            .code,
        "resource-invalid"
    );
    std::fs::write(
        collection.join("_resources/260828-same/file.txt"),
        b"fixture",
    )
    .unwrap();
    let checked = investigation(&root, "investigations", &[]).unwrap();
    assert_eq!(checked.formal_count, 1);
    assert!(checked.warnings.is_empty());
    let init = std::process::Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(init.success());
    std::fs::write(
        dir.path().join(".gitignore"),
        "investigations/_resources/\n",
    )
    .unwrap();
    assert_eq!(
        investigation(&root, "investigations", &[])
            .unwrap_err()
            .code,
        "resource-invalid"
    );
    let add = std::process::Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args([
            "add",
            "-f",
            "investigations/_resources/260828-same/file.txt",
        ])
        .status()
        .unwrap();
    assert!(add.success());
    assert!(investigation(&root, "investigations", &[]).is_ok());
}
#[test]
fn decision_candidate_only_check_reports_readiness() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let text = "---\ntitle: Example title\nid: 250102-one\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\n## 背景\n\n## 决策\n";
    std::fs::write(collection.join("250102-one.md"), text).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let result = decision(&root, "decisions", &[]).unwrap();
    assert_eq!(result.index_state, "first-candidate-collection");
    assert_eq!(result.candidate_count, 1);
    assert_eq!(result.summary.unwrap().body_ready_candidate_count, 0);
}
#[test]
fn investigation_check_rejects_unpaired_surrogates_in_selected_sources() {
    let dir = tempfile::tempdir().unwrap();
    let reports = dir.path().join("investigations");
    std::fs::create_dir(&reports).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let candidate = "---\ntitle: \"bad \\ud800\"\nid: \"250102-one\"\nformedAt: \"2025-01-02T00:00:00Z\"\nquestion: \"question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n";
    std::fs::write(reports.join("_candidate.250102-one"), candidate).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &[])
            .unwrap_err()
            .code,
        "unsupported-unpaired-surrogate"
    );
    std::fs::remove_file(reports.join("_candidate.250102-one")).unwrap();
    std::fs::write(reports.join("one.md"), candidate).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &[])
            .unwrap_err()
            .code,
        "unsupported-unpaired-surrogate"
    );
    assert_eq!(
        investigation(&root, "investigations", &["250102-one".into()])
            .unwrap_err()
            .code,
        "unsupported-unpaired-surrogate"
    );
}
#[test]
fn independent_bad_sources_are_aggregated_with_partial_coverage() {
    let dir = tempfile::tempdir().unwrap();
    let decisions = dir.path().join("decisions");
    let investigations = dir.path().join("investigations");
    std::fs::create_dir(&decisions).unwrap();
    std::fs::create_dir(&investigations).unwrap();
    for (name, id) in [("a", "250101-a"), ("b", "250101-b")] {
        std::fs::write(
            decisions.join(format!("{name}.md")),
            format!("---\nid: {id}\nstatus: active\n---\ninvalid body\n"),
        )
        .unwrap();
        std::fs::write(
            investigations.join(format!("{name}.md")),
            format!("---\ntitle: \"Example\"\nid: \"{id}\"\n---\ninvalid body\n"),
        )
        .unwrap();
    }
    let root = source::open_root(dir.path()).unwrap();
    let dr = decision(&root, "decisions", &[]).unwrap_err();
    assert_eq!(dr.diagnostics.len(), 2);
    let dr_partial = dr.partial.unwrap();
    assert_eq!(dr_partial.scope, "partial");
    assert_eq!(dr_partial.index_checked, Some(false));
    assert_eq!(dr_partial.errors.len(), 2);
    let ir = investigation(&root, "investigations", &[]).unwrap_err();
    assert_eq!(ir.diagnostics.len(), 2);
    let ir_partial = ir.partial.unwrap();
    assert_eq!(ir_partial.available_report_count, Some(2));
    assert_eq!(ir_partial.index_checked, Some(false));
    assert_eq!(ir_partial.errors.len(), 2);
    let selected = investigation(
        &root,
        "investigations",
        &["250101-a".into(), "250101-b".into()],
    )
    .unwrap_err();
    assert_eq!(selected.diagnostics.len(), 2);
    assert_eq!(selected.partial.unwrap().scope, "selected-partial");
}

#[test]
fn investigation_selected_discovery_limits_decoding_to_identity_headers_and_selected_body() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    let selected = include_str!(
        "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
    );
    let selected_path = collection.join("same.md");
    std::fs::write(&selected_path, selected).unwrap();
    let unrelated = collection.join("other.md");
    std::fs::write(
        &unrelated,
        b"---\ntitle: \"Other\"\nid: \"260828-other\"\n---\n\xff",
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let ids = ["260828-same".into()];
    for index in [None, Some(b"invalid index".as_slice())] {
        if let Some(bytes) = index {
            std::fs::write(collection.join("investigation-index.json"), bytes).unwrap();
        }
        let result = investigation(&root, "investigations", &ids).unwrap();
        assert_eq!(result.scope, "selected");
        assert_eq!(result.index_checked, Some(false));
    }
    std::fs::write(&selected_path, [selected.as_bytes(), b"\xff"].concat()).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &ids)
            .unwrap_err()
            .code,
        "source-encoding"
    );
    std::fs::write(&selected_path, selected).unwrap();
    std::fs::write(&unrelated, selected).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &ids)
            .unwrap_err()
            .code,
        "duplicate-id"
    );
    std::fs::write(&unrelated, b"---\ntitle: \xff\nid: \"260828-other\"\n---\n").unwrap();
    assert_eq!(
        investigation(&root, "investigations", &ids)
            .unwrap_err()
            .code,
        "source-encoding"
    );
    std::fs::remove_file(&unrelated).unwrap();
    std::fs::create_dir(&unrelated).unwrap();
    assert_eq!(
        investigation(&root, "investigations", &ids)
            .unwrap_err()
            .code,
        "member-invalid"
    );
}

#[test]
fn investigation_selected_moved_index_locator_does_not_decode_other_body() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    let text = include_str!(
        "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
    );
    let id = "260828-same";
    let state = domains::investigation::parse_established(text.as_bytes(), id, "old.md")
        .unwrap()
        .state;
    let projection = IndexV4 {
        schema_version: 4,
        namespace: "investigations".into(),
        definition_version: 11,
        metadata: serde_json::json!({}),
        source_revision: Revision {
            metadata: source_revision::metadata_fingerprint(Domain::Investigation),
            entries: BTreeMap::from([(
                id.into(),
                source_revision::fingerprint(Domain::Investigation, id, "old.md", text),
            )]),
        },
        entries: BTreeMap::from([(id.into(), state)]),
    };
    let index = crate::index::build_index(projection, &domains::investigation::Definition).unwrap();
    std::fs::write(
        collection.join("investigation-index.json"),
        crate::index::serialize_index(&index, &domains::investigation::Definition).unwrap(),
    )
    .unwrap();
    std::fs::write(
        collection.join("old.md"),
        b"---\ntitle: \"Other\"\nid: \"260828-other\"\n---\n\xff",
    )
    .unwrap();
    std::fs::write(collection.join("new.md"), text).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let result = investigation(&root, "investigations", &[id.into()]).unwrap();
    assert_eq!(result.scope, "selected");
    assert_eq!(result.index_checked, Some(false));
}
