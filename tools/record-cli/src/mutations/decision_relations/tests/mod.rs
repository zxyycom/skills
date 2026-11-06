use super::*;
use crate::index::serialize_index;
fn text(id: &str, status: &str) -> String {
    format!(
        "---\ntitle: Example title\nid: {id}\nstatus: {status}\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n"
    )
}
struct FailBeforeIndex(DecisionRelationsOperation);
impl TransactionOperation<PreparedRelations> for FailBeforeIndex {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedRelations>, TxError> {
        self.0.prepare(root)
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if index == 1 {
            Err(fail("injected", "before index"))
        } else {
            Ok(())
        }
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedRelations>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedRelations>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedRelations>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
#[test]
fn private_set_relations_preserves_unselected_source_scope_and_reports_review() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir_all(collection.join("archive")).unwrap();
    let a = text("250102-a", "archived");
    let b = text("250102-b", "active");
    let index = crate::mutations::tests::decision_fixture::two_record_index(&a, &b);

    // The unselected predecessor is deliberately absent. Its published state
    // supplies the relation fact; this operation must not read its body.
    std::fs::write(collection.join("b.md"), &b).unwrap();
    let baseline = serialize_index(&index, &domains::decision::Definition).unwrap();
    std::fs::write(collection.join("decision-index.json"), &baseline).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    let mut operation = DecisionRelationsOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        groups: vec![RelationGroup {
            source: "b".into(),
            relations: vec![Relation {
                kind: DecisionRelationKind::Revision,
                target: "a".into(),
                summary: Some(" reason ".into()),
            }],
        }],
    };
    let preview = crate::transaction::preflight(&root, &mut operation).unwrap();
    assert_eq!(preview.value.review[0].action, ReviewAction::Replace);
    assert_eq!(
        preview.value.review[0].after[0].summary.as_deref(),
        Some("reason")
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        baseline
    );
    let mut failing = FailBeforeIndex(operation);
    let failure = crate::transaction::run_transaction(&root, &lock, &mut failing);
    assert!(!failure.errors.is_empty());
    assert!(!failure.committed);
    assert_eq!(
        failure.outcome,
        crate::transaction::RecoveryStatus::RolledBack
    );
    assert_eq!(
        std::fs::read(collection.join("b.md")).unwrap(),
        b.as_bytes()
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        baseline
    );
    let mut operation = failing.0;
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
    assert_eq!(
        result.verification,
        crate::transaction::VerificationStatus::Passed
    );
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!result.changed && !result.committed);
}
