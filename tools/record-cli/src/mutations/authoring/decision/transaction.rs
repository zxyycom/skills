use super::*;

impl TransactionOperation<PreparedEvolution> for DecisionEvolutionOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedEvolution>, TxError> {
        self.phase(root)
    }
}
