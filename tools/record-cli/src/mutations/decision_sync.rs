//! Full Decision sync built on the same stage-local source collector as check.
//! No production wiring is implied by this isolated candidate operation.
use super::check::{DecisionProof, DecisionStage, decision_stage};
use super::full_sync;
use crate::{
    source::Root,
    transaction::{Plan, TransactionOperation, TxError},
};

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub command: &'static str,
    pub scope: &'static str,
    pub state: &'static str,
    pub changed: bool,
    pub changed_ids: Vec<String>,
    pub selected_ids: Vec<String>,
    pub selectors: Vec<String>,
    pub index_relative_path: String,
    pub unactivated_paths: Vec<String>,
    pub warnings: Vec<String>,
}
pub struct PreparedSync {
    stage: DecisionStage,
}
pub struct DecisionSyncOperation {
    pub directory: String,
}
fn failure(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}
fn map_error(error: super::check::CheckError) -> TxError {
    failure(error.code, format!("{}: {}", error.path, error.message))
}
fn same_source_proof(a: &DecisionProof, b: &DecisionProof) -> bool {
    a.directories == b.directories && a.sources == b.sources
}
impl DecisionSyncOperation {
    fn stage(&self, root: &Root) -> Result<DecisionStage, TxError> {
        decision_stage(root, &self.directory, &[], true).map_err(map_error)
    }
    /// A preflight independently repeats all mutable facts; it does not lock or write.
    pub fn preflight(&self, root: &Root) -> Result<SyncResult, TxError> {
        let first = self.stage(root)?;
        let second = self.stage(root)?;
        if first.proof != second.proof
            || first.target != second.target
            || first.needs_write != second.needs_write
        {
            return Err(failure(
                "source-changed",
                "sources or index changed during preflight",
            ));
        }
        Ok(result(&first, false))
    }
}
fn result(stage: &DecisionStage, committed: bool) -> SyncResult {
    SyncResult {
        command: "sync-index",
        scope: "all",
        state: if committed && stage.needs_write {
            "written"
        } else {
            stage.result.index_state
        },
        changed: committed && stage.needs_write,
        changed_ids: vec![],
        selected_ids: vec![],
        selectors: vec![],
        index_relative_path: stage.result.index_path.clone(),
        unactivated_paths: stage.activation_paths.clone(),
        warnings: vec![],
    }
}
impl PreparedSync {
    pub fn result(&self, committed: bool) -> SyncResult {
        result(&self.stage, committed)
    }
}
impl TransactionOperation<PreparedSync> for DecisionSyncOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSync>, TxError> {
        let stage = self.stage(root)?;
        let full_sync::WriteSet {
            writes,
            guards,
            commit_point,
        } = full_sync::Input {
            index_path: &stage.result.index_path,
            sources: &stage.proof.sources,
            index: &stage.proof.index,
            target: &stage.target,
            needs_write: stage.needs_write,
        }
        .prepare(root)?;
        Ok(Plan {
            value: PreparedSync { stage },
            writes,
            guards,
            resources: vec![],
            commit_point,
        })
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let actual = self.stage(root)?;
        if actual.proof != plan.value.stage.proof
            || actual.target != plan.value.stage.target
            || actual.needs_write != plan.value.stage.needs_write
        {
            return Err(failure(
                "source-changed",
                "sources or index changed before publication",
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let actual = self.stage(root)?;
        if !same_source_proof(&actual.proof, &plan.value.stage.proof)
            || actual.target != plan.value.stage.target
            || actual.needs_write
        {
            return Err(failure(
                "postverify",
                "sources or published projection changed",
            ));
        }
        Ok(())
    }
    fn verify_recovered(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let actual = self.stage(root)?;
        if !same_source_proof(&actual.proof, &plan.value.stage.proof) {
            return Err(failure("recovery", "source collection changed"));
        }
        match (&actual.proof.index, &plan.value.stage.proof.index) {
            (None, None) => Ok(()),
            (Some(a), Some(b)) if a.bytes == b.bytes && a.identity.mode == b.identity.mode => {
                Ok(())
            }
            _ => Err(failure("recovery", "previous index was not restored")),
        }
    }
}

#[cfg(test)]
mod tests;
