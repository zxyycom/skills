//! Lock-held publication and independent selected-scope verification.
use super::*;
use crate::transaction::{Plan, TransactionOperation};

impl TransactionOperation<PreparedSelected> for SelectedInvestigationSyncOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSelected>, TxError> {
        let stage = self.stage(root)?;
        let writes = selected_sync::prepare_publication(
            root,
            &stage.evidence.index,
            &stage.evidence.sources,
            &stage.target,
            stage.needs_write,
        )
        .map_err(|error| selected_sync::source_failure(error, Domain::Investigation))?;
        Ok(writes.into_plan(PreparedSelected {
            stage,
            index_path: self.directory.clone(),
            selectors: self.selectors.clone(),
        }))
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSelected>) -> Result<(), TxError> {
        let fresh = self.stage(root)?;
        if !fresh.evidence.equivalent(&plan.value.stage.evidence)
            || fresh.target != plan.value.stage.target
            || fresh.selected != plan.value.stage.selected
            || fresh.checked != plan.value.stage.checked
        {
            return Err(selected_sync::source_failure(
                fail(
                    "source-changed",
                    "selected facts changed before publication",
                ),
                Domain::Investigation,
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSelected>) -> Result<(), TxError> {
        self.observation.phase.set(if plan.value.stage.needs_write {
            "index-write-failed"
        } else {
            "source-invalid"
        });
        selected_sync::verify_sources(root, &plan.value.stage.evidence.sources)
            .map_err(|error| selected_sync::verification_failure(error, Domain::Investigation))?;
        let resources = capture_resources(
            root,
            &self.directory,
            &plan.value.stage.resource_ids,
            &plan.value.stage.removed_owners,
        )
        .map_err(|error| selected_sync::verification_failure(error, Domain::Investigation))?;
        if !resources.equivalent(&plan.value.stage.evidence.resources) {
            return Err(selected_sync::verification_failure(
                fail("postverify", "selected resource facts changed"),
                Domain::Investigation,
            ));
        }
        selected_sync::verify_index(
            root,
            &plan.value.stage.evidence.index,
            &plan.value.stage.target,
            &Definition,
        )
        .map_err(|error| selected_sync::verification_failure(error, Domain::Investigation))?;
        Ok(())
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedSelected>,
    ) -> Result<(), TxError> {
        let fresh = self.stage(root)?;
        if !fresh
            .evidence
            .resources
            .equivalent(&plan.value.stage.evidence.resources)
            || fresh.evidence.sources != plan.value.stage.evidence.sources
            || fresh.evidence.index.bytes != plan.value.stage.evidence.index.bytes
            || fresh.evidence.index.identity.mode != plan.value.stage.evidence.index.identity.mode
        {
            return Err(fail(
                "recovery",
                "selected facts or baseline were not restored",
            ));
        }
        Ok(())
    }
}
