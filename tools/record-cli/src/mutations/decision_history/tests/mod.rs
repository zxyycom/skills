use super::*;
fn git(root: &Path, args: &[&str]) {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}
#[test]
fn not_git_unborn_and_missing_index_with_head_sources_are_distinct() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let rel = RelativePath::new("decisions").unwrap();
    let selected = BTreeMap::from([("250102-one".into(), "one.md".into())]);
    let outside = capture_history(&root, &rel, &selected).unwrap();
    assert_eq!(outside.facts["250102-one"], HistoryFact::NotApplicable);
    git(dir.path(), &["init", "-q"]);
    let unborn = capture_history(&root, &rel, &selected).unwrap();
    assert_eq!(unborn.facts["250102-one"], HistoryFact::Unrecorded);
    std::fs::write(collection.join("one.md"), "---\nid: 250102-one\n---\n").unwrap();
    git(dir.path(), &["add", "decisions/one.md"]);
    git(
        dir.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "fixture",
        ],
    );
    assert!(matches!(
        capture_history(&root, &rel, &selected),
        Err(HistoryError::MissingIndexWithSources)
    ));
    use crate::domains::decision::{DecisionState, Definition};
    use crate::index::{IndexV4, Revision, build_index, serialize_index};
    let digest = format!("sha256:{}", "a".repeat(64));
    let state = DecisionState {
        name: "one".into(),
        source_path: "one.md".into(),
        title: "Example title".into(),
        status: "active".into(),
        alignment: "aligned".into(),
        created_at: "2025-01-02T00:00:00Z".into(),
        purpose: "Some purpose".into(),
        background: "Some background".into(),
        decision: "Some decision".into(),
        tags: vec!["tag".into()],
        relations: vec![],
    };
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: digest.clone(),
                entries: BTreeMap::from([("250102-one".into(), digest)]),
            },
            entries: BTreeMap::from([("250102-one".into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(
        collection.join("decision-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    git(dir.path(), &["add", "decisions/decision-index.json"]);
    git(
        dir.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "index",
        ],
    );
    let history = capture_history(&root, &rel, &selected).unwrap();
    assert_eq!(history.facts["250102-one"], HistoryFact::Recorded);
    let reused_name = BTreeMap::from([("250103-one".into(), "one.md".into())]);
    let history = capture_history(&root, &rel, &reused_name).unwrap();
    assert_eq!(history.facts["250103-one"], HistoryFact::Unrecorded);
}
