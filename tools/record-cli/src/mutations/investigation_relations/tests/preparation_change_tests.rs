use super::*;
use crate::domains::investigation::{Definition, InvestigationState};
use crate::index::{IndexV4, Revision, build_index};
use std::collections::BTreeMap;

fn state(name: &str, date: &str) -> InvestigationState {
    InvestigationState {
        formed_at: format!("{date}T12:00:00+00:00"),
        name: name.into(),
        question: "Example question?".into(),
        relations: vec![],
        resource_ids: vec![],
        source_path: format!("{name}.md"),
        tags: vec!["tag".into()],
        title: "Example title".into(),
    }
}
#[test]
fn selected_relation_is_written_into_domain_validated_index_without_reading_unselected_source() {
    let text = "---\ntitle: \"Example title\"\nid: \"260828-same\"\nformedAt: \"2026-08-28T12:00:00+00:00\"\nquestion: \"Example question?\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\nBody unchanged.\n";
    let hash = crate::source_revision::fingerprint(
        crate::source_revision::Domain::Investigation,
        "260828-same",
        "same.md",
        text,
    );
    let other_hash = format!("sha256:{}", "a".repeat(64));
    let index = IndexV4 {
        schema_version: 4,
        namespace: "investigations".into(),
        definition_version: 11,
        metadata: serde_json::json!({}),
        source_revision: Revision {
            metadata: other_hash.clone(),
            entries: BTreeMap::from([
                ("260828-same".into(), hash),
                ("260827-old".into(), other_hash.clone()),
            ]),
        },
        entries: BTreeMap::from([
            ("260828-same".into(), state("same", "2026-08-28")),
            ("260827-old".into(), state("old", "2026-08-27")),
        ]),
    };
    let baseline = build_index(index, &Definition).unwrap();
    let review = vec![SourceReview {
        source_id: "260828-same".into(),
        action: ReviewAction::Replace,
        before: vec![],
        after: vec![Relation {
            kind: InvestigationRelationKind::Supplement,
            target: "260827-old".into(),
            summary: None,
        }],
    }];
    let sources = HashMap::from([("260828-same".into(), text.as_bytes().to_vec())]);
    let prepared = prepare_replacements(&baseline, &review, &sources).unwrap();
    assert_eq!(prepared.edits.len(), 1);
    assert_eq!(
        prepared.index.index().entries["260828-same"].relations[0].target,
        "260827-old"
    );
    assert_eq!(
        prepared.index.index().source_revision.entries["260827-old"],
        other_hash
    );
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    std::fs::write(collection.join("same.md"), text).unwrap();
    let baseline_bytes = crate::index::serialize_index(&baseline, &Definition).unwrap();
    std::fs::write(collection.join("investigation-index.json"), &baseline_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let collection_path = crate::source::RelativePath::new("investigations").unwrap();
    let index_path =
        crate::source::RelativePath::new("investigations/investigation-index.json").unwrap();
    let plan = capture_plan(&root, &collection_path, &index_path, &review).unwrap();
    assert_eq!(plan.writes.len(), 2);
    assert!(matches!(
        plan.commit_point,
        crate::transaction::CommitPoint::PublishedIndex(_)
    ));
    assert_eq!(
        std::fs::read(collection.join("same.md")).unwrap(),
        text.as_bytes()
    );
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        baseline_bytes
    );
}
