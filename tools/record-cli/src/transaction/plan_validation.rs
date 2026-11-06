//! Validate plan namespace, transitions, and commit marker before observing resources.
use super::*;
use std::collections::HashSet;

fn invalid(message: String) -> TxError {
    TxError::new("invalid-plan", message)
}
pub(super) fn validate<T>(
    plan: &Plan<T>,
    lock_path: &RelativePath,
) -> Result<HashSet<RelativePath>, TxError> {
    let paths = validate_paths(plan, lock_path)?;
    let reserved = validate_resources(plan, lock_path, &paths)?;
    validate_write_modes(plan)?;
    validate_commit(plan)?;
    Ok(reserved)
}
fn validate_paths<T>(
    plan: &Plan<T>,
    lock_path: &RelativePath,
) -> Result<HashSet<RelativePath>, TxError> {
    let mut paths = std::collections::HashSet::new();
    for path in plan
        .writes
        .iter()
        .map(|w| &w.path)
        .chain(plan.guards.iter().map(|g| &g.path))
    {
        if path == lock_path || !paths.insert(path.clone()) {
            return Err(invalid(format!(
                "duplicate or lock path: {}",
                path.as_path().display()
            )));
        }
    }
    // Distinct names can still designate the same inode (hard links).
    // Never let one planned write silently invalidate another proof.
    let mut identities = std::collections::HashSet::new();
    for expected in plan
        .writes
        .iter()
        .map(|w| &w.before)
        .chain(plan.guards.iter().map(|g| &g.before))
    {
        if let ExpectedFile::Present(snapshot) = expected
            && !identities.insert((snapshot.identity.device, snapshot.identity.inode))
        {
            return Err(invalid("aliased existing files in transaction plan".into()));
        }
    }

    Ok(paths)
}
fn validate_resources<T>(
    plan: &Plan<T>,
    lock_path: &RelativePath,
    paths: &HashSet<RelativePath>,
) -> Result<HashSet<RelativePath>, TxError> {
    let mut reserved = paths.clone();
    for intent in &plan.resources {
        let resource_paths = resource_paths(intent);
        if resource_paths
            .iter()
            .any(|path| *path == lock_path || paths.contains(*path))
        {
            return Err(invalid(
                "resource path overlaps lock, write or guard".into(),
            ));
        }
        reserved.extend(resource_paths.into_iter().cloned());
    }
    validate_move_namespaces(plan, paths)?;
    Ok(reserved)
}
fn resource_paths(intent: &ResourceIntent) -> Vec<&RelativePath> {
    match intent {
        ResourceIntent::CreateDirectory { path }
        | ResourceIntent::RemoveFile { path }
        | ResourceIntent::RemoveDirectory { path } => vec![path],
        ResourceIntent::CopyFile {
            source,
            destination,
        }
        | ResourceIntent::CreateDirectoryFrom {
            source,
            destination,
        }
        | ResourceIntent::MoveDirectory {
            source,
            destination,
        } => vec![source, destination],
    }
}
fn validate_move_namespaces<T>(
    plan: &Plan<T>,
    paths: &HashSet<RelativePath>,
) -> Result<(), TxError> {
    // A moved owner tree is indivisible: ordinary writes or other resource
    // intents cannot share its namespace during this transaction.
    for (index, intent) in plan.resources.iter().enumerate() {
        if let ResourceIntent::MoveDirectory {
            source,
            destination,
        } = intent
        {
            if source == destination || source.as_path().parent() != destination.as_path().parent()
            {
                return Err(invalid("directory move requires distinct siblings".into()));
            }
            let overlaps = |path: &RelativePath| {
                path.as_path().starts_with(source.as_path())
                    || path.as_path().starts_with(destination.as_path())
            };
            if paths.iter().any(overlaps) {
                return Err(invalid("directory move overlaps a write or guard".into()));
            }
            for (other_index, other) in plan.resources.iter().enumerate() {
                if index == other_index {
                    continue;
                }
                let affected = resource_paths(other);
                if affected.into_iter().any(overlaps) {
                    return Err(invalid(
                        "directory move overlaps another resource intent".into(),
                    ));
                }
            }
        }
    }

    Ok(())
}
// Validate representable mode transitions before any source is mutated.
fn validate_write_modes<T>(plan: &Plan<T>) -> Result<(), TxError> {
    for write in &plan.writes {
        if !valid_write_mode(write) {
            return Err(TxError::new(
                "not-implemented",
                "write mode or transition is invalid for this transaction",
            ));
        }
    }
    Ok(())
}
fn valid_write_mode(write: &WriteIntent) -> bool {
    match (&write.before, &write.after) {
        (ExpectedFile::Missing, None) => write.mode.is_none(),
        (ExpectedFile::Missing, Some(_)) => write.mode.is_some(),
        (ExpectedFile::Present(_), None) => write.mode.is_none(),
        (ExpectedFile::Present(before), Some(_)) => {
            write.mode.is_none()
                || matches!(write.mode, Some(WriteMode::Exact(mode)) if mode == exact_mode(before.identity.mode))
        }
    }
}
fn validate_commit<T>(plan: &Plan<T>) -> Result<(), TxError> {
    match &plan.commit_point {
        CommitPoint::NoCommit => validate_unchanged(plan),
        CommitPoint::PublishedIndex(path) => validate_publication(plan, path),
        CommitPoint::Created(path) | CommitPoint::Updated(path) | CommitPoint::Exited(path)
            if single_write_matches(plan, path) =>
        {
            Ok(())
        }
        CommitPoint::Renamed { old, new } if rename_matches(plan, old, new) => Ok(()),
        _ => Err(TxError::new(
            "not-implemented",
            "commit point requires conditional filesystem primitives",
        )),
    }
}
fn validate_unchanged<T>(plan: &Plan<T>) -> Result<(), TxError> {
    if !plan.resources.is_empty() {
        return Err(invalid("resource plan has no commit point".into()));
    }
    if plan.writes.iter().any(|w| match (&w.before, &w.after) {
        (ExpectedFile::Missing, None) => false,
        (ExpectedFile::Present(before), Some(after)) => before.bytes != *after,
        _ => true,
    }) {
        return Err(invalid("changed plan has no commit point".into()));
    }
    Ok(())
}
fn validate_publication<T>(plan: &Plan<T>, path: &RelativePath) -> Result<(), TxError> {
    if !plan.writes.iter().any(|w| {
        &w.path == path
            && match (&w.before, &w.after) {
                (ExpectedFile::Present(before), Some(after)) => before.bytes != *after,
                (ExpectedFile::Missing, Some(_)) => true,
                _ => false,
            }
    }) {
        return Err(invalid(
            "publication must be an actual changed index write".into(),
        ));
    }
    if plan.writes.last().map(|w| &w.path) != Some(path) {
        return Err(invalid("index publication must be the final write".into()));
    }
    Ok(())
}
fn single_write_matches<T>(plan: &Plan<T>, path: &RelativePath) -> bool {
    let [write] = plan.writes.as_slice() else {
        return false;
    };
    if write.path != *path {
        return false;
    }
    match (&plan.commit_point, &write.before, &write.after) {
        (CommitPoint::Created(_), ExpectedFile::Missing, Some(_)) => true,
        (CommitPoint::Updated(_), ExpectedFile::Present(before), Some(after)) => {
            before.bytes != *after
        }
        (CommitPoint::Exited(_), ExpectedFile::Present(_), None) => true,
        _ => false,
    }
}
fn rename_matches<T>(plan: &Plan<T>, old: &RelativePath, new: &RelativePath) -> bool {
    let [created, removed] = plan.writes.as_slice() else {
        return false;
    };
    created.path == *new
        && removed.path == *old
        && matches!(
            (&created.before, &created.after),
            (ExpectedFile::Missing, Some(_))
        )
        && matches!(
            (&removed.before, &removed.after),
            (ExpectedFile::Present(_), None)
        )
}
