//! Git-visible resource IDs and their owner grouping for one read phase.
use super::*;
use crate::git::{self, GitError};

type Membership = (Option<HashSet<String>>, HashMap<String, Vec<String>>);

pub(super) fn capture(root: &Root, directory: &str) -> Result<Membership, CommandError> {
    let failure = |e: String| CommandError::new("candidate-resource-read-failed", e);
    let collection = root.path().join(directory);
    let repo = match git::discover_worktree(&collection) {
        Ok(repo) => repo,
        Err(GitError::NotRepository) => return Ok((None, HashMap::new())),
        Err(error) => return Err(failure(error.to_string())),
    };
    let canonical = std::fs::canonicalize(&collection).map_err(|e| failure(e.to_string()))?;
    let scope = canonical
        .strip_prefix(&repo)
        .map_err(|_| failure("resource root outside worktree".into()))?
        .join("_resources");
    let paths = git::list_repository_workspace_files(&repo, std::slice::from_ref(&scope))
        .map_err(|e| failure(e.to_string()))?;
    let mut members = HashSet::new();
    let mut by_owner: HashMap<String, Vec<String>> = HashMap::new();
    for path in paths {
        let id = resource_id(&path, &scope)?;
        if members.insert(id.clone())
            && let Some((owner, _)) = id.split_once('/')
        {
            by_owner.entry(owner.to_owned()).or_default().push(id);
        }
    }
    Ok((Some(members), by_owner))
}

/// Convert a Git path within the requested scope to a resource identifier.
fn resource_id(path: &std::path::Path, scope: &std::path::Path) -> Result<String, CommandError> {
    let failure = |e: String| CommandError::new("candidate-resource-read-failed", e);
    let relative = path
        .strip_prefix(scope)
        .map_err(|_| failure("resource membership escaped scope".into()))?;
    let id = relative
        .to_str()
        .ok_or_else(|| failure("resource path is not Unicode".into()))?;
    Ok(id.replace('\\', "/"))
}
