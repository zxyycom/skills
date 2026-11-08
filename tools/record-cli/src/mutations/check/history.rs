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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        domains::investigation::{Definition, InvestigationState},
        index::{IndexV4, Revision, build_index, serialize_index},
    };
    use std::{collections::BTreeMap, process::Command};

    fn state(name: &str) -> InvestigationState {
        InvestigationState {
            name: name.into(),
            title: "Title".into(),
            formed_at: "2026-01-01T00:00:00Z".into(),
            question: "Question".into(),
            tags: vec!["test".into()],
            relations: vec![],
            resource_ids: vec![],
            source_path: format!("{name}.md"),
        }
    }
    fn git(root: &std::path::Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    #[test]
    fn check_history_warns_only_for_unrecorded_direct_predecessors_or_unavailable_history() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path();
        git(path, &["init", "-q"]);
        git(path, &["config", "user.email", "test@example.invalid"]);
        git(path, &["config", "user.name", "Test"]);
        std::fs::create_dir(path.join("reports")).unwrap();
        std::fs::write(
            path.join("reports/a.md"),
            "---\ntitle: \"Title\"\nid: \"260101-a\"\n---\n",
        )
        .unwrap();
        std::fs::write(
            path.join("reports/unselected.md"),
            "unselected historical blob",
        )
        .unwrap();
        let hash = format!("sha256:{}", "a".repeat(64));
        let index = build_index(
            IndexV4 {
                schema_version: 4,
                namespace: "investigations".into(),
                definition_version: 11,
                metadata: serde_json::json!({}),
                source_revision: Revision {
                    metadata: hash.clone(),
                    entries: BTreeMap::from([("260101-a".into(), hash)]),
                },
                entries: BTreeMap::from([("260101-a".into(), state("a"))]),
            },
            &Definition,
        )
        .unwrap();
        std::fs::write(
            path.join("reports/investigation-index.json"),
            serialize_index(&index, &Definition).unwrap(),
        )
        .unwrap();
        git(path, &["add", "--all"]);
        git(path, &["commit", "-qm", "baseline"]);
        let mut b = state("b");
        b.relations.push(domains::Relation {
            relation_type: "补充".into(),
            target: "260101-a".into(),
            summary: None,
        });
        let mut c = state("c");
        c.relations.push(domains::Relation {
            relation_type: "补充".into(),
            target: "260101-b".into(),
            summary: None,
        });
        let states = BTreeMap::from([
            ("260101-a".into(), state("a")),
            ("260101-b".into(), b),
            ("260101-c".into(), c),
        ]);
        let root = crate::source::open_root(path).unwrap();
        let reports = RelativePath::new("reports").unwrap();
        let warnings = investigation_history_warnings(&root, &reports, &states);
        assert_eq!(warnings.len(), 1, "{warnings:?}");
        assert!(warnings[0].contains("260101-b"), "{warnings:?}");
        assert!(warnings[0].contains("260101-c"));
        let output = Command::new("git")
            .arg("-C")
            .arg(path)
            .args(["rev-parse", "HEAD:reports/unselected.md"])
            .output()
            .unwrap();
        assert!(output.status.success());
        let oid = String::from_utf8(output.stdout).unwrap();
        let oid = oid.trim();
        let object = path.join(".git/objects").join(&oid[..2]).join(&oid[2..]);
        let bytes = std::fs::read(&object).unwrap();
        std::fs::remove_file(&object).unwrap();
        let with_unreadable_unselected = investigation_history_warnings(&root, &reports, &states);
        assert_eq!(with_unreadable_unselected, warnings);
        std::fs::write(&object, bytes).unwrap();
        git(path, &["rm", "--", "reports/a.md"]);
        git(
            path,
            &["commit", "-qm", "missing selected historical source"],
        );
        let missing = investigation_history_warnings(&root, &reports, &states);
        assert_eq!(missing.len(), 1);
        assert!(missing[0].contains("history unavailable"));
        assert!(missing[0].contains("historical source missing: 260101-a"));
        assert!(!missing[0].contains("尚未进入"));
        std::fs::write(path.join("reports/investigation-index.json"), b"invalid").unwrap();
        git(path, &["add", "--all"]);
        git(path, &["commit", "-qm", "broken history"]);
        let warnings = investigation_history_warnings(&root, &reports, &states);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("history unavailable"));
        assert!(!warnings[0].contains("尚未进入"));
    }
}
