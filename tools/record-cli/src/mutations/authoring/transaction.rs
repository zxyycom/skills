use super::*;

impl TransactionOperation<PreparedNew> for NewOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedNew>, TxError> {
        self.prepare_phase(root)
    }
}
