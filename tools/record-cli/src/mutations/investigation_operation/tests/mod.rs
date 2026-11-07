use super::*;
use crate::domains::investigation::{Definition, InvestigationState};
use crate::index::{IndexV4, Revision, build_index, serialize_index};
use crate::source_revision::{Domain, fingerprint};
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
fn private_fixture_preflight_and_committed_relation_then_unchanged() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    let text = "---\ntitle: \"Example title\"\nid: \"260828-same\"\nformedAt: \"2026-08-28T12:00:00+00:00\"\nquestion: \"Example question?\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\nBody unchanged.\n";
    let hash = fingerprint(Domain::Investigation, "260828-same", "same.md", text);
    let other_hash = format!("sha256:{}", "a".repeat(64));
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: other_hash.clone(),
                entries: BTreeMap::from([
                    ("260828-same".into(), hash),
                    ("260827-old".into(), other_hash),
                ]),
            },
            entries: BTreeMap::from([
                ("260828-same".into(), state("same", "2026-08-28")),
                ("260827-old".into(), state("old", "2026-08-27")),
            ]),
        },
        &Definition,
    )
    .unwrap();
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("same.md"), text).unwrap();
    std::fs::write(collection.join("investigation-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = SetRelationsOperation {
        collection: RelativePath::new("investigations").unwrap(),
        index_path: RelativePath::new("investigations/investigation-index.json").unwrap(),
        groups: vec![RelationGroup {
            source: "same".into(),
            relations: vec![Relation {
                kind: InvestigationRelationKind::Supplement,
                target: "old".into(),
                summary: None,
            }],
        }],
    };
    let preview = crate::transaction::preflight(&root, &mut operation).unwrap();
    assert_eq!(preview.writes.len(), 2);
    assert_eq!(
        std::fs::read(collection.join("same.md")).unwrap(),
        text.as_bytes()
    );
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.changed && result.committed);
    let written = std::fs::read_to_string(collection.join("same.md")).unwrap();
    assert!(written.contains("260827-old"));
    assert!(written.contains("Body unchanged."));
    let written_index = crate::index::parse_index(
        &std::fs::read(collection.join("investigation-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        written_index.index().entries["260828-same"].relations[0].target,
        "260827-old"
    );
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!result.changed && !result.committed);
}
