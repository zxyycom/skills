//! Pure lifecycle transitions; caller owns source, history and transaction proofs.
use crate::mutations::contract::Alignment;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Active,
    Archived,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct EstablishedLifecycle {
    pub status: Status,
    pub alignment: Alignment,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LifecycleAction {
    Archive,
    Reactivate(Alignment),
    MarkAligned,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LifecycleError {
    AlreadyArchived,
    RequiresArchived,
    RequiresActiveUnaligned,
}

pub fn transition(
    current: EstablishedLifecycle,
    action: LifecycleAction,
) -> Result<EstablishedLifecycle, LifecycleError> {
    match action {
        LifecycleAction::Archive if current.status == Status::Active => Ok(EstablishedLifecycle {
            status: Status::Archived,
            alignment: current.alignment,
        }),
        LifecycleAction::Archive => Err(LifecycleError::AlreadyArchived),
        LifecycleAction::Reactivate(alignment) if current.status == Status::Archived => {
            Ok(EstablishedLifecycle {
                status: Status::Active,
                alignment,
            })
        }
        LifecycleAction::Reactivate(_) => Err(LifecycleError::RequiresArchived),
        LifecycleAction::MarkAligned
            if current.status == Status::Active && current.alignment == Alignment::Unaligned =>
        {
            Ok(EstablishedLifecycle {
                status: Status::Active,
                alignment: Alignment::Aligned,
            })
        }
        LifecycleAction::MarkAligned => Err(LifecycleError::RequiresActiveUnaligned),
    }
}

#[cfg(test)]
mod tests;

/// Established record projected from a validated index and a matched source.
/// The caller must independently prove the source revision and path safety.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LifecycleRecord {
    pub id: String,
    pub source_path: String,
    pub created_at: String,
    pub lifecycle: EstablishedLifecycle,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HistoryFact {
    Recorded,
    Unrecorded,
    NotApplicable,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LifecycleEdit {
    pub id: String,
    pub source_path: String,
    pub target_path: String,
    pub created_at: String,
    pub before: EstablishedLifecycle,
    pub after: EstablishedLifecycle,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LifecyclePlanError {
    EmptySelection,
    RequiresSingleSelection,
    DuplicateId(String),
    InvalidSourcePath(String),
    InvalidTransition { id: String, cause: LifecycleError },
    HistoryUnavailable(String),
    HistoryConfirmationRequired(String),
}

/// Plans a multi-record archive or a single-record transition without writing.
/// `history` must be derived from the applicable HEAD index, not guessed from
/// absence of a blob; only archive consumes it.
pub fn plan_lifecycle(
    selected: &[(LifecycleRecord, HistoryFact)],
    action: LifecycleAction,
    keep_unrecorded_history: bool,
) -> Result<Vec<LifecycleEdit>, LifecyclePlanError> {
    if selected.is_empty() {
        return Err(LifecyclePlanError::EmptySelection);
    }
    if action != LifecycleAction::Archive && selected.len() != 1 {
        return Err(LifecyclePlanError::RequiresSingleSelection);
    }
    let mut seen = std::collections::HashSet::new();
    let mut edits = Vec::with_capacity(selected.len());
    for (record, _) in selected {
        if !seen.insert(record.id.as_str()) {
            return Err(LifecyclePlanError::DuplicateId(record.id.clone()));
        }
        edits.push(plan_record(record, action)?);
    }
    if action == LifecycleAction::Archive {
        verify_archive_history(selected, keep_unrecorded_history)?;
    }
    Ok(edits)
}

fn verify_archive_history(
    selected: &[(LifecycleRecord, HistoryFact)],
    keep_unrecorded_history: bool,
) -> Result<(), LifecyclePlanError> {
    for (record, history) in selected {
        match history {
            HistoryFact::Unavailable => {
                return Err(LifecyclePlanError::HistoryUnavailable(record.id.clone()));
            }
            HistoryFact::Unrecorded if !keep_unrecorded_history => {
                return Err(LifecyclePlanError::HistoryConfirmationRequired(
                    record.id.clone(),
                ));
            }
            _ => {}
        }
    }
    Ok(())
}

fn plan_record(
    record: &LifecycleRecord,
    action: LifecycleAction,
) -> Result<LifecycleEdit, LifecyclePlanError> {
    let after = transition(record.lifecycle, action).map_err(|cause| {
        LifecyclePlanError::InvalidTransition {
            id: record.id.clone(),
            cause,
        }
    })?;
    let target_path = lifecycle_path(record, after.status)?;
    Ok(LifecycleEdit {
        id: record.id.clone(),
        source_path: record.source_path.clone(),
        target_path,
        created_at: record.created_at.clone(),
        before: record.lifecycle,
        after,
    })
}

fn lifecycle_path(
    record: &LifecycleRecord,
    target_status: Status,
) -> Result<String, LifecyclePlanError> {
    let basename = record
        .source_path
        .strip_prefix("archive/")
        .unwrap_or(&record.source_path);
    let name = basename
        .strip_suffix(".md")
        .ok_or_else(|| LifecyclePlanError::InvalidSourcePath(record.source_path.clone()))?;
    if name.is_empty()
        || !name.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
    {
        return Err(LifecyclePlanError::InvalidSourcePath(
            record.source_path.clone(),
        ));
    }
    if (record.lifecycle.status == Status::Archived) != record.source_path.starts_with("archive/") {
        return Err(LifecyclePlanError::InvalidSourcePath(
            record.source_path.clone(),
        ));
    }
    let target_path = if target_status == Status::Archived {
        format!("archive/{basename}")
    } else {
        basename.to_owned()
    };
    Ok(target_path)
}

#[cfg(test)]
#[path = "rules/tests/plan_tests.rs"]
mod plan_tests;
