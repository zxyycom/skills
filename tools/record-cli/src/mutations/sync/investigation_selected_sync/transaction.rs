//! Selected-scope publication plan.
use super::*;
use crate::transaction::{Plan, TransactionOperation};

impl TransactionOperation<PreparedSelected> for SelectedInvestigationSyncOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSelected>, TxError> {
        let stage = self.stage(root)?;
        let index = stage.index.clone();
        let target = stage.target.clone();
        let needs_write = stage.needs_write;
        Ok(selected_sync::prepare_publication(
            index,
            &target,
            needs_write,
            PreparedSelected {
                stage,
                index_path: self.directory.clone(),
                selectors: self.selectors.clone(),
            },
        ))
    }
}
