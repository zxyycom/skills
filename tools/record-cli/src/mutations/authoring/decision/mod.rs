//! Decision publication and evolution as a single index-committing transaction.
use crate::mutations::{
    contract::{
        Alignment, DecisionRelationKind, DecisionRelationOverride, Relation, SourceReview,
        Successor,
    },
    decision_history, decision_selected_sync, evolution,
    lifecycle::Status,
};
use crate::{
    domains::{
        self, JsTrim,
        decision::{self, Definition},
    },
    index,
    source::{self, ExpectedFile, RelativePath, Root},
    source_revision::{self, Domain},
    transaction::{
        CommitPoint, Guard, Plan, ResourceIntent, TransactionOperation, TxError, WriteIntent,
        WriteMode,
    },
};
use std::collections::{BTreeMap, BTreeSet, HashSet};

mod collection;
mod dependencies;
mod history;
mod selection;
mod successors;
mod transaction;
mod writes;

pub struct DecisionEvolutionOperation {
    pub collection: RelativePath,
    pub successors: Vec<Successor>,
    pub relations: DecisionRelationOverride,
    pub discard: Option<String>,
    pub delete_recorded: bool,
    pub keep_unrecorded_history: bool,
    pub publish_only: bool,
    /// Captured once before preflight/transaction preparation.
    pub timestamp: String,
}
pub struct PreparedEvolution {
    pub review: Vec<SourceReview<DecisionRelationKind>>,
    pub established: Vec<String>,
    pub archived: Vec<String>,
    pub discarded: Option<String>,
    evidence: Evidence,
}
#[derive(Debug, PartialEq, Eq)]
struct Evidence {
    listing: source::DirectorySnapshot,
    archive: Option<source::DirectorySnapshot>,
    headers: Vec<(String, source::HeaderSnapshot)>,
    history: decision_history::HistoryEvidence,
    discard_history: Option<(Option<String>, bool)>,
}
impl Evidence {
    fn equivalent(&self, other: &Self) -> bool {
        super::super::same_directory(&self.listing, &other.listing)
            && super::super::same_optional_directory(&self.archive, &other.archive)
            && super::super::same_named_headers(&self.headers, &other.headers)
            && self.history == other.history
            && self.discard_history == other.discard_history
    }
}

fn fail(code: &str, message: impl ToString) -> TxError {
    TxError::new(code, message.to_string())
}
fn path(c: &RelativePath, p: &str) -> Result<RelativePath, TxError> {
    RelativePath::new(c.as_path().join(p)).map_err(|e| fail("path", e))
}
fn same_mode(a: &Option<WriteMode>, b: &Option<WriteMode>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(WriteMode::Exact(a)), Some(WriteMode::Exact(b)))
        | (Some(WriteMode::Native(a)), Some(WriteMode::Native(b))) => a == b,
        _ => false,
    }
}
fn same_resources(a: &[ResourceIntent], b: &[ResourceIntent]) -> bool {
    a.len() == b.len()
        && a.iter().zip(b).all(|(a, b)| match (a, b) {
            (
                ResourceIntent::CreateDirectory { path: a },
                ResourceIntent::CreateDirectory { path: b },
            ) => a == b,
            _ => false,
        })
}
fn kind(s: &str) -> Result<DecisionRelationKind, TxError> {
    match s {
        "修订" => Ok(DecisionRelationKind::Revision),
        "替代" => Ok(DecisionRelationKind::Replacement),
        "判定无效" => Ok(DecisionRelationKind::Invalidation),
        "归并" => Ok(DecisionRelationKind::Merge),
        "拆分" => Ok(DecisionRelationKind::Split),
        "重划" => Ok(DecisionRelationKind::Reallocation),
        _ => Err(fail("relation-invalid", s)),
    }
}
fn relation(r: &domains::Relation) -> Result<Relation<DecisionRelationKind>, TxError> {
    Ok(Relation {
        kind: kind(&r.relation_type)?,
        target: r.target.clone(),
        summary: r.summary.clone(),
    })
}
fn domain_relation(r: &Relation<DecisionRelationKind>) -> domains::Relation {
    domains::Relation {
        relation_type: match r.kind {
            DecisionRelationKind::Revision => "修订",
            DecisionRelationKind::Replacement => "替代",
            DecisionRelationKind::Invalidation => "判定无效",
            DecisionRelationKind::Merge => "归并",
            DecisionRelationKind::Split => "拆分",
            DecisionRelationKind::Reallocation => "重划",
        }
        .into(),
        target: r.target.clone(),
        summary: r.summary.clone(),
    }
}
struct Located {
    path: String,
    name: String,
}
fn resolve<'a>(ids: &'a BTreeMap<String, Located>, selector: &str) -> Result<&'a str, TxError> {
    domains::resolve_selector(ids, selector, |item| &item.name)
        .map(|(id, _)| id)
        .map_err(|e| fail("selector", format!("{e:?}: {selector}")))
}
fn capture(root: &Root, c: &RelativePath, p: &str) -> Result<ExpectedFile, TxError> {
    source::capture(root, &path(c, p)?).map_err(|e| fail("source", e))
}
fn validate_source(
    root: &Root,
    c: &RelativePath,
    id: &str,
    state: &decision::DecisionState,
    revision: &str,
) -> Result<ExpectedFile, TxError> {
    let before = capture(root, c, &state.source_path)?;
    let ExpectedFile::Present(file) = &before else {
        return Err(fail("source-missing", id));
    };
    let text = std::str::from_utf8(&file.bytes).map_err(|e| fail("source-encoding", e))?;
    let parsed = decision::parse_established(&file.bytes, id, &state.source_path)
        .map_err(|e| fail("source-invalid", e))?;
    if parsed.state != *state
        || source_revision::fingerprint(Domain::Decision, id, &state.source_path, text) != revision
    {
        return Err(fail("source-stale", id));
    }
    Ok(before)
}
struct EvolutionInputs {
    collection: collection::Collection,
    selection: selection::Selection,
    prepared: successors::Prepared,
}
struct EvolutionWork {
    inputs: EvolutionInputs,
    writes: writes::Writes,
    history: history::HistoryReview,
}
impl DecisionEvolutionOperation {
    fn prepare_inputs(&self, root: &Root) -> Result<EvolutionInputs, TxError> {
        if self.successors.is_empty() || (self.publish_only && self.successors.len() != 1) {
            return Err(fail("selection", "expected successor selection"));
        }
        if !domains::valid_timestamp(&self.timestamp) {
            return Err(fail("timestamp", "invalid creation timestamp"));
        }
        let collection = collection::capture(self, root)?;
        let collection::Collection {
            baseline,
            ids,
            candidates,
            ..
        } = &collection;
        let selection = selection::resolve_selection(self, ids, candidates)?;
        let prepared = successors::Preparation {
            operation: self,
            root,
            baseline,
            ids,
            candidates,
            selection: &selection,
        }
        .prepare()?;
        Ok(EvolutionInputs {
            collection,
            selection,
            prepared,
        })
    }
    fn phase(&self, root: &Root) -> Result<Plan<PreparedEvolution>, TxError> {
        let inputs = self.prepare_inputs(root)?;
        let work = self.prepare_work(root, inputs)?;
        self.finish_plan(root, work)
    }
    fn prepare_work(
        &self,
        root: &Root,
        mut inputs: EvolutionInputs,
    ) -> Result<EvolutionWork, TxError> {
        let collection = &inputs.collection;
        let selection = &inputs.selection;
        let prepared = &mut inputs.prepared;
        let writes = writes::WritePreparation {
            operation: self,
            root,
            baseline: &collection.baseline,
            ids: &collection.ids,
            candidates: &collection.candidates,
            selected: &selection.selected,
            discarded: &selection.discarded,
            archive: &collection.archive,
        }
        .build(
            std::mem::take(&mut prepared.sources),
            &prepared.successors,
            &prepared.preliminary,
        )?;
        let history = history::HistoryPreparation {
            operation: self,
            root,
            historical: &prepared.historical,
            discarded: &selection.discarded,
            ids: &collection.ids,
            candidates: &collection.candidates,
            predecessors: std::mem::take(&mut prepared.predecessors),
            successors: &prepared.successors,
        }
        .review()?;
        Ok(EvolutionWork {
            inputs,
            writes,
            history,
        })
    }
    fn finish_plan(
        &self,
        root: &Root,
        work: EvolutionWork,
    ) -> Result<Plan<PreparedEvolution>, TxError> {
        let EvolutionWork {
            inputs,
            writes: proposed,
            history,
        } = work;
        let collection = inputs.collection;
        let selection = inputs.selection;
        let prepared = inputs.prepared;
        let writes::Writes {
            final_index,
            mut writes,
            mut guards,
            resources,
        } = proposed;
        guards.extend(
            dependencies::Dependencies {
                root,
                collection: &self.collection,
                baseline: &collection.baseline,
                final_index: &final_index,
                selected: &selection.selected,
                target_ids: &prepared.target_ids,
                discarded: &selection.discarded,
                archive_ids: &history.plan.archive_ids,
            }
            .capture()?,
        );
        let commit_point = publication_point(
            &final_index,
            collection.index_path,
            collection.index_before,
            &mut writes,
            &mut guards,
        )?;
        Ok(Plan {
            value: PreparedEvolution {
                review: history.plan.review,
                established: history.plan.establish_ids,
                archived: history.plan.archive_ids,
                discarded: selection.discarded,
                evidence: Evidence {
                    listing: collection.listing,
                    archive: collection.archive,
                    headers: collection.headers,
                    history: history.history,
                    discard_history: history.discard_history,
                },
            },
            writes,
            guards,
            resources,
            commit_point,
        })
    }
}
fn publication_point(
    final_index: &index::ValidatedIndex<decision::DecisionState>,
    index_path: RelativePath,
    index_before: ExpectedFile,
    writes: &mut Vec<WriteIntent>,
    guards: &mut Vec<Guard>,
) -> Result<CommitPoint, TxError> {
    let bytes = index::serialize_index(final_index, &Definition).map_err(|e| fail("index", e))?;
    let same_index = matches!(&index_before, ExpectedFile::Present(file) if file.bytes == bytes);
    let commit_point = if same_index {
        guards.push(Guard {
            path: index_path.clone(),
            before: index_before,
        });
        if writes.is_empty() {
            CommitPoint::NoCommit
        } else if writes.len() == 1 && writes[0].after.is_none() {
            CommitPoint::Exited(writes[0].path.clone())
        } else {
            return Err(fail(
                "invalid-plan",
                "changed sources without a changed index",
            ));
        }
    } else {
        let mode =
            matches!(index_before, ExpectedFile::Missing).then_some(WriteMode::Native(0o666));
        writes.push(WriteIntent {
            path: index_path.clone(),
            before: index_before,
            after: Some(bytes),
            mode,
        });
        CommitPoint::PublishedIndex(index_path)
    };
    Ok(commit_point)
}

#[cfg(test)]
mod tests;
