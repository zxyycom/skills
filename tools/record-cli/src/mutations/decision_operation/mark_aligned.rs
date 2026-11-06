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
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedLifecycle>) -> Result<(), TxError> {
        let fresh = self.prepare_phase(root)?;
        let same = same_writes(&plan.writes, &fresh.writes, ModeEvidence::Absent);
        if !same {
            return Err(failure(
                "source-changed",
                "selected facts changed before publication",
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedLifecycle>) -> Result<(), TxError> {
        for write in &plan.writes {
            let actual =
                capture(root, &write.path).map_err(|e| failure("postverify", e.to_string()))?;
            let (ExpectedFile::Present(actual), Some(expected)) = (actual, &write.after) else {
                return Err(failure("postverify", "written file missing"));
            };
            if actual.bytes != *expected {
                return Err(failure("postverify", "written bytes differ"));
            }
            if let ExpectedFile::Present(before) = &write.before
                && actual.identity.mode != before.identity.mode
            {
                return Err(failure("postverify", "written file mode differs"));
            }
        }
        verify_index_graph(root, &self.index_path)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedLifecycle>,
    ) -> Result<(), TxError> {
        verify_recovered_files(root, &plan.writes, false)
    }
}
