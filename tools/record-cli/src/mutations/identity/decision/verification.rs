use super::*;

impl TransactionOperation<PreparedIdentity> for DecisionIdentityOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.phase(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        super::super::fresh_phase(
            root,
            plan,
            |root| self.phase(root),
            |before, after| before.evidence.equivalent(&after.evidence),
        )
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        super::super::verify_written_files(root, plan)?;
        if !plan.value.candidate && !plan.value.no_change {
            super::super::verify_published_index(root, &self.index_path, &Definition)?;
        }
        Ok(())
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedIdentity>,
    ) -> Result<(), TxError> {
        super::super::verify_recovered_files(root, plan)?;
        Ok(())
    }
}
