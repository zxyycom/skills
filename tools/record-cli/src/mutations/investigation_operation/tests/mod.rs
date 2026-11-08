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
                summary_selector: Some("260827-old".into()),
                kind: InvestigationRelationKind::Supplement,
                target: "old".into(),
                summary: Some(" reason ".into()),
            }],
        }],
    };
    operation.groups[0].relations[0].summary_selector = Some("260826-old".into());
    assert!(crate::transaction::preflight(&root, &mut operation).is_err());
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        index_bytes
    );
    operation.groups[0].relations[0].summary_selector = Some("260827-old".into());
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
    assert!(written.contains("summary: \"reason\""));
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
    assert_eq!(
        written_index.index().entries["260828-same"].relations[0]
            .summary
            .as_deref(),
        Some("reason")
    );
    let result = crate::transaction::run_transaction(&root, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!result.changed && !result.committed);
}

#[test]
fn selector_failure_precedes_baseline_graph_failure() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("investigations")).unwrap();
    let mut source = state("same", "2026-08-28");
    source.relations.push(crate::domains::Relation {
        relation_type: "补充".into(),
        target: "260827-missing".into(),
        summary: None,
    });
    let hash = format!("sha256:{}", "a".repeat(64));
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: hash.clone(),
                entries: BTreeMap::from([("260828-same".into(), hash)]),
            },
            entries: BTreeMap::from([("260828-same".into(), source)]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(
        dir.path().join("investigations/investigation-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = SetRelationsOperation {
        collection: RelativePath::new("investigations").unwrap(),
        index_path: RelativePath::new("investigations/investigation-index.json").unwrap(),
        groups: vec![RelationGroup {
            source: "absent".into(),
            relations: vec![],
        }],
    };
    assert_eq!(
        operation.prepare_phase(&root).err().unwrap().code,
        "source-selector"
    );
    operation.groups[0].source = "same".into();
    assert_eq!(
        operation.prepare_phase(&root).err().unwrap().code,
        "index-invalid"
    );
}
