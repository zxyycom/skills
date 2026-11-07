//! Investigation relation operation. Call only against isolated candidates until
//! transaction and platform acceptance is complete; it is not CLI wiring.
use super::{
    contract::{InvestigationRelationKind, Relation, RelationGroup, ReviewAction, SourceReview},
    investigation_relations::{self, PreparedReplacement},
};
use crate::{
    source::{ExpectedFile, RelativePath, Root, capture},
    transaction::{Plan, TransactionOperation, TxError},
};

mod review;

pub struct SetRelationsOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    /// Selectors are re-resolved independently on every preparation/fresh phase.
    pub groups: Vec<RelationGroup<InvestigationRelationKind>>,
}

fn failure(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}
fn kind(value: &str) -> Result<InvestigationRelationKind, TxError> {
    match value {
        "补充" => Ok(InvestigationRelationKind::Supplement),
        "复查" => Ok(InvestigationRelationKind::Reexamination),
        "修正" => Ok(InvestigationRelationKind::Correction),
        "推翻" => Ok(InvestigationRelationKind::Reversal),
        "归并" => Ok(InvestigationRelationKind::Merge),
        "拆分" => Ok(InvestigationRelationKind::Split),
        _ => Err(failure(
            "invalid-relation",
            "invalid published relation type",
        )),
    }
}
impl SetRelationsOperation {
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedReplacement>, TxError> {
        if self.groups.is_empty() {
            return Err(failure(
                "invalid-selection",
                "at least one source group is required",
            ));
        }
        let first =
            capture(root, &self.index_path).map_err(|e| failure("index-read", e.to_string()))?;
        let ExpectedFile::Present(snapshot) = &first else {
            return Err(failure("index-missing", "published index is missing"));
        };
        let baseline =
            crate::index::parse_index(&snapshot.bytes, &crate::domains::investigation::Definition)
                .map_err(|e| failure("index-invalid", e.to_string()))?;
        let review = review::resolve_review(&baseline, &self.groups)?;
        let plan = investigation_relations::capture_plan(
            root,
            &self.collection,
            &self.index_path,
            &review,
        )?;
        let baseline_again = plan
            .guards
            .iter()
            .find(|g| g.path == self.index_path)
            .map(|g| &g.before)
            .or_else(|| {
                plan.writes
                    .iter()
                    .find(|w| w.path == self.index_path)
                    .map(|w| &w.before)
            })
            .ok_or_else(|| failure("invalid-plan", "index proof missing"))?;
        if &first != baseline_again {
            return Err(failure("index-changed", "index changed during selection"));
        }
        Ok(plan)
    }
}

impl TransactionOperation<PreparedReplacement> for SetRelationsOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedReplacement>, TxError> {
        self.prepare_phase(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedReplacement>) -> Result<(), TxError> {
        let again = self.prepare_phase(root)?;
        let same_plan =
            super::relations::same_plan(&plan.writes, &again.writes, &plan.guards, &again.guards);
        if !same_plan || plan.value.review != again.value.review {
            return Err(failure(
                "source-changed",
                "selection or source changed before publication",
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedReplacement>) -> Result<(), TxError> {
        for write in &plan.writes {
            let actual =
                capture(root, &write.path).map_err(|e| failure("postverify", e.to_string()))?;
            let (ExpectedFile::Present(actual), Some(expected)) = (actual, &write.after) else {
                return Err(failure("postverify", "written file is missing"));
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
        for guard in &plan.guards {
            if !crate::source::equivalent_file(
                &capture(root, &guard.path).map_err(|e| failure("postverify", e.to_string()))?,
                &guard.before,
            ) {
                return Err(failure("postverify", "guard changed"));
            }
        }
        super::relations::verify_index(
            root,
            &self.index_path,
            &crate::domains::investigation::Definition,
        )
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedReplacement>,
    ) -> Result<(), TxError> {
        super::relations::verify_recovered(root, &plan.writes, &plan.guards)
    }
}

#[cfg(test)]
mod tests;
