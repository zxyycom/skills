use super::*;
use crate::mutations::decision::lifecycle::rules::{EstablishedLifecycle, LifecycleEdit};
#[test]
fn archive_preparation_produces_selected_source_and_full_validated_index() {
    let id = "250102-one";
    let (text, index) = crate::mutations::tests::decision_fixture::sample(false);
    let before = EstablishedLifecycle {
        status: Status::Active,
        alignment: Alignment::Unaligned,
    };
    let edit = LifecycleEdit {
        id: id.into(),
        source_path: "one.md".into(),
        target_path: "archive/one.md".into(),
        created_at: "2025-01-02T00:00:00Z".into(),
        before,
        after: EstablishedLifecycle {
            status: Status::Archived,
            alignment: Alignment::Unaligned,
        },
    };
    let sources = HashMap::from([(id.into(), text.as_bytes().to_vec())]);
    let prepared = prepare_lifecycle(
        &index,
        std::slice::from_ref(&edit),
        &sources,
        &HashSet::new(),
    )
    .unwrap();
    assert_eq!(prepared.moves[0].new_path, "archive/one.md");
    assert!(String::from_utf8_lossy(&prepared.moves[0].after).contains("Body remains."));
    assert_eq!(prepared.index.index().entries[id].status, "archived");
    assert_eq!(prepared.index.index().entries[id].alignment, "unaligned");
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir_all(collection.join("archive")).unwrap();
    std::fs::write(collection.join("one.md"), text).unwrap();
    let baseline_bytes = crate::index::serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("decision-index.json"), &baseline_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let collection_path = crate::source::RelativePath::new("decisions").unwrap();
    let index_path = crate::source::RelativePath::new("decisions/decision-index.json").unwrap();
    let plan = capture_plan(
        &root,
        &collection_path,
        &index_path,
        crate::source::capture(&root, &index_path).unwrap(),
        &[edit],
    )
    .unwrap();
    assert_eq!(plan.writes.len(), 3);
    assert_eq!(
        plan.writes[0].path.as_path(),
        std::path::Path::new("decisions/archive/one.md")
    );
    assert_eq!(
        plan.writes[1].path.as_path(),
        std::path::Path::new("decisions/one.md")
    );
    assert!(matches!(
        plan.commit_point,
        crate::transaction::CommitPoint::PublishedIndex(_)
    ));
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        baseline_bytes
    );
    assert!(!collection.join("archive/one.md").exists());
}
