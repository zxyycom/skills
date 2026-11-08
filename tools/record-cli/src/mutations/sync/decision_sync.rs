//! Full Decision sync built on the same stage-local source collector as check.
use crate::mutations::check::{DecisionStage, decision_stage};
use crate::mutations::sync::full_sync;
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
fn map_error(error: crate::mutations::check::CheckError) -> TxError {
    let hint = if error.partial.is_some() {
        "; run decision-records check for detailed source diagnostics"
    } else {
        ""
    };
    failure(
        error.code,
        format!("{}: {}{hint}", error.path, error.message),
    )
}
impl DecisionSyncOperation {
    fn stage(&self, root: &Root) -> Result<DecisionStage, TxError> {
        decision_stage(root, &self.directory, &[], true).map_err(map_error)
    }
    /// A preflight independently repeats all mutable facts; it does not lock or write.
    pub fn preflight(&self, root: &Root) -> Result<SyncResult, TxError> {
        Ok(result(&self.stage(root)?, false))
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
