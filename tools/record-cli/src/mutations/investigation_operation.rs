//! Investigation relation operation.
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
    /// Selectors are resolved during operation preparation.
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
        let ExpectedFile::Present(snapshot) = first else {
            return Err(failure("index-missing", "published index is missing"));
        };
        let baseline =
            crate::index::parse_index(&snapshot.bytes, &crate::domains::investigation::Definition)
                .map_err(|e| failure("index-invalid", e.to_string()))?;
        let review = review::resolve_review(&baseline, &self.groups)?;
        let plan = investigation_relations::prepare_captured_plan(
            root,
            &self.collection,
            &review,
            snapshot,
            baseline,
        )?;
        Ok(plan)
    }
}

impl TransactionOperation<PreparedReplacement> for SetRelationsOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedReplacement>, TxError> {
        self.prepare_phase(root)
    }
}

#[cfg(test)]
mod tests;
