//! Stage operations require independent HEAD, worktree and pending proofs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StageScope {
    Index,
    All,
    Domain,
}

use crate::index::{DomainDefinition, IndexError, ValidatedIndex, build_index, serialize_index};
use std::collections::BTreeSet;

/// Build the selected index projection from P, refreshing selected IDs from W.
/// Inputs must already have been captured and validated in the current stage;
/// this pure operation is not a freshness or publication proof.
pub struct IndexInputs<'a, S> {
    pub head: Option<&'a ValidatedIndex<S>>,
    pub worktree: &'a ValidatedIndex<S>,
    pub pending: Option<&'a ValidatedIndex<S>>,
}

pub fn compose_index<D>(
    domain: &D,
    scope: StageScope,
    inputs: IndexInputs<'_, D::State>,
    selected_ids: &[String],
) -> Result<Option<Vec<u8>>, IndexError>
where
    D: DomainDefinition,
    D::State: Clone,
{
    let IndexInputs {
        head,
        worktree,
        pending,
    } = inputs;
    let worktree = worktree.index();
    validate_metadata(worktree, head, pending, scope)?;
    if scope == StageScope::Domain {
        return Ok(None);
    }
    if head.is_some() && pending.is_none() {
        return Err(IndexError::Domain("pending index deleted".into()));
    }
    let result = project_selected(worktree, pending, selected_ids)?;
    let validated = build_index(result, domain)?;
    // Relation/owner closure is domain-owned, and an unimplemented graph remains fail-closed.
    domain.graph(validated.index())?;
    Ok(Some(serialize_index(&validated, domain)?))
}

/// Refresh selected identities from W while preserving all unselected pending entries.
fn project_selected<S: Clone>(
    worktree: &crate::index::IndexV4<S>,
    pending: Option<&ValidatedIndex<S>>,
    selected_ids: &[String],
) -> Result<crate::index::IndexV4<S>, IndexError> {
    let selected: BTreeSet<_> = selected_ids.iter().collect();
    let mut result = match pending {
        Some(index) => index.index().clone(),
        None => {
            let mut empty = worktree.clone();
            empty.entries.clear();
            empty.source_revision.entries.clear();
            empty
        }
    };
    for id in selected {
        if let Some(state) = worktree.entries.get(id) {
            let revision = worktree
                .source_revision
                .entries
                .get(id)
                .ok_or_else(|| IndexError::Schema("selected revision missing".into()))?;
            result.entries.insert(id.clone(), state.clone());
            result
                .source_revision
                .entries
                .insert(id.clone(), revision.clone());
        } else {
            result.entries.remove(id);
            result.source_revision.entries.remove(id);
        }
    }
    Ok(result)
}

/// A selected projection may not cross collection metadata revisions.
fn validate_metadata<S>(
    worktree: &crate::index::IndexV4<S>,
    head: Option<&ValidatedIndex<S>>,
    pending: Option<&ValidatedIndex<S>>,
    scope: StageScope,
) -> Result<(), IndexError> {
    for other in [
        head,
        if scope == StageScope::Domain {
            None
        } else {
            pending
        },
    ]
    .into_iter()
    .flatten()
    {
        let other = other.index();
        if other.namespace != worktree.namespace
            || other.definition_version != worktree.definition_version
            || other.metadata != worktree.metadata
            || other.source_revision.metadata != worktree.source_revision.metadata
        {
            return Err(IndexError::Domain(
                "stage collection metadata changed".into(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;

mod publication;
mod reporting;
mod source_capture;

pub mod index_scope;

pub mod decision_scope;

pub mod investigation_scope;

/// A mismatch is a concurrency conflict; a read failure is not evidence of drift.
#[derive(Clone, Copy)]
enum FreshnessError {
    Drift,
    Read,
}
