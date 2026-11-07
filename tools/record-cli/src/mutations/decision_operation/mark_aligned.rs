use super::*;

pub struct MarkAlignedOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    pub selector: String,
}
impl MarkAlignedOperation {
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedLifecycle>, TxError> {
        prepare_lifecycle(
            root,
            &self.collection,
            &self.index_path,
            &self.selector,
            LifecycleAction::MarkAligned,
        )
    }
}
impl TransactionOperation<PreparedLifecycle> for MarkAlignedOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedLifecycle>, TxError> {
        self.prepare_phase(root)
    }
}
