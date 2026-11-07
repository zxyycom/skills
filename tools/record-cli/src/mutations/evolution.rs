//! Decision evolution on resolved, validated stage-local records. Graph,
//! history, source validation and index publication remain separate responsibilities.
use super::{
    contract::{Alignment, DecisionRelationKind, Relation, ReviewAction, SourceReview},
    lifecycle::{HistoryFact, Status},
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Successor {
    pub id: String,
    pub candidate: bool,
    pub body_ready: bool,
    pub existing_alignment: Option<Alignment>,
    pub requested_alignment: Alignment,
    pub before: Vec<Relation<DecisionRelationKind>>,
    pub after: Vec<Relation<DecisionRelationKind>>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Predecessor {
    pub status: Status,
    pub history: HistoryFact,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EvolutionPlan {
    pub review: Vec<SourceReview<DecisionRelationKind>>,
    pub establish_ids: Vec<String>,
    pub archive_ids: Vec<String>,
    pub discard_id: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EvolutionError<E> {
    EmptySelection,
    DuplicateSuccessor(String),
    CandidateNotReady(String),
    AlignmentMismatch(String),
    MissingPredecessor(String),
    DuplicateTarget(String),
    SuccessorDiscardConflict(String),
    HistoryUnavailable(String),
    HistoryConfirmationRequired(String),
    FinalGraph(E),
}

/// Predecessor status comes from the validated published index. Callers must
/// validate selected sources separately and supply final graph and discard
/// eligibility checks via `validate_final`; no graph success is inferred here.
pub fn plan_evolution<E>(
    successors: &[Successor],
    predecessors: &BTreeMap<String, Predecessor>,
    discard_id: Option<&str>,
    keep_unrecorded_history: bool,
    validate_final: impl FnOnce(&EvolutionPlan) -> Result<(), E>,
) -> Result<EvolutionPlan, EvolutionError<E>> {
    if successors.is_empty() {
        return Err(EvolutionError::EmptySelection);
    }
    let mut ids = BTreeSet::new();
    let mut archives = BTreeSet::new();
    let mut predecessor_ids = BTreeSet::new();
    let mut establish_ids = Vec::new();
    let mut review = Vec::with_capacity(successors.len());
    for source in successors {
        if !ids.insert(source.id.as_str()) {
            return Err(EvolutionError::DuplicateSuccessor(source.id.clone()));
        }
        if discard_id == Some(source.id.as_str()) {
            return Err(EvolutionError::SuccessorDiscardConflict(source.id.clone()));
        }
        let item = successor_review(source)?;
        if source.candidate {
            establish_ids.push(source.id.clone());
        }
        collect_predecessors(source, predecessors, &mut archives, &mut predecessor_ids)?;
        review.push(item);
    }
    let plan = EvolutionPlan {
        review,
        establish_ids,
        archive_ids: archives.into_iter().collect(),
        discard_id: discard_id.map(str::to_owned),
    };
    // Full graph and discard eligibility precede history confirmation.
    validate_final(&plan).map_err(EvolutionError::FinalGraph)?;
    verify_history(predecessor_ids, predecessors, keep_unrecorded_history)?;
    Ok(plan)
}

fn successor_review<E>(
    source: &Successor,
) -> Result<SourceReview<DecisionRelationKind>, EvolutionError<E>> {
    if source.candidate && !source.body_ready {
        return Err(EvolutionError::CandidateNotReady(source.id.clone()));
    }
    if !source.candidate && source.existing_alignment != Some(source.requested_alignment) {
        return Err(EvolutionError::AlignmentMismatch(source.id.clone()));
    }
    Ok(SourceReview {
        source_id: source.id.clone(),
        action: if source.candidate {
            ReviewAction::Establish
        } else if source.before == source.after {
            ReviewAction::Unchanged
        } else {
            ReviewAction::Replace
        },
        before: source.before.clone(),
        after: source.after.clone(),
    })
}

fn verify_history<E>(
    predecessor_ids: BTreeSet<String>,
    predecessors: &BTreeMap<String, Predecessor>,
    keep_unrecorded_history: bool,
) -> Result<(), EvolutionError<E>> {
    for id in predecessor_ids {
        match predecessors[&id].history {
            HistoryFact::Unavailable => return Err(EvolutionError::HistoryUnavailable(id)),
            HistoryFact::Unrecorded if !keep_unrecorded_history => {
                return Err(EvolutionError::HistoryConfirmationRequired(id));
            }
            _ => {}
        }
    }
    Ok(())
}

fn collect_predecessors<E>(
    source: &Successor,
    predecessors: &BTreeMap<String, Predecessor>,
    archives: &mut BTreeSet<String>,
    predecessor_ids: &mut BTreeSet<String>,
) -> Result<(), EvolutionError<E>> {
    let mut targets = BTreeSet::new();
    for edge in &source.after {
        if !targets.insert(edge.target.as_str()) {
            return Err(EvolutionError::DuplicateTarget(edge.target.clone()));
        }
        let predecessor = predecessors
            .get(&edge.target)
            .ok_or_else(|| EvolutionError::MissingPredecessor(edge.target.clone()))?;
        predecessor_ids.insert(edge.target.clone());
        if predecessor.status == Status::Active {
            archives.insert(edge.target.clone());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;
