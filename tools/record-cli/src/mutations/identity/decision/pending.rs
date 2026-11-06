use super::*;
use crate::git::{self, GitError, HeadState, PendingEntry};
use std::path::Path;

#[derive(Debug, PartialEq, Eq)]
pub(super) struct Observation {
    head: HeadState,
    members: Vec<PendingEntry>,
}

fn inspection(error: impl std::fmt::Display) -> TxError {
    fail(
        "decision-records.rename-pending-stage-inspection-failed",
        format!(
            "Decision pending snapshot could not be inspected before rename: {error}. Correct the version-control failure, then retry rename; no files were changed."
        ),
    )
}
fn conflict() -> TxError {
    fail(
        "decision-records.rename-pending-stage-conflict",
        "Decision pending snapshot already contains collection files; inspect or resolve the Decision pending snapshot, then retry rename without relying on automatic staging.",
    )
}
fn scoped(entries: Vec<PendingEntry>, scope: &Path) -> Vec<PendingEntry> {
    let mut selected: Vec<_> = entries
        .into_iter()
        .filter(|entry| entry.path.starts_with(scope))
        .collect();
    selected.sort_by(|a, b| a.path.cmp(&b.path).then(a.stage.cmp(&b.stage)));
    selected
}

fn check_clean(
    repo: &Path,
    scope: &Path,
    head: &HeadState,
    pending: &[PendingEntry],
) -> Result<(), TxError> {
    let original = match head {
        HeadState::Unborn => Vec::new(),
        HeadState::Commit(oid) => {
            git::list_revision_files(repo, oid, &[scope.to_path_buf()]).map_err(inspection)?
        }
    };
    if pending != original {
        return Err(conflict());
    }
    Ok(())
}
fn observe(root: &Root, collection: &RelativePath) -> Result<Option<Observation>, TxError> {
    let directory = root.path().join(collection.as_path());
    let repo = match git::discover_worktree(&directory) {
        Ok(repo) => repo,
        Err(GitError::NotRepository) => return Ok(None),
        Err(error) => return Err(inspection(error)),
    };
    let head = git::probe_head(&repo).map_err(inspection)?;
    let scope = directory.strip_prefix(&repo).map_err(inspection)?;
    if scope.as_os_str().is_empty() {
        return Ok(None);
    }
    let members = scoped(git::read_pending(&repo).map_err(inspection)?.entries, scope);
    check_clean(&repo, scope, &head, &members)?;
    check_stable(&repo, scope, &head, &members)?;
    Ok(Some(Observation { head, members }))
}

fn check_stable(
    repo: &Path,
    scope: &Path,
    head: &HeadState,
    members: &[PendingEntry],
) -> Result<(), TxError> {
    let after = scoped(git::read_pending(repo).map_err(inspection)?.entries, scope);
    if members != after || git::probe_head(repo).map_err(inspection)? != *head {
        return Err(inspection("HEAD or pending changed during inspection"));
    }
    Ok(())
}

pub(super) fn capture(
    root: &Root,
    collection: &RelativePath,
    index: &RelativePath,
    expected_head: Option<&str>,
) -> Result<Option<Observation>, TxError> {
    let capture = observe(root, collection).and_then(|observation| {
        if let Some(current) = &observation {
            let head = match &current.head {
                HeadState::Commit(id) => Some(id.as_str()),
                HeadState::Unborn => None,
            };
            if head != expected_head {
                return Err(inspection("HEAD changed since historical capture"));
            }
        }
        Ok(observation)
    });
    capture.map_err(|error| {
        let recovery = if error.code == "decision-records.rename-pending-stage-conflict" {
            "Inspect or resolve the Decision pending snapshot, then retry rename without relying on automatic staging."
        } else { "Correct the version-control failure, then retry rename; no files were changed." };
        let diagnostic = crate::protocol::Diagnostic {
            code: error.code.clone(), message: error.message.clone(), path: None,
            target: Some(index.as_path().to_string_lossy().replace('\\', "/")),
            reason: Some(error.message.clone()), recovery: Some(recovery.into()), cause_category: None, operation: None, detail: None,
        };
        error.with_diagnostics(vec![diagnostic])
    })
}
