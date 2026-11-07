use super::*;

impl TransactionOperation<PreparedIdentity> for InvestigationIdentityOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.phase(root)
    }
}
