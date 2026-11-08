//! Decision relation replacement.
use super::{
    contract::{DecisionRelationKind, Relation, RelationGroup, ReviewAction, SourceReview},
    sync::selected_sync::{Entry, SelectedUpdate, build_validated_selected},
};
use crate::{
    domains::{self, JsTrim},
    source::{ExpectedFile, RelativePath, Root, capture},
    source_revision::{Domain, fingerprint},
    transaction::{CommitPoint, Plan, TransactionOperation, TxError, WriteIntent},
};
use std::collections::{HashMap, HashSet};

mod projection;
mod review;
mod sources;

pub(super) fn normalize_summary(value: Option<&str>) -> Result<Option<String>, TxError> {
    let Some(value) = value else { return Ok(None) };
    let text = value.js_trim();
    if text.contains(['\r', '\n']) || text.chars().count() > 40 {
        return Err(fail(
            "relation-summary",
            "summary must be single-line and at most 40 code points",
        ));
    }
    Ok((!text.is_empty()).then(|| text.to_owned()))
}

pub struct DecisionRelationsOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    pub groups: Vec<RelationGroup<DecisionRelationKind>>,
}
pub struct PreparedRelations {
    pub review: Vec<SourceReview<DecisionRelationKind>>,
}
fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}
fn kind(text: &str) -> Result<DecisionRelationKind, TxError> {
    match text {
        "修订" => Ok(DecisionRelationKind::Revision),
        "替代" => Ok(DecisionRelationKind::Replacement),
        "判定无效" => Ok(DecisionRelationKind::Invalidation),
        "归并" => Ok(DecisionRelationKind::Merge),
        "拆分" => Ok(DecisionRelationKind::Split),
        "重划" => Ok(DecisionRelationKind::Reallocation),
        _ => Err(fail("relation-invalid", "invalid published relation type")),
    }
}
fn domain_relation(relation: &Relation<DecisionRelationKind>) -> domains::Relation {
    let kind = match relation.kind {
        DecisionRelationKind::Revision => "修订",
        DecisionRelationKind::Replacement => "替代",
        DecisionRelationKind::Invalidation => "判定无效",
        DecisionRelationKind::Merge => "归并",
        DecisionRelationKind::Split => "拆分",
        DecisionRelationKind::Reallocation => "重划",
    };
    domains::Relation {
        relation_type: kind.into(),
        target: relation.target.clone(),
        summary: relation.summary.clone(),
    }
}
impl DecisionRelationsOperation {
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedRelations>, TxError> {
        if self.groups.is_empty() {
            return Err(fail(
                "invalid-selection",
                "at least one source group is required",
            ));
        }
        let index_before =
            capture(root, &self.index_path).map_err(|e| fail("index-read", e.to_string()))?;
        let ExpectedFile::Present(index_file) = &index_before else {
            return Err(fail("index-missing", "published index is missing"));
        };
        let baseline = crate::index::parse_index(&index_file.bytes, &domains::decision::Definition)
            .map_err(|e| fail("index-invalid", e.to_string()))?;
        crate::index::QuerySnapshot::new(baseline.clone())
            .graph(&domains::decision::Definition)
            .map_err(|e| fail("index-invalid", e.to_string()))?;
        let resolved = review::resolve_groups(&baseline, &self.groups)?;
        let sources::Captured { sources, snapshots } =
            sources::capture_sources(root, &self.collection, &baseline, &resolved)?;
        let rendered = projection::project(&baseline, &resolved, &sources)?;
        build_plan(
            &self.index_path,
            index_before,
            snapshots,
            rendered,
            resolved,
        )
    }
}
fn build_plan(
    index_path: &RelativePath,
    index_before: ExpectedFile,
    snapshots: Vec<sources::CapturedSource>,
    rendered: projection::Rendered,
    review: Vec<SourceReview<DecisionRelationKind>>,
) -> Result<Plan<PreparedRelations>, TxError> {
    let projection::Rendered {
        projection,
        mut changed,
    } = rendered;
    let mut writes = selected_writes(snapshots, &mut changed);
    let commit_point = if writes.is_empty() {
        CommitPoint::NoCommit
    } else {
        let next = crate::index::serialize_index(&projection.index, &domains::decision::Definition)
            .map_err(|error| fail("index-serialize", error.to_string()))?;
        writes.push(WriteIntent {
            path: index_path.clone(),
            before: index_before,
            after: Some(next),
        });
        CommitPoint::PublishedIndex(index_path.clone())
    };
    Ok(Plan {
        value: PreparedRelations { review },
        writes,
        resources: vec![],
        commit_point,
    })
}

fn selected_writes(
    snapshots: Vec<sources::CapturedSource>,
    changed: &mut HashMap<String, Vec<u8>>,
) -> Vec<WriteIntent> {
    let mut writes = Vec::new();
    for sources::CapturedSource { id, path, before } in snapshots {
        if let Some(after) = changed.remove(&id) {
            writes.push(WriteIntent {
                path,
                before,
                after: Some(after),
            });
        }
    }
    writes
}

impl TransactionOperation<PreparedRelations> for DecisionRelationsOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedRelations>, TxError> {
        self.prepare_phase(root)
    }
}

#[cfg(test)]
mod tests;
