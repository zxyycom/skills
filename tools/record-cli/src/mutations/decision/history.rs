//! Decision history facts for archive/evolution; Git and identity errors are not absence.
use crate::mutations::decision::lifecycle::rules::HistoryFact;
use crate::{
    git::{self, GitError, HeadState},
    source::{RelativePath, Root},
};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HistoryEvidence {
    pub head: Option<String>,
    pub facts: BTreeMap<String, HistoryFact>,
}
#[derive(Debug)]
pub enum HistoryError {
    Git(GitError),
    OutsideRepository,
    InvalidIndex(String),
    MissingIndexWithSources,
    InvalidHistoricalIdentity(String),
}
impl From<GitError> for HistoryError {
    fn from(value: GitError) -> Self {
        Self::Git(value)
    }
}
fn decision_path(relative: &Path) -> bool {
    use std::path::Component;
    let mut components = relative.components();
    let first = match components.next() {
        Some(Component::Normal(name)) => name,
        _ => return false,
    };
    let basename = if first == "archive" {
        match components.next() {
            Some(Component::Normal(name)) => name,
            _ => return false,
        }
    } else {
        first
    };
    if components.next().is_some() {
        return false;
    }
    basename
        .to_str()
        .and_then(|s| s.strip_suffix(".md"))
        .is_some_and(crate::domains::is_kebab)
}
/// `selected` contains resolved established IDs. A published history index
/// is the only locator for those IDs; an unindexed current path is not evidence
/// about its prior occupant. A missing index is empty only if no historical
/// Decision source exists anywhere in the collection namespace.
pub fn capture_history(
    root: &Root,
    collection: &RelativePath,
    selected: &BTreeMap<String, String>,
) -> Result<HistoryEvidence, HistoryError> {
    let HistoryRevision { repo, scope, head } = match history_base(root, collection)? {
        HistoryBase::NoHead(fact) => {
            return Ok(HistoryEvidence {
                head: None,
                facts: selected.keys().map(|id| (id.clone(), fact)).collect(),
            });
        }
        HistoryBase::Commit(revision) => revision,
    };
    let index = historical_index(&repo, &head, &scope)?;
    let mut facts = BTreeMap::new();
    for id in selected.keys() {
        let indexed = index.as_ref().and_then(|i| i.index().entries.get(id));
        let Some(indexed) = indexed else {
            facts.insert(id.clone(), HistoryFact::Unrecorded);
            continue;
        };
        let fact = historical_fact(&repo, &head, &scope, id, &indexed.source_path)?;
        facts.insert(id.clone(), fact);
    }
    match git::probe_head(&repo)? {
        HeadState::Commit(current) if current == head => {}
        _ => {
            return Err(HistoryError::Git(GitError::InvalidOutput(
                "HEAD changed during history capture",
            )));
        }
    }
    Ok(HistoryEvidence {
        head: Some(head),
        facts,
    })
}

struct HistoryRevision {
    repo: PathBuf,
    scope: PathBuf,
    head: String,
}
enum HistoryBase {
    NoHead(HistoryFact),
    Commit(HistoryRevision),
}
fn history_base(root: &Root, collection: &RelativePath) -> Result<HistoryBase, HistoryError> {
    let directory = root.path().join(collection.as_path());
    let repo = match git::discover_worktree(&directory) {
        Ok(path) => path,
        Err(GitError::NotRepository) => {
            return Ok(HistoryBase::NoHead(HistoryFact::NotApplicable));
        }
        Err(error) => return Err(error.into()),
    };
    let scope = directory
        .strip_prefix(&repo)
        .map_err(|_| HistoryError::OutsideRepository)?
        .to_path_buf();
    let head = match git::probe_head(&repo)? {
        HeadState::Unborn => {
            return Ok(HistoryBase::NoHead(HistoryFact::Unrecorded));
        }
        HeadState::Commit(oid) => oid,
    };
    Ok(HistoryBase::Commit(HistoryRevision { repo, scope, head }))
}

fn historical_fact(
    repo: &Path,
    head: &str,
    scope: &Path,
    id: &str,
    path: &str,
) -> Result<HistoryFact, HistoryError> {
    let safe = RelativePath::new(path)
        .map_err(|_| HistoryError::InvalidHistoricalIdentity(id.to_owned()))?;
    let entry_path: PathBuf = scope.join(safe.as_path());
    let fact = match git::read_revision_file(repo, head, &entry_path)? {
        None => return Err(HistoryError::InvalidHistoricalIdentity(id.to_owned())),
        Some((mode, bytes)) => {
            let text = std::str::from_utf8(&bytes)
                .map_err(|_| HistoryError::InvalidHistoricalIdentity(id.to_owned()))?;
            if !matches!(mode, 0o100644 | 0o100755)
                || crate::domains::decision::id_from_markdown(text).as_deref() != Some(id)
            {
                return Err(HistoryError::InvalidHistoricalIdentity(id.to_owned()));
            }
            HistoryFact::Recorded
        }
    };
    Ok(fact)
}

fn historical_index(
    repo: &Path,
    head: &str,
    scope: &Path,
) -> Result<
    Option<crate::index::ValidatedIndex<crate::domains::decision::DecisionState>>,
    HistoryError,
> {
    let index_path = scope.join("decision-index.json");
    let index = match git::read_revision_file(repo, head, &index_path)? {
        None => {
            let scopes = if scope.as_os_str().is_empty() {
                vec![]
            } else {
                vec![scope.to_path_buf()]
            };
            let files = git::list_revision_files(repo, head, &scopes)?;
            if files
                .iter()
                .any(|entry| entry.path.strip_prefix(scope).is_ok_and(decision_path))
            {
                return Err(HistoryError::MissingIndexWithSources);
            }
            None
        }
        Some((mode, bytes)) => {
            if !matches!(mode, 0o100644 | 0o100755) {
                return Err(HistoryError::InvalidIndex(
                    "HEAD index is not a regular file".into(),
                ));
            }
            let parsed = crate::index::parse_index(&bytes, &crate::domains::decision::Definition)
                .map_err(|e| HistoryError::InvalidIndex(e.to_string()))?;
            crate::index::QuerySnapshot::new(parsed.clone())
                .graph(&crate::domains::decision::Definition)
                .map_err(|e| HistoryError::InvalidIndex(e.to_string()))?;
            Some(parsed)
        }
    };
    Ok(index)
}

#[cfg(test)]
mod tests;
