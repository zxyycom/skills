use super::*;

pub(super) fn investigation_history_warnings(
    root: &Root,
    directory: &RelativePath,
    states: &BTreeMap<String, domains::investigation::InvestigationState>,
) -> Vec<String> {
    let relations: Vec<_> = states
        .iter()
        .flat_map(|(source, state)| {
            state
                .relations
                .iter()
                .map(move |relation| (source, relation))
        })
        .collect();
    if relations.is_empty() {
        return vec![];
    }
    let targets: Vec<_> = relations
        .iter()
        .map(|(_, relation)| relation.target.as_str())
        .collect();
    match recorded_history(root, directory, &targets) {
        Ok(None) => vec![],
        Err(e) => vec![format!("Investigation history unavailable: {e}")],
        Ok(Some(recorded)) => relations
            .into_iter()
            .filter(|(_, relation)| !recorded.contains(&relation.target))
            .map(|(source, relation)| {
                format!(
                    "前序报告 {} 尚未进入 Git HEAD，请确认 {} 的 {} 关系是否应保留为独立调查演进。",
                    relation.target, source, relation.relation_type
                )
            })
            .collect(),
    }
}

fn recorded_history(
    root: &Root,
    directory: &RelativePath,
    targets: &[&str],
) -> Result<Option<HashSet<String>>, String> {
    let Some(revision) = recorded_revision(root, directory)? else {
        return Ok(None);
    };
    let RecordedRevision { repo, scope, head } = revision;
    use crate::git::{self, HeadState};
    let historical = historical_index(&repo, &head, &scope)?;
    let mut recorded = HashSet::new();
    for target in targets {
        // A verified source belongs to this fixed HEAD; warnings remain per relation.
        if recorded.contains(*target) {
            continue;
        }
        if let Some(state) = historical
            .as_ref()
            .and_then(|index| index.index().entries.get(*target))
        {
            verify_historical_source(&repo, &head, &scope, target, &state.source_path)?;
            recorded.insert((*target).to_owned());
        }
    }
    match git::probe_head(&repo).map_err(|e| e.to_string())? {
        HeadState::Commit(current) if current == head => Ok(Some(recorded)),
        _ => Err("HEAD changed during historical lookup".into()),
    }
}

struct RecordedRevision {
    repo: std::path::PathBuf,
    scope: std::path::PathBuf,
    head: String,
}
fn recorded_revision(
    root: &Root,
    directory: &RelativePath,
) -> Result<Option<RecordedRevision>, String> {
    use crate::git::{self, GitError, HeadState};
    let collection = root.path().join(directory.as_path());
    let repo = match git::discover_worktree(&collection) {
        Ok(repo) => repo,
        Err(GitError::NotRepository) => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    let scope = collection
        .strip_prefix(&repo)
        .map_err(|error| error.to_string())?
        .to_path_buf();
    let head = match git::probe_head(&repo).map_err(|error| error.to_string())? {
        HeadState::Unborn => return Ok(None),
        HeadState::Commit(head) => head,
    };
    Ok(Some(RecordedRevision { repo, scope, head }))
}

fn verify_historical_source(
    repo: &std::path::Path,
    head: &str,
    scope: &std::path::Path,
    target: &str,
    source_path: &str,
) -> Result<(), String> {
    let path = scope.join(source_path);
    let Some((mode, bytes)) =
        crate::git::read_revision_file(repo, head, &path).map_err(|e| e.to_string())?
    else {
        return Err(format!("historical source missing: {target}"));
    };
    let text = std::str::from_utf8(&bytes).map_err(|e| e.to_string())?;
    if !matches!(mode, 0o100644 | 0o100755)
        || domains::investigation::id_from_markdown(text).as_deref() != Some(target)
    {
        return Err(format!("historical source identity unavailable: {target}"));
    }
    Ok(())
}

fn historical_index(
    repo: &std::path::Path,
    head: &str,
    scope: &std::path::Path,
) -> Result<Option<crate::index::ValidatedIndex<domains::investigation::InvestigationState>>, String>
{
    use crate::git;
    Ok(
        match git::read_revision_file(repo, head, &scope.join("investigation-index.json"))
            .map_err(|e| e.to_string())?
        {
            Some((mode, bytes)) => {
                if !matches!(mode, 0o100644 | 0o100755) {
                    return Err("historical index is not a regular file".into());
                }
                Some(
                    crate::index::parse_index(&bytes, &domains::investigation::Definition)
                        .map_err(|e| e.to_string())?,
                )
            }
            None => {
                require_no_historical_reports(repo, head, scope)?;
                None
            }
        },
    )
}

fn require_no_historical_reports(
    repo: &std::path::Path,
    head: &str,
    scope: &std::path::Path,
) -> Result<(), String> {
    let scopes = if scope.as_os_str().is_empty() {
        vec![]
    } else {
        vec![scope.to_path_buf()]
    };
    let files = crate::git::list_revision_files(repo, head, &scopes).map_err(|e| e.to_string())?;
    let has_formal = files.iter().any(|entry| {
        entry
            .path
            .strip_prefix(scope)
            .ok()
            .and_then(|p| p.to_str())
            .is_some_and(|path| path.strip_suffix(".md").is_some_and(domains::is_kebab))
    });
    if has_formal {
        Err("historical Investigation index is missing for existing reports".into())
    } else {
        Ok(())
    }
}
