use super::*;
use crate::transaction::run_transaction;
fn candidate(id: &str, relations: &str) -> String {
    format!(
        "---\ntitle: Example title\nid: {id}\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - test\nrelations: {relations}\n---\n\n## 目的\n\nPurpose.\n\n## 背景\n\nBackground.\n\n## 决策\n\n- 采用：Decision.\n"
    )
}
fn operation(selector: &str) -> DecisionEvolutionOperation {
    DecisionEvolutionOperation {
        collection: RelativePath::new("decisions").unwrap(),
        successors: vec![Successor {
            selector: selector.into(),
            alignment: Alignment::Unaligned,
        }],
        relations: DecisionRelationOverride::Preserve,
        discard: None,
        delete_recorded: false,
        keep_unrecorded_history: false,
        publish_only: true,
        timestamp: "2026-11-06T12:00:00Z".into(),
    }
}
struct FailBeforeIndex(DecisionEvolutionOperation);
impl
    crate::transaction::TransactionOperation<
        crate::mutations::authoring::decision::PreparedEvolution,
    > for FailBeforeIndex
{
    fn prepare(
        &mut self,
        r: &crate::source::Root,
    ) -> Result<
        crate::transaction::Plan<crate::mutations::authoring::decision::PreparedEvolution>,
        crate::transaction::TxError,
    > {
        self.0.prepare(r)
    }
    fn fresh(
        &mut self,
        r: &crate::source::Root,
        p: &crate::transaction::Plan<crate::mutations::authoring::decision::PreparedEvolution>,
    ) -> Result<(), crate::transaction::TxError> {
        self.0.fresh(r, p)
    }
    fn before_write(
        &mut self,
        _: &crate::source::Root,
        n: usize,
    ) -> Result<(), crate::transaction::TxError> {
        if n == 1 {
            Err(crate::transaction::TxError::new("injected", "before index"))
        } else {
            Ok(())
        }
    }
    fn verify(
        &mut self,
        r: &crate::source::Root,
        p: &crate::transaction::Plan<crate::mutations::authoring::decision::PreparedEvolution>,
    ) -> Result<(), crate::transaction::TxError> {
        self.0.verify(r, p)
    }
    fn verify_recovered(
        &mut self,
        r: &crate::source::Root,
        p: &crate::transaction::Plan<crate::mutations::authoring::decision::PreparedEvolution>,
    ) -> Result<(), crate::transaction::TxError> {
        self.0.verify_recovered(r, p)
    }
}
#[test]
fn precommit_failure_restores_candidate_and_index_absence() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let original = candidate("261106-one", "[]");
    std::fs::write(c.join("one.md"), &original).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let result = run_transaction(
        &root,
        &RelativePath::new(".decision.lock").unwrap(),
        &mut FailBeforeIndex(operation("one")),
    );
    assert!(!result.committed);
    assert_eq!(
        result.outcome,
        crate::transaction::RecoveryStatus::RolledBack
    );
    assert_eq!(
        std::fs::read(c.join("one.md")).unwrap(),
        original.as_bytes()
    );
    assert!(!c.join("decision-index.json").exists());
}

mod history_diagnostics;
