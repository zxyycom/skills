//! Final relation replacement and review for an already resolved selection.
//! Resolution and graph validation belong to the domain preparation phase.
mod transaction;
pub(super) use transaction::{same_plan, verify_index, verify_recovered};

use std::collections::{HashMap, HashSet};

use super::contract::{Relation, RelationGroup, ReviewAction, ReviewPhase, SourceReview};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SelectedSource<T> {
    pub id: String,
    pub candidate: bool,
    pub before: Vec<Relation<T>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Replacement<T> {
    Preserve,
    All(Vec<Relation<T>>),
    Groups(Vec<RelationGroup<T>>),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RelationPlanError {
    DuplicateSource(String),
    UnknownSource(String),
    DuplicateTarget { source: String, target: String },
}

/// Both group sources and edge targets must already be resolved to IDs.
/// Keeps selection order and the before/after order supplied by the domain.
pub fn plan_relations<T: Clone + PartialEq>(
    sources: &[SelectedSource<T>],
    replacement: &Replacement<T>,
) -> Result<Vec<SourceReview<T>>, RelationPlanError> {
    let groups = resolve_groups(sources, replacement)?;
    let mut result = Vec::with_capacity(sources.len());
    for source in sources {
        let after: &[Relation<T>] = match replacement {
            Replacement::Preserve => &source.before,
            Replacement::All(relations) => relations,
            Replacement::Groups(_) => groups
                .get(source.id.as_str())
                .copied()
                .unwrap_or(&source.before),
        };
        let mut targets = HashSet::new();
        for relation in after {
            if !targets.insert(relation.target.as_str()) {
                return Err(RelationPlanError::DuplicateTarget {
                    source: source.id.clone(),
                    target: relation.target.clone(),
                });
            }
        }
        let action = if source.candidate {
            ReviewAction::Establish
        } else if source.before.as_slice() == after {
            ReviewAction::Unchanged
        } else {
            ReviewAction::Replace
        };
        result.push(SourceReview {
            source_id: source.id.clone(),
            action,
            before: source.before.clone(),
            after: after.to_vec(),
        });
    }
    Ok(result)
}

type ResolvedGroups<'a, T> = HashMap<&'a str, &'a [Relation<T>]>;
fn resolve_groups<'a, T>(
    sources: &'a [SelectedSource<T>],
    replacement: &'a Replacement<T>,
) -> Result<ResolvedGroups<'a, T>, RelationPlanError> {
    let mut ids = HashSet::new();
    for source in sources {
        if !ids.insert(source.id.as_str()) {
            return Err(RelationPlanError::DuplicateSource(source.id.clone()));
        }
    }
    let mut groups = HashMap::new();
    if let Replacement::Groups(input) = replacement {
        for group in input {
            if !ids.contains(group.source.as_str()) {
                return Err(RelationPlanError::UnknownSource(group.source.clone()));
            }
            if groups
                .insert(group.source.as_str(), group.relations.as_slice())
                .is_some()
            {
                return Err(RelationPlanError::DuplicateSource(group.source.clone()));
            }
        }
    }
    Ok(groups)
}

/// A successful review is produced only at a proven phase boundary.
pub fn review<T>(
    mut sources: Vec<SourceReview<T>>,
    phase: ReviewPhase,
) -> super::contract::RelationReview<T> {
    sources.sort_by(|a, b| a.source_id.encode_utf16().cmp(b.source_id.encode_utf16()));
    super::contract::RelationReview { phase, sources }
}

#[cfg(test)]
mod tests;
