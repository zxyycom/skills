//! Discard eligibility on an already validated published projection. Resource
//! membership and Git history must be captured independently by the caller.
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Domain {
    Decision,
    Investigation,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum History {
    NotRecorded,
    Recorded,
    Unavailable,
}
/// History is a captured fact; the booleans record separate user confirmations.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DiscardChecks {
    pub history: History,
    pub recorded_deletion_confirmed: bool,
    pub owned_resources_deletion_confirmed: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscardTarget {
    pub id: String,
    pub source_path: String,
    pub candidate: bool,
    /// Explicitly selected complete, safely enumerated owner members.
    pub owned_resources: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PublishedReferences {
    pub source_id: String,
    pub relation_targets: Vec<String>,
    pub resource_owners: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscardPlan {
    pub id: String,
    pub source_path: String,
    pub delete_resources: Vec<String>,
    pub publish_index: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DiscardError {
    ReferencedBy(String),
    ResourceOwnerReferencedBy(String),
    ResourceDeletionNotConfirmed,
    UnexpectedDecisionResources,
    DuplicateResource(String),
    HistoryUnavailable,
    RecordedDeletionNotConfirmed,
}

/// `references` contains published entries only, plus any candidates explicitly
/// selected in the same transaction. Unselected candidates are not inspected.
/// The caller must separately validate the final graph and resource tree safety.
pub fn plan_discard(
    domain: Domain,
    target: &DiscardTarget,
    references: &[PublishedReferences],
    checks: DiscardChecks,
) -> Result<DiscardPlan, DiscardError> {
    validate_references(domain, target, references)?;
    validate_resources(domain, target, checks.owned_resources_deletion_confirmed)?;
    validate_history(checks)?;
    Ok(DiscardPlan {
        id: target.id.clone(),
        source_path: target.source_path.clone(),
        delete_resources: target.owned_resources.clone(),
        publish_index: !target.candidate,
    })
}

fn validate_references(
    domain: Domain,
    target: &DiscardTarget,
    references: &[PublishedReferences],
) -> Result<(), DiscardError> {
    for source in references {
        if source.source_id == target.id {
            continue;
        }
        if source.relation_targets.contains(&target.id) {
            return Err(DiscardError::ReferencedBy(source.source_id.clone()));
        }
        if domain == Domain::Investigation
            && !target.owned_resources.is_empty()
            && source.resource_owners.contains(&target.id)
        {
            return Err(DiscardError::ResourceOwnerReferencedBy(
                source.source_id.clone(),
            ));
        }
    }
    Ok(())
}

fn validate_resources(
    domain: Domain,
    target: &DiscardTarget,
    confirmed: bool,
) -> Result<(), DiscardError> {
    if domain == Domain::Decision && !target.owned_resources.is_empty() {
        return Err(DiscardError::UnexpectedDecisionResources);
    }
    if !target.owned_resources.is_empty() && !confirmed {
        return Err(DiscardError::ResourceDeletionNotConfirmed);
    }
    let mut members = HashSet::new();
    for path in &target.owned_resources {
        if !members.insert(path) {
            return Err(DiscardError::DuplicateResource(path.clone()));
        }
    }
    Ok(())
}

fn validate_history(checks: DiscardChecks) -> Result<(), DiscardError> {
    match checks.history {
        History::Unavailable => return Err(DiscardError::HistoryUnavailable),
        History::Recorded if !checks.recorded_deletion_confirmed => {
            return Err(DiscardError::RecordedDeletionNotConfirmed);
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests;
