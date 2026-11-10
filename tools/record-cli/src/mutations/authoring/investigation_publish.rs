//! Multi-candidate Investigation publication on a phase-local published graph.
use super::super::{
    contract::{InvestigationRelationKind, Relation, SourceReview},
    publication::{self, InvestigationCandidate},
};
use crate::{
    domains::{
        self,
        investigation::{Definition, InvestigationState},
    },
    index,
    source::{self, ExpectedFile, RelativePath, Root},
    source_revision::{self, Domain},
    transaction::{CommitPoint, Plan, TransactionOperation, TxError, WriteIntent},
};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

mod collection;
mod history;
mod resources;
mod transaction;
mod writes;
use history::history_warnings;

pub struct InvestigationPublishOperation {
    pub collection: RelativePath,
    pub selectors: Vec<String>,
}
pub struct PreparedPublication {
    pub ids: Vec<String>,
    pub review: Vec<SourceReview<InvestigationRelationKind>>,
    pub warnings: Vec<String>,
}

fn fail(code: &str, message: impl ToString) -> TxError {
    TxError::new(code, message.to_string())
}
fn relation(value: &domains::Relation) -> Result<Relation<InvestigationRelationKind>, TxError> {
    let kind = match value.relation_type.as_str() {
        "补充" => InvestigationRelationKind::Supplement,
        "复查" => InvestigationRelationKind::Reexamination,
        "修正" => InvestigationRelationKind::Correction,
        "推翻" => InvestigationRelationKind::Reversal,
        "归并" => InvestigationRelationKind::Merge,
        "拆分" => InvestigationRelationKind::Split,
        _ => return Err(fail("relation-invalid", &value.relation_type)),
    };
    Ok(Relation {
        summary_selector: None,
        kind,
        target: value.target.clone(),
        summary: value.summary.clone(),
    })
}
struct PublicationReview {
    warnings: Vec<String>,
    review: Vec<SourceReview<InvestigationRelationKind>>,
}
impl InvestigationPublishOperation {
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedPublication>, TxError> {
        if self.selectors.is_empty() {
            return Err(fail("selection", "at least one candidate is required"));
        }
        let directory = self
            .collection
            .as_path()
            .to_str()
            .ok_or_else(|| fail("path", "collection path is not UTF-8"))?;
        let collection = collection::capture(self, root)?;
        let selected = self.select_candidates(&collection.candidates)?;
        let candidates = writes::prepare(
            self,
            root,
            &collection.baseline,
            &selected,
            &collection.candidates,
        )?;
        let mut review = self.review(root, &collection, &candidates, &selected)?;
        resources::ResourceCheck {
            root,
            directory,
            selected_refs: &candidates.selected_refs,
        }
        .verify(&mut review.warnings)?;
        finish_publication(PublicationPrepared {
            collection,
            candidates,
            selected,
            review,
        })
    }
    fn review(
        &self,
        root: &Root,
        collection: &collection::Collection,
        candidates: &writes::CandidateWrites,
        selected: &BTreeSet<String>,
    ) -> Result<PublicationReview, TxError> {
        let (_, mut warnings) = history_warnings(
            root,
            &self.collection,
            &candidates.final_index.index().entries,
            selected,
        );
        warnings.extend(collection.discovery_warnings.iter().cloned());
        warnings.sort();
        warnings.dedup();
        let items = publication::plan_investigation_publication(
            &candidates.proposals,
            &collection
                .baseline
                .index()
                .entries
                .keys()
                .cloned()
                .collect(),
            &collection.occupied,
            |_| Ok::<_, ()>(()),
        )
        .map_err(|e| fail("publication", format!("{e:?}")))?;
        Ok(PublicationReview {
            warnings,
            review: items.into_iter().map(|item| item.relation_review).collect(),
        })
    }
    fn select_candidates(
        &self,
        candidates: &BTreeMap<String, String>,
    ) -> Result<BTreeSet<String>, TxError> {
        let names: BTreeMap<String, String> = candidates
            .keys()
            .map(|id| (id.clone(), domains::name_from_id(id).to_owned()))
            .collect();
        let lookup = domains::SelectorIndex::new(&names, |name| name);
        let mut selected = BTreeSet::new();
        for selector in &self.selectors {
            let (id, _) = lookup
                .resolve(selector)
                .map_err(|e| fail("selector", format!("{e:?}")))?;
            if !selected.insert(id.to_owned()) {
                return Err(fail("duplicate-selection", id));
            }
        }
        Ok(selected)
    }
}

struct PublicationPrepared {
    collection: collection::Collection,
    candidates: writes::CandidateWrites,
    selected: BTreeSet<String>,
    review: PublicationReview,
}
fn finish_publication(prepared: PublicationPrepared) -> Result<Plan<PreparedPublication>, TxError> {
    let PublicationPrepared {
        collection,
        candidates,
        selected,
        review,
    } = prepared;
    let PublicationReview {
        warnings, review, ..
    } = review;
    let collection::Collection {
        index_path,
        before_index,
        ..
    } = collection;
    let writes::CandidateWrites {
        final_index,
        mut writes,
        ..
    } = candidates;
    let after_index =
        index::serialize_index(&final_index, &Definition).map_err(|e| fail("index", e))?;
    writes.push(WriteIntent {
        path: index_path.clone(),
        before: before_index,
        after: Some(after_index),
    });
    Ok(Plan {
        value: PreparedPublication {
            ids: selected.into_iter().collect(),
            review,
            warnings,
        },
        writes,

        resources: vec![],
        commit_point: CommitPoint::PublishedIndex(index_path),
    })
}
