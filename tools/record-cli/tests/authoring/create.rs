use super::*;

#[test]
fn creation_is_atomic_and_does_not_overwrite_existing_candidate() {
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir(fixture.path().join("records")).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let collection = RelativePath::new("records").unwrap();
    let lock = RelativePath::new(".decision.lock").unwrap();
    let mut op = NewOperation::at(
        collection.clone(),
        "example".into(),
        decision(),
        "2026-11-06T12:00:00Z".into(),
    )
    .unwrap();
    let first = run_transaction(&root, &lock, &mut op);
    assert_eq!(first.status, TxStatus::Ok, "{:?}", first.errors);
    assert!(first.committed);
    let candidate = fixture.path().join("records/261106-example.md");
    let original = std::fs::read(&candidate).unwrap();
    assert!(
        std::str::from_utf8(&original)
            .unwrap()
            .contains("status: candidate")
    );
    let second = run_transaction(&root, &lock, &mut op);
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
    let result = run_transaction(
        &root,
        &RelativePath::new(".investigation.lock").unwrap(),
        &mut op,
    );
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
    let result = run_transaction(
        &root,
        &RelativePath::new(".investigation.lock").unwrap(),
        &mut op,
    );
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
    let first = run_transaction(
        &root,
        &RelativePath::new(".decision.lock").unwrap(),
        &mut dr,
    );
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
    let second = run_transaction(
        &root,
        &RelativePath::new(".investigation.lock").unwrap(),
        &mut ir,
    );
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
    let result = run_transaction(
        &root,
        &RelativePath::new(".decision.lock").unwrap(),
        &mut operation,
    );
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed);
    assert!(!fixture.path().join("decisions").exists());
}
