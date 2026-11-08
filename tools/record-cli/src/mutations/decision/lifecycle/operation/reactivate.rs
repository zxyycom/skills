use super::*;

/// Reactivation explicitly confirms the desired alignment.
pub struct ReactivateOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    pub selector: String,
    pub alignment: Alignment,
}
impl ReactivateOperation {
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedLifecycle>, TxError> {
        prepare_lifecycle(
            root,
            &self.collection,
            &self.index_path,
            &self.selector,
            LifecycleAction::Reactivate(self.alignment),
        )
    }
}
impl TransactionOperation<PreparedLifecycle> for ReactivateOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedLifecycle>, TxError> {
        self.prepare_phase(root)
    }
}
