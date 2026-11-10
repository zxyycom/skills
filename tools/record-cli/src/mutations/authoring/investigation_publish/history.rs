use super::*;

pub(super) fn history_warnings(
    root: &Root,
    collection: &RelativePath,
    states: &BTreeMap<String, InvestigationState>,
    selected: &BTreeSet<String>,
) -> (Option<String>, Vec<String>) {
    let edges: Vec<_> = selected
        .iter()
        .filter_map(|id| states.get(id).map(|state| (id, state)))
        .flat_map(|(id, state)| state.relations.iter().map(move |relation| (id, relation)))
        .collect();
    if edges.is_empty() {
        return (None, vec![]);
    }
    let targets = edges
        .iter()
        .map(|(_, edge)| &edge.target)
        .collect::<BTreeSet<_>>();
    let (head, recorded) = match recorded_history(root, collection, &targets) {
        Ok(Some(value)) => value,
        Ok(None) => return (None, vec![]),
        Err(e) => {
            return (
                None,
                vec![format!(
                    "historical Investigation index unavailable: {e}; target: {}; inspect and restore the historical index or version-control access, then rerun the full check before relying on predecessor warnings",
                    collection.as_path().display()
                )],
            );
        }
    };
    let mut warnings: Vec<_> = edges
        .iter()
        .filter(|(_, edge)| !recorded.contains(&edge.target))
        .map(|(source, edge)| {
            format!(
                "前序报告 {} 尚未进入 Git HEAD，请确认 {} 的 {} 关系是否应保留为独立调查演进。",
                edge.target, source, edge.relation_type
            )
        })
        .collect();
    warnings.sort();
    warnings.dedup();
    (Some(head), warnings)
}

fn recorded_history(
    root: &Root,
    collection: &RelativePath,
    targets: &BTreeSet<&String>,
) -> Result<Option<(String, HashSet<String>)>, String> {
    use crate::git::{self, GitError, HeadState};
    let directory = root.path().join(collection.as_path());
    let repository = match git::discover_worktree(&directory) {
        Ok(repo) => repo,
        Err(GitError::NotRepository) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    let scope = directory
        .strip_prefix(&repository)
        .map_err(|e| e.to_string())?;
    let head = match git::probe_head(&repository).map_err(|e| e.to_string())? {
        HeadState::Unborn => return Ok(None),
        HeadState::Commit(head) => head,
    };
    let historical = historical_index(&repository, &head, scope)?;
    let recorded = recorded_targets(&repository, &head, scope, historical.as_ref(), targets)?;
    verify_head(&repository, &head)?;
    Ok(Some((head, recorded)))
}

fn verify_head(repository: &std::path::Path, head: &str) -> Result<(), String> {
    match crate::git::probe_head(repository).map_err(|e| e.to_string())? {
        crate::git::HeadState::Commit(current) if current == head => Ok(()),
        _ => Err("HEAD changed during historical lookup".into()),
    }
}

fn historical_index(
    repository: &std::path::Path,
    head: &str,
    scope: &std::path::Path,
) -> Result<Option<index::ValidatedIndex<InvestigationState>>, String> {
    use crate::git;
    let index_path = scope.join("investigation-index.json");
    match git::read_revision_file(repository, head, &index_path).map_err(|e| e.to_string())? {
        Some((0o100644 | 0o100755, bytes)) => Ok(Some(
            index::parse_index(&bytes, &Definition).map_err(|e| e.to_string())?,
        )),
        Some(_) => Err("historical index is not a regular file".into()),
        None => {
            let scopes = if scope.as_os_str().is_empty() {
                vec![]
            } else {
                vec![scope.to_path_buf()]
            };
            let files =
                git::list_revision_files(repository, head, &scopes).map_err(|e| e.to_string())?;
            if files.iter().any(|entry| {
                entry.path.strip_prefix(scope).ok().is_some_and(|path| {
                    path.components().count() == 1
                        && path
                            .to_str()
                            .and_then(|s| s.strip_suffix(".md"))
                            .is_some_and(domains::is_kebab)
                })
            }) {
                return Err("historical index missing for existing reports".into());
            }
            Ok(None)
        }
    }
}
fn recorded_targets(
    repository: &std::path::Path,
    head: &str,
    scope: &std::path::Path,
    historical: Option<&index::ValidatedIndex<InvestigationState>>,
    targets: &BTreeSet<&String>,
) -> Result<HashSet<String>, String> {
    use crate::git;
    let selected: Vec<_> = targets
        .iter()
        .filter_map(|&id| {
            historical
                .and_then(|index| index.index().entries.get(id))
                .map(|state| (id, scope.join(&state.source_path)))
        })
        .collect();
    let paths = selected
        .iter()
        .map(|(_, path)| path.clone())
        .collect::<Vec<_>>();
    let sources = match git::read_revision_files(repository, head, &paths) {
        Ok(sources) => sources,
        Err(batch_error) => {
            verify_sources_individually(repository, head, &selected)?;
            return Err(batch_error.to_string());
        }
    };
    let mut recorded = HashSet::new();
    for (id, path) in selected {
        verify_source(
            id,
            sources
                .get(&path)
                .map(|(mode, bytes)| (*mode, bytes.as_slice())),
        )?;
        recorded.insert(id.clone());
    }
    Ok(recorded)
}

fn verify_sources_individually(
    repository: &std::path::Path,
    head: &str,
    selected: &[(&String, std::path::PathBuf)],
) -> Result<(), String> {
    for (id, path) in selected {
        let source =
            crate::git::read_revision_file(repository, head, path).map_err(|e| e.to_string())?;
        verify_source(
            id,
            source
                .as_ref()
                .map(|(mode, bytes)| (*mode, bytes.as_slice())),
        )?;
    }
    Ok(())
}

fn verify_source(id: &str, source: Option<(u32, &[u8])>) -> Result<(), String> {
    let (mode, bytes) = source.ok_or_else(|| format!("historical source missing: {id}"))?;
    let text = std::str::from_utf8(bytes).map_err(|e| e.to_string())?;
    if !matches!(mode, 0o100644 | 0o100755)
        || domains::investigation::id_from_markdown(text).as_deref() != Some(id)
    {
        return Err(format!("historical identity unavailable: {id}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_head_history_is_a_warning_with_recovery() {
        let dir = tempfile::tempdir().unwrap();
        let collection = dir.path().join("investigations");
        std::fs::create_dir(&collection).unwrap();
        let git = |args: &[&str]| {
            let output = std::process::Command::new("git")
                .arg("-C")
                .arg(dir.path())
                .args(args)
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
        };
        let initialize_baseline = || {
            std::fs::copy(
                std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("tests/fixtures/history-invalid/investigations/index.txt"),
                collection.join("investigation-index.json"),
            )
            .unwrap();
            git(&["init", "-q"]);
            git(&["config", "user.name", "Fixture"]);
            git(&["config", "user.email", "fixture@example.invalid"]);
            git(&["add", "."]);
            git(&["commit", "-qm", "invalid baseline"]);
        };
        initialize_baseline();
        let root = source::open_root(dir.path()).unwrap();
        let state = InvestigationState {
            formed_at: String::new(),
            name: String::new(),
            question: String::new(),
            relations: vec![domains::Relation {
                relation_type: "修正".into(),
                target: "old".into(),
                summary: None,
            }],
            resource_ids: vec![],
            source_path: "new.md".into(),
            tags: vec![],
            title: String::new(),
        };
        let states = BTreeMap::from([("new".into(), state)]);
        let selected = BTreeSet::from(["new".into()]);
        let (head, warnings) = history_warnings(
            &root,
            &RelativePath::new("investigations").unwrap(),
            &states,
            &selected,
        );
        assert!(head.is_none());
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("historical Investigation index unavailable"));
        assert!(warnings[0].contains("target: investigations"));
        assert!(warnings[0].contains("rerun the full check"));
        assert!(!warnings[0].contains("--keep-unrecorded-history"));
    }
}
