use super::*;

#[test]
fn decision_new_identity_uses_utc_calendar_day() {
    for (timestamp, expected) in [
        ("2025-01-01T00:30:00+02:00", "241231-example"),
        ("2024-03-01T00:30:00+02:00", "240229-example"),
        ("2023-03-01T00:30:00+02:00", "230228-example"),
        ("1999-12-31T23:30:00-02:00", "000101-example"),
        ("2024-02-29T23:30:00-02:00", "240301-example"),
    ] {
        let operation = NewOperation::at(
            RelativePath::new("decisions").unwrap(),
            "example".into(),
            decision(),
            timestamp.into(),
        )
        .unwrap();
        assert_eq!(operation.id, expected, "{timestamp}");
    }
}

#[test]
fn creation_does_not_overwrite_existing_candidate() {
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir(fixture.path().join("records")).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let collection = RelativePath::new("records").unwrap();
    let mut op = NewOperation::at(
        collection.clone(),
        "example".into(),
        decision(),
        "2026-11-06T12:00:00Z".into(),
    )
    .unwrap();
    let first = run_transaction(&root, &mut op);
    assert_eq!(first.status, TxStatus::Ok, "{:?}", first.errors);
    assert!(first.committed);
    let candidate = fixture.path().join("records/261106-example.md");
    let original = std::fs::read(&candidate).unwrap();
    assert!(
        std::str::from_utf8(&original)
            .unwrap()
            .contains("status: candidate")
    );
    let second = run_transaction(&root, &mut op);
    assert_eq!(second.status, TxStatus::Error);
    assert!(!second.committed);
    assert_eq!(std::fs::read(candidate).unwrap(), original);
}
fn investigation_example() -> NewOperation {
    NewOperation::at(
        RelativePath::new("reports").unwrap(),
        "example".into(),
        NewInput::Investigation {
            title: "Investigation title".into(),
            question: "A real question?".into(),
            tags: vec!["test".into()],
            relations: vec![],
            formed_at: None,
        },
        "2026-11-06T12:00:00Z".into(),
    )
    .unwrap()
}

#[test]
fn investigation_unready_scaffold_is_still_created() {
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir(fixture.path().join("reports")).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = investigation_example();
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    let value = result.value.unwrap();
    assert!(value.scaffold_valid);
    assert!(!value.body_ready);
    assert_eq!(value.resource_ready, Some(true));
    assert!(
        fixture
            .path()
            .join("reports/_candidate.261106-example")
            .is_file()
    );
}

#[test]
fn investigation_cli_relation_summary_counts_unicode_code_points() {
    use std::process::Command;
    let root = tempfile::tempdir().unwrap();
    let run = |args: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_investigation-report"))
            .args(args)
            .args(["--root", root.path().to_str().unwrap(), "--json"])
            .output()
            .unwrap()
    };
    let target = run(&[
        "new",
        "target",
        "--title",
        "Target",
        "--question",
        "Question",
        "--tag",
        "test",
        "--formed-at",
        "2026-11-06T12:00:00Z",
    ]);
    assert!(
        target.status.success(),
        "{}",
        String::from_utf8_lossy(&target.stderr)
    );
    let forty = "😀".repeat(40);
    let relation = format!("target=  {forty}  ");
    let result = run(&[
        "new",
        "source",
        "--title",
        "Source",
        "--question",
        "Question",
        "--tag",
        "test",
        "--formed-at",
        "2026-11-07T12:00:00Z",
        "--relation",
        "补充=target",
        "--relation-summary",
        &relation,
    ]);
    assert!(
        result.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    let text = std::fs::read_to_string(
        root.path()
            .join("docs/investigations/_candidate.261107-source"),
    )
    .unwrap();
    assert!(text.contains(&format!("summary: \"{forty}\"")));
    let too_long = format!("target={}", "😀".repeat(41));
    let rejected = run(&[
        "new",
        "long",
        "--title",
        "Long",
        "--question",
        "Question",
        "--tag",
        "test",
        "--formed-at",
        "2026-11-07T12:00:00Z",
        "--relation",
        "补充=target",
        "--relation-summary",
        &too_long,
    ]);
    assert!(!rejected.status.success());
    let response: serde_json::Value = serde_json::from_slice(&rejected.stdout).unwrap();
    assert_eq!(response["ok"], false);
    assert!(
        !root
            .path()
            .join("docs/investigations/_candidate.261107-long")
            .exists()
    );
}
#[test]
fn new_investigation_reports_preexisting_unreferenced_owner_resources() {
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(fixture.path().join("reports/_resources/261106-example")).unwrap();
    std::fs::write(
        fixture
            .path()
            .join("reports/_resources/261106-example/evidence.txt"),
        b"evidence",
    )
    .unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = investigation_example();
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert_eq!(result.value.unwrap().resource_ready, Some(false));
    assert_eq!(
        std::fs::read(
            fixture
                .path()
                .join("reports/_resources/261106-example/evidence.txt")
        )
        .unwrap(),
        b"evidence"
    );
}
#[test]
fn first_collection_is_created_with_its_candidate_in_both_domains() {
    let fixture = tempfile::tempdir().unwrap();
    let root = open_root(fixture.path()).unwrap();
    let timestamp = "2026-11-06T12:00:00Z";
    let mut dr = NewOperation::at(
        RelativePath::new("decisions").unwrap(),
        "example".into(),
        decision(),
        timestamp.into(),
    )
    .unwrap();
    let first = run_transaction(&root, &mut dr);
    assert_eq!(first.status, TxStatus::Ok, "{:?}", first.errors);
    assert!(first.committed);
    assert!(fixture.path().join("decisions/261106-example.md").is_file());
    let mut ir = NewOperation::at(
        RelativePath::new("reports").unwrap(),
        "example".into(),
        NewInput::Investigation {
            title: "Investigation title".into(),
            question: "A real question?".into(),
            tags: vec!["test".into()],
            relations: vec![],
            formed_at: None,
        },
        timestamp.into(),
    )
    .unwrap();
    let second = run_transaction(&root, &mut ir);
    assert_eq!(second.status, TxStatus::Ok, "{:?}", second.errors);
    assert!(second.committed);
    assert!(
        fixture
            .path()
            .join("reports/_candidate.261106-example")
            .is_file()
    );
}
#[test]
fn invalid_candidate_input_never_creates_candidate_or_collection() {
    let fixture = tempfile::tempdir().unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut invalid = decision();
    if let NewInput::Decision { title, .. } = &mut invalid {
        *title = "x".into();
    }
    let mut operation = NewOperation::at(
        RelativePath::new("decisions").unwrap(),
        "bad".into(),
        invalid,
        "2026-11-06T12:00:00Z".into(),
    )
    .unwrap();
    let result = run_transaction(&root, &mut operation);
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed);
    assert!(!fixture.path().join("decisions").exists());
}

#[test]
fn decision_cli_new_summary_trims_before_single_line_and_length_validation() {
    use std::process::Command;
    let root = tempfile::tempdir().unwrap();
    let run = |name: &str, extra: &[&str]| {
        let mut command = Command::new(env!("CARGO_BIN_EXE_decision-records"));
        command.args([
            "new",
            name,
            "--title",
            "Title",
            "--purpose",
            "Purpose",
            "--background",
            "Background",
            "--decision",
            "Decision",
            "--tag",
            "test",
        ]);
        command
            .args(extra)
            .args(["--root", root.path().to_str().unwrap(), "--json"])
            .output()
            .unwrap()
    };
    assert!(run("target", &[]).status.success());
    let forty = "😀".repeat(40);
    let cases = [
        ("empty", "target=\n  ".to_owned(), true),
        ("trimmed", format!("target=\n {forty} \n"), true),
        ("multi", "target=one\ntwo".into(), false),
        ("long", format!("target={}", "😀".repeat(41)), false),
    ];
    for (name, summary, expected) in cases {
        let result = run(
            name,
            &["--relation", "修订=target", "--relation-summary", &summary],
        );
        assert_eq!(
            result.status.success(),
            expected,
            "{}",
            String::from_utf8_lossy(&result.stdout)
        );
        if expected {
            let mut files = std::fs::read_dir(root.path().join("docs/decisions"))
                .unwrap()
                .map(|e| e.unwrap().path())
                .filter(|p| {
                    p.file_stem()
                        .is_some_and(|stem| stem.to_string_lossy().ends_with(name))
                });
            let body = std::fs::read_to_string(files.next().unwrap()).unwrap();
            if name == "empty" {
                assert!(!body.contains("summary:"));
            } else {
                let yaml = body.split("---").nth(1).unwrap();
                let parsed = yaml_rust2::YamlLoader::load_from_str(yaml).unwrap();
                assert_eq!(
                    parsed[0]["relations"][0]["summary"].as_str(),
                    Some(forty.as_str())
                );
            }
        }
    }
}

#[test]
fn decision_creation_rejects_wrong_date_and_preserves_different_dated_legacy_name() {
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir(fixture.path().join("records")).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let collection = RelativePath::new("records").unwrap();
    let mut legacy = NewOperation::at(
        collection.clone(),
        "same".into(),
        decision(),
        "2025-11-06T00:00:00Z".into(),
    )
    .unwrap();
    assert_eq!(run_transaction(&root, &mut legacy).status, TxStatus::Ok);
    let old = fixture.path().join("records/251106-same.md");
    let before = std::fs::read(&old).unwrap();
    let rejected = NewOperation::at(
        collection.clone(),
        "251106-other".into(),
        decision(),
        "2026-11-06T00:00:00Z".into(),
    );
    assert!(matches!(rejected, Err(error) if error.code == "date-mismatch"));
    assert_eq!(std::fs::read(&old).unwrap(), before);
    assert_eq!(
        std::fs::read_dir(fixture.path().join("records"))
            .unwrap()
            .count(),
        1
    );
    let mut next = NewOperation::at(
        collection,
        "same".into(),
        decision(),
        "2026-11-06T00:00:00Z".into(),
    )
    .unwrap();
    assert_eq!(run_transaction(&root, &mut next).status, TxStatus::Ok);
    assert_eq!(std::fs::read(old).unwrap(), before);
    assert!(fixture.path().join("records/261106-same.md").exists());
}
