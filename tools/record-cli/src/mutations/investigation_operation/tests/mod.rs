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
struct FailBeforeIndex(SetRelationsOperation);
impl TransactionOperation<PreparedReplacement> for FailBeforeIndex {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedReplacement>, TxError> {
        self.0.prepare(root)
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if index == 1 {
            Err(failure("injected", "before index"))
        } else {
            Ok(())
        }
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedReplacement>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedReplacement>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedReplacement>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
struct FailPostverify(SetRelationsOperation);
impl TransactionOperation<PreparedReplacement> for FailPostverify {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedReplacement>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedReplacement>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, _: &Root, _: &Plan<PreparedReplacement>) -> Result<(), TxError> {
        Err(failure("injected", "postverify"))
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedReplacement>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
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
    let lock = RelativePath::new(".investigation-index.json.mutation.lock").unwrap();
    let preview = crate::transaction::preflight(&root, &mut operation).unwrap();
    assert_eq!(preview.writes.len(), 2);
    assert_eq!(
        std::fs::read(collection.join("same.md")).unwrap(),
        text.as_bytes()
    );
    assert!(
        !dir.path()
            .join(".investigation-index.json.mutation.lock")
            .exists()
    );
    std::fs::write(
        dir.path().join(".investigation-index.json.mutation.lock"),
        b"busy",
    )
    .unwrap();
    assert!(crate::transaction::preflight(&root, &mut operation).is_ok());
    let locked = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(!locked.errors.is_empty());
    assert!(!locked.changed);
    std::fs::remove_file(dir.path().join(".investigation-index.json.mutation.lock")).unwrap();
    let mut failing = FailBeforeIndex(operation);
    let failed = crate::transaction::run_transaction(&root, &lock, &mut failing);
    assert!(!failed.errors.is_empty());
    assert!(!failed.committed);
    assert_eq!(
        failed.outcome,
        crate::transaction::RecoveryStatus::RolledBack
    );
    assert_eq!(
        std::fs::read(collection.join("same.md")).unwrap(),
        text.as_bytes()
    );
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        index_bytes
    );
    let mut operation = failing.0;
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.cleanup_errors.is_empty());
    assert!(result.changed && result.committed);
    assert_eq!(
        result.verification,
        crate::transaction::VerificationStatus::Passed
    );
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!result.changed && !result.committed);
    assert_eq!(
        result.verification,
        crate::transaction::VerificationStatus::Passed
    );
    operation.groups[0].relations.clear();
    let mut failing = FailPostverify(operation);
    let failed = crate::transaction::run_transaction(&root, &lock, &mut failing);
    assert!(!failed.errors.is_empty());
    assert!(failed.changed && failed.committed);
    assert_eq!(
        failed.outcome,
        crate::transaction::RecoveryStatus::PartialOrUnknown
    );
    assert_eq!(
        failed.verification,
        crate::transaction::VerificationStatus::FailedOrUnknown
    );
    let text_after = std::fs::read_to_string(collection.join("same.md")).unwrap();
    assert!(text_after.contains("relations: []"));
}
