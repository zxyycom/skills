use super::{
    CommitPoint, ExpectedFile, Plan, RelativePath, ResourceIntent, TxError, write_changes,
};
use std::collections::HashSet;

pub(super) fn validate<T>(plan: &Plan<T>) -> Result<(), TxError> {
    let mut paths = HashSet::new();
    if plan.writes.iter().any(|w| !paths.insert(&w.path)) {
        return Err(TxError::new("invalid-plan", "duplicate write path"));
    }
    for intent in &plan.resources {
        if let ResourceIntent::MoveDirectory {
            source,
            destination,
        } = intent
            && (source == destination
                || source.as_path().parent() != destination.as_path().parent())
        {
            return Err(TxError::new(
                "invalid-plan",
                "directory move requires distinct siblings",
            ));
        }
    }
    if let CommitPoint::PublishedIndex(path) = &plan.commit_point
        && plan.writes.last().map(|w| &w.path) != Some(path)
    {
        return Err(TxError::new(
            "invalid-plan",
            "index publication must be final",
        ));
    }
    if !commit_matches(plan) {
        return Err(TxError::new(
            "invalid-plan",
            "commit point does not match planned changes",
        ));
    }
    Ok(())
}
fn commit_matches<T>(plan: &Plan<T>) -> bool {
    match &plan.commit_point {
        CommitPoint::NoCommit => {
            plan.resources.is_empty() && !plan.writes.iter().any(write_changes)
        }
        CommitPoint::Created(path) => plan.writes.iter().any(|w| {
            &w.path == path && matches!((&w.before, &w.after), (ExpectedFile::Missing, Some(_)))
        }),
        CommitPoint::Updated(path) | CommitPoint::PublishedIndex(path) => plan
            .writes
            .iter()
            .any(|w| &w.path == path && w.after.is_some() && write_changes(w)),
        CommitPoint::Exited(path) => plan.writes.iter().any(|w| {
            &w.path == path && matches!((&w.before, &w.after), (ExpectedFile::Present(_), None))
        }),
        CommitPoint::Renamed { old, new } => renamed_writes(plan, old, new),
    }
}
fn renamed_writes<T>(plan: &Plan<T>, old: &RelativePath, new: &RelativePath) -> bool {
    plan.writes.iter().any(|w| {
        &w.path == new && matches!((&w.before, &w.after), (ExpectedFile::Missing, Some(_)))
    }) && plan.writes.iter().any(|w| {
        &w.path == old && matches!((&w.before, &w.after), (ExpectedFile::Present(_), None))
    })
}
