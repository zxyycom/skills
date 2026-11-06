//! Full Investigation synchronization using the same source and resource
//! collection as check, with independent fresh and post-write verification.
use super::check::{InvestigationStage, investigation_stage};
use super::full_sync;
use crate::{
    source::Root,
    transaction::{Plan, TransactionOperation, TxError},
};

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub scope: &'static str,
    pub state: &'static str,
    pub changed: bool,
    pub changed_ids: Vec<String>,
    pub selected_ids: Vec<String>,
    pub index_path: String,
    pub report_count: usize,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}
pub struct PreparedSync {
    stage: InvestigationStage,
}
pub struct InvestigationSyncOperation {
    pub directory: String,
}
fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}
fn map_error(error: super::check::CheckError) -> TxError {
    fail(error.code, format!("{}: {}", error.path, error.message))
}
impl InvestigationSyncOperation {
    fn stage(&self, root: &Root) -> Result<InvestigationStage, TxError> {
        investigation_stage(root, &self.directory, true).map_err(map_error)
    }
    /// Full sync preview separately reacquires sources, index and resource facts.
    pub fn preflight(&self, root: &Root) -> Result<SyncResult, TxError> {
        let first = self.stage(root)?;
        let second = self.stage(root)?;
        let (Some(a), Some(b)) = (&first.proof, &second.proof) else {
            return Err(fail("resource-invalid", "resource evidence unavailable"));
        };
        if !a.equivalent(b)
            || first.target != second.target
            || first.needs_write != second.needs_write
        {
            return Err(fail(
                "source-changed",
                "sources, resources or index changed during preflight",
            ));
        }
        Ok(result(&first, false))
    }
}
fn result(stage: &InvestigationStage, committed: bool) -> SyncResult {
    SyncResult {
        scope: "all",
        state: if committed && stage.needs_write {
            "written"
        } else {
            stage.result.index_state
        },
        changed: committed && stage.needs_write,
        changed_ids: vec![],
        selected_ids: vec![],
        index_path: stage.result.index_path.clone(),
        report_count: stage.result.formal_count,
        errors: vec![],
        warnings: stage.result.warnings.clone(),
    }
}
impl PreparedSync {
    pub fn result(&self, committed: bool) -> SyncResult {
        result(&self.stage, committed)
    }
}
impl TransactionOperation<PreparedSync> for InvestigationSyncOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSync>, TxError> {
        let stage = self.stage(root)?;
        let proof = stage
            .proof
            .as_ref()
            .ok_or_else(|| fail("resource-invalid", "resource evidence unavailable"))?;
        let full_sync::WriteSet {
            writes,
            guards,
            commit_point,
        } = full_sync::Input {
            index_path: &stage.result.index_path,
            sources: &proof.sources,
            index: &proof.index,
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
        let (Some(a), Some(b)) = (&actual.proof, &plan.value.stage.proof) else {
            return Err(fail("resource-invalid", "resource evidence unavailable"));
        };
        if !a.equivalent(b)
            || actual.target != plan.value.stage.target
            || actual.needs_write != plan.value.stage.needs_write
        {
            return Err(fail(
                "source-changed",
                "sources, resources or index changed before publication",
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let actual = self.stage(root)?;
        let (Some(a), Some(b)) = (&actual.proof, &plan.value.stage.proof) else {
            return Err(fail("postverify", "resource evidence unavailable"));
        };
        if !a.sources_equivalent(b)
            || actual.target != plan.value.stage.target
            || actual.needs_write
        {
            return Err(fail(
                "postverify",
                "sources, resources or published projection changed",
            ));
        }
        Ok(())
    }
    fn verify_recovered(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let actual = self.stage(root)?;
        let (Some(a), Some(b)) = (&actual.proof, &plan.value.stage.proof) else {
            return Err(fail("recovery", "resource evidence unavailable"));
        };
        if !a.sources_equivalent(b) {
            return Err(fail("recovery", "source or resource facts changed"));
        }
        match (&a.index, &b.index) {
            (None, None) => Ok(()),
            (Some(a), Some(b)) if a.bytes == b.bytes && a.identity.mode == b.identity.mode => {
                Ok(())
            }
            _ => Err(fail("recovery", "previous index was not restored")),
        }
    }
}

#[cfg(test)]
mod tests;
