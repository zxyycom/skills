//! IR multi-candidate publication proposal, after candidate/source validation.
use super::contract::{InvestigationRelationKind, Relation, ReviewAction, SourceReview};
use std::collections::HashSet;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InvestigationCandidate {
    pub id: String,
    pub source_path: String,
    pub body_ready: bool,
    pub resource_ready: bool,
    pub relations: Vec<Relation<InvestigationRelationKind>>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PublicationItem {
    pub id: String,
    pub candidate_path: String,
    pub formal_path: String,
    pub relation_review: SourceReview<InvestigationRelationKind>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PublicationError<E> {
    EmptySelection,
    DuplicateId(String),
    AlreadyPublished(String),
    CandidateNotReady(String),
    InvalidCandidatePath(String),
    FormalPathOccupied(String),
    DuplicateFormalPath(String),
    MissingTarget { id: String, target: String },
    FinalGraph(E),
}

/// Baseline IDs/occupied paths must come from the validated phase-local facts.
/// `validate_graph` is mandatory: a relation-target check alone does not prove
/// graph closure, split/merge constraints or resource-owner validity.
pub fn plan_investigation_publication<E>(
    candidates: &[InvestigationCandidate],
    published_ids: &HashSet<String>,
    occupied_paths: &HashSet<String>,
    validate_graph: impl FnOnce(&[PublicationItem]) -> Result<(), E>,
) -> Result<Vec<PublicationItem>, PublicationError<E>> {
    if candidates.is_empty() {
        return Err(PublicationError::EmptySelection);
    }
    let mut ids = HashSet::new();
    let mut paths = HashSet::new();
    let mut items = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        items.push(prepare_candidate(
            candidate,
            published_ids,
            occupied_paths,
            &mut ids,
            &mut paths,
        )?);
    }
    for candidate in candidates {
        for relation in &candidate.relations {
            if !published_ids.contains(&relation.target) && !ids.contains(relation.target.as_str())
            {
                return Err(PublicationError::MissingTarget {
                    id: candidate.id.clone(),
                    target: relation.target.clone(),
                });
            }
        }
    }
    validate_graph(&items).map_err(PublicationError::FinalGraph)?;
    Ok(items)
}

fn prepare_candidate<'a, E>(
    candidate: &'a InvestigationCandidate,
    published_ids: &HashSet<String>,
    occupied_paths: &HashSet<String>,
    ids: &mut HashSet<&'a str>,
    paths: &mut HashSet<String>,
) -> Result<PublicationItem, PublicationError<E>> {
    if !ids.insert(candidate.id.as_str()) {
        return Err(PublicationError::DuplicateId(candidate.id.clone()));
    }
    if published_ids.contains(&candidate.id) {
        return Err(PublicationError::AlreadyPublished(candidate.id.clone()));
    }
    if !candidate.body_ready || !candidate.resource_ready {
        return Err(PublicationError::CandidateNotReady(candidate.id.clone()));
    }
    let locator = candidate
        .source_path
        .strip_prefix("_candidate.")
        .filter(|s| !s.is_empty() && !s.contains(['/', '\\']))
        .ok_or_else(|| PublicationError::InvalidCandidatePath(candidate.source_path.clone()))?;
    let formal_path = format!("{locator}.md");
    if occupied_paths.contains(&formal_path) {
        return Err(PublicationError::FormalPathOccupied(formal_path));
    }
    if !paths.insert(formal_path.clone()) {
        return Err(PublicationError::DuplicateFormalPath(formal_path));
    }
    Ok(PublicationItem {
        id: candidate.id.clone(),
        candidate_path: candidate.source_path.clone(),
        formal_path,
        relation_review: SourceReview {
            source_id: candidate.id.clone(),
            action: ReviewAction::Establish,
            before: candidate.relations.clone(),
            after: candidate.relations.clone(),
        },
    })
}

#[cfg(test)]
mod tests;
