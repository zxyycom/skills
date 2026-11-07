//! Full Investigation synchronization using the same source and resource
//! collection as check, prepared once for ordered execution.
use crate::mutations::check::{InvestigationStage, investigation_stage};
use crate::mutations::sync::full_sync;
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
fn map_error(error: crate::mutations::check::CheckError) -> TxError {
    fail(error.code, format!("{}: {}", error.path, error.message))
}
impl InvestigationSyncOperation {
    fn stage(&self, root: &Root) -> Result<InvestigationStage, TxError> {
        investigation_stage(root, &self.directory, true).map_err(map_error)
    }
    /// Full sync preview separately reacquires sources, index and resource facts.
    pub fn preflight(&self, root: &Root) -> Result<SyncResult, TxError> {
        Ok(result(&self.stage(root)?, false))
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
        let mut stage = self.stage(root)?;
        let full_sync::WriteSet {
            writes,
            commit_point,
        } = full_sync::Input {
            index_path: &stage.result.index_path,
            index_before: std::mem::replace(
                &mut stage.index_before,
                crate::source::ExpectedFile::Missing,
            ),
            target: &stage.target,
            needs_write: stage.needs_write,
        }
        .prepare(root)?;
        Ok(Plan {
            value: PreparedSync { stage },
            writes,
            resources: vec![],
            commit_point,
        })
    }
}

#[cfg(test)]
mod tests;
