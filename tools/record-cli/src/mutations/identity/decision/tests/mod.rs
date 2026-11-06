use super::*;
use crate::index::{IndexV4, Revision};
struct FailBeforeOldRemoval(DecisionIdentityOperation);
impl TransactionOperation<PreparedIdentity> for FailBeforeOldRemoval {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.0.prepare(root)
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if index == 1 {
            Err(fail("injected", "before old source removal"))
        } else {
            Ok(())
        }
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedIdentity>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
struct FailPostverify(DecisionIdentityOperation);
impl TransactionOperation<PreparedIdentity> for FailPostverify {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, _: &Root, _: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        Err(fail("injected", "postverify"))
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedIdentity>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
#[test]
fn failure_after_new_source_restores_old_and_index() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let id = "261106-old";
    let text = "---\ntitle: Example\nid: 261106-old\nstatus: active\nalignment: unaligned\ncreatedAt: 2026-11-06T12:00:00Z\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\nPurpose.\n\n## 背景\nBackground.\n\n## 决策\n- 采用：Decision.\n";
    let state = decision::parse_established(text.as_bytes(), id, "old.md")
        .unwrap()
        .state;
    let index = crate::index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::from([(
                    id.into(),
                    source_revision::fingerprint(Domain::Decision, id, "old.md", text),
                )]),
            },
            entries: BTreeMap::from([(id.into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    let index_bytes = crate::index::serialize_index(&index, &Definition).unwrap();
    std::fs::write(c.join("old.md"), text).unwrap();
    std::fs::write(c.join("decision-index.json"), &index_bytes).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = FailBeforeOldRemoval(DecisionIdentityOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: id.into(),
        action: Action::Rename {
            target: "new".into(),
            confirm_recorded: false,
        },
    });
    let out = crate::transaction::run_transaction(
        &root,
        &RelativePath::new(".identity.lock").unwrap(),
        &mut op,
    );
    assert!(!out.errors.is_empty());
    assert!(!out.committed);
    assert_eq!(out.outcome, crate::transaction::RecoveryStatus::RolledBack);
    assert_eq!(std::fs::read(c.join("old.md")).unwrap(), text.as_bytes());
    assert!(!c.join("new.md").exists());
    assert_eq!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        index_bytes
    );
    let mut op = FailPostverify(op.0);
    let out = crate::transaction::run_transaction(
        &root,
        &RelativePath::new(".identity.lock").unwrap(),
        &mut op,
    );
    assert!(!out.errors.is_empty());
    assert!(out.committed && out.changed);
    assert_eq!(
        out.outcome,
        crate::transaction::RecoveryStatus::PartialOrUnknown
    );
    assert!(!c.join("old.md").exists());
    assert!(c.join("new.md").exists());
    assert_ne!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        index_bytes
    );
}
