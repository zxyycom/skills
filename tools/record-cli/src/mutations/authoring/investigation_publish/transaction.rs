use super::*;

impl TransactionOperation<PreparedPublication> for InvestigationPublishOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedPublication>, TxError> {
        self.prepare_phase(root)
    }
}
