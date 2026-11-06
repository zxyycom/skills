//! Target allocation and history gate after domain-specific ID/date resolution.
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Location {
    DecisionActive,
    DecisionArchived,
    DecisionCandidate,
    InvestigationFormal,
    InvestigationCandidate,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum History {
    NotRecorded,
    Recorded,
    Unavailable,
}
/// The recorded state is observed independently of the user's confirmation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RenameHistoryCheck {
    pub history: History,
    pub recorded_rename_confirmed: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RenameIdentity {
    pub id: String,
    pub name: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RenameSource {
    pub id: String,
    pub source_path: String,
    pub location: Location,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RenamePlan {
    pub old_id: String,
    pub old_source_path: String,
    pub new_id: String,
    pub new_source_path: String,
    pub no_change: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RenameError {
    IdentityConflict(String),
    PathConflict,
    HistoryUnavailable,
    RecordedConfirmationRequired,
}

/// ID/date/name validity, complete visible identity discovery and safe path
/// membership are prerequisites. `occupied_paths` includes the source itself.
pub fn plan_rename(
    source: &RenameSource,
    target: &RenameIdentity,
    other_ids: &HashSet<String>,
    occupied_paths: &HashSet<String>,
    history_check: RenameHistoryCheck,
) -> Result<RenamePlan, RenameError> {
    if other_ids.contains(&target.id) {
        return Err(RenameError::IdentityConflict(target.id.clone()));
    }
    let new_source_path = allocate_path(source, target, occupied_paths)?;
    let no_change = source.id == target.id && source.source_path == new_source_path;
    if !no_change {
        match history_check.history {
            History::Unavailable => return Err(RenameError::HistoryUnavailable),
            History::Recorded if !history_check.recorded_rename_confirmed => {
                return Err(RenameError::RecordedConfirmationRequired);
            }
            _ => {}
        }
    }
    Ok(RenamePlan {
        old_id: source.id.clone(),
        old_source_path: source.source_path.clone(),
        new_id: target.id.clone(),
        new_source_path,
        no_change,
    })
}

fn allocate_path(
    source: &RenameSource,
    target: &RenameIdentity,
    occupied_paths: &HashSet<String>,
) -> Result<String, RenameError> {
    let path = |name: &str| match source.location {
        Location::DecisionArchived => format!("archive/{name}.md"),
        Location::DecisionActive | Location::DecisionCandidate | Location::InvestigationFormal => {
            format!("{name}.md")
        }
        Location::InvestigationCandidate => format!("_candidate.{name}"),
    };
    let available = |value: &str| value == source.source_path || !occupied_paths.contains(value);
    let name_path = path(&target.name);
    let id_path = path(&target.id);
    let new_source_path = if available(&name_path) {
        name_path
    } else if available(&id_path) {
        id_path
    } else {
        return Err(RenameError::PathConflict);
    };
    Ok(new_source_path)
}

#[cfg(test)]
mod tests;
