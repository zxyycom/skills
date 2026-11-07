//! Candidate creation allocation after domain input and identity validation.
//! The returned path is an intention, not proof of an exclusive create.
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Domain {
    Decision,
    Investigation,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidateIdentity {
    /// Complete domain-validated dated ID, already bound to captured UTC time.
    pub id: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidatePlan {
    pub id: String,
    pub source_path: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CandidatePlanError {
    IdentityConflict(String),
    PathConflict(String),
    InvalidIdentity,
}

/// `visible_ids` and `occupied_paths` come from safe discovery in this phase;
/// actual creation remains exclusive and cannot overwrite an existing file.
pub fn plan_creation(
    domain: Domain,
    identity: &CandidateIdentity,
    visible_ids: &HashSet<String>,
    occupied_paths: &HashSet<String>,
) -> Result<CandidatePlan, CandidatePlanError> {
    let id = &identity.id;
    if id.is_empty()
        || !id.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
    {
        return Err(CandidatePlanError::InvalidIdentity);
    }
    if visible_ids.contains(id) {
        return Err(CandidatePlanError::IdentityConflict(id.clone()));
    }
    let source_path = match domain {
        Domain::Decision => format!("{id}.md"),
        Domain::Investigation => format!("_candidate.{id}"),
    };
    if occupied_paths.contains(&source_path) {
        return Err(CandidatePlanError::PathConflict(source_path));
    }
    Ok(CandidatePlan {
        id: id.clone(),
        source_path,
    })
}

#[cfg(test)]
mod tests;
