use super::*;

/// Reactivation explicitly confirms the desired alignment. A rename/delete
/// transaction is exercised only in an isolated fixture until platform and
/// failure-boundary acceptance is complete.
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
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedLifecycle>) -> Result<(), TxError> {
        let fresh = self.prepare_phase(root)?;
        let same = same_writes(&plan.writes, &fresh.writes, ModeEvidence::Equal);
        if !same {
            return Err(failure(
                "source-changed",
                "selected facts changed before publication",
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedLifecycle>) -> Result<(), TxError> {
        verify_moving_files(root, &self.index_path, &plan.writes)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedLifecycle>,
    ) -> Result<(), TxError> {
        verify_recovered_files(root, &plan.writes, true)
    }
}
