use super::*;
use crate::git::{self, GitError, HeadState};
use std::path::Path;

type HistoricalIndex = crate::index::ValidatedIndex<investigation::InvestigationState>;

struct History<'a> {
    repo: &'a Path,
    scope: &'a Path,
    head: &'a str,
}

impl History<'_> {
    fn index(&self) -> Result<Option<HistoricalIndex>, TxError> {
        match git::read_revision_file(
            self.repo,
            self.head,
            &self.scope.join("investigation-index.json"),
        )
        .map_err(|e| fail("history", e))?
        {
            Some((0o100644 | 0o100755, bytes)) => {
                let index = crate::index::parse_index(&bytes, &Definition)
                    .map_err(|e| fail("history-index", e))?;
                crate::index::QuerySnapshot::new(index.clone())
                    .graph(&Definition)
                    .map_err(|e| fail("history-index", e))?;
                Ok(Some(index))
            }
            Some(_) => Err(fail(
                "history-index",
                "historical index is not a regular file",
            )),
            None => {
                self.require_no_unindexed_formal()?;
                Ok(None)
            }
        }
    }

    fn require_no_unindexed_formal(&self) -> Result<(), TxError> {
        let scopes = if self.scope.as_os_str().is_empty() {
            vec![]
        } else {
            vec![self.scope.to_path_buf()]
        };
        let files = git::list_revision_files(self.repo, self.head, &scopes)
            .map_err(|e| fail("history", e))?;
        if files.iter().any(|e| {
            e.path
                .strip_prefix(self.scope)
                .ok()
                .and_then(|p| p.to_str())
                .is_some_and(|p| {
                    !p.contains(['/', '\\'])
                        && p.ends_with(".md")
                        && domains::is_kebab(p.trim_end_matches(".md"))
                })
        }) {
            return Err(fail(
                "history-index",
                "historical formal source exists without index",
            ));
        }
        Ok(())
    }

    fn indexed(&self, index: Option<&HistoricalIndex>, id: &str) -> Result<bool, TxError> {
        let Some(state) = index.and_then(|v| v.index().entries.get(id)) else {
            return Ok(false);
        };
        let path = RelativePath::new(&state.source_path).map_err(|e| fail("history", e))?;
        let (mode, bytes) =
            git::read_revision_file(self.repo, self.head, &self.scope.join(path.as_path()))
                .map_err(|e| fail("history", e))?
                .ok_or_else(|| fail("history", "historical indexed source missing"))?;
        if !matches!(mode, 0o100644 | 0o100755)
            || investigation::id_from_markdown(
                std::str::from_utf8(&bytes).map_err(|e| fail("history", e))?,
            )
            .as_deref()
                != Some(id)
        {
            return Err(fail("history", "historical indexed identity invalid"));
        }
        Ok(true)
    }

    fn candidate(&self, id: &str, path: &str) -> Result<bool, TxError> {
        let Some((mode, bytes)) =
            git::read_revision_file(self.repo, self.head, &self.scope.join(path))
                .map_err(|e| fail("history", e))?
        else {
            return Ok(false);
        };
        if !matches!(mode, 0o100644 | 0o100755) {
            return Err(fail("history", "historical candidate not a file"));
        }
        let text = std::str::from_utf8(&bytes).map_err(|e| fail("history", e))?;
        let old = investigation::candidate_header(text)
            .map_err(|e| fail("history", e))?
            .ok_or_else(|| fail("history", "historical candidate identity invalid"))?;
        Ok(old == id)
    }

    fn recorded(&self, id: &str, path: &str, candidate: bool) -> Result<bool, TxError> {
        let index = self.index()?;
        let mut recorded = self.indexed(index.as_ref(), id)?;
        if candidate {
            recorded |= self.candidate(id, path)?;
        }
        recorded |= self.resources(id)?;
        Ok(recorded)
    }
    fn resources(&self, id: &str) -> Result<bool, TxError> {
        let scopes = vec![self.scope.join("_resources").join(id)];
        Ok(!git::list_revision_files(self.repo, self.head, &scopes)
            .map_err(|e| fail("history", e))?
            .is_empty())
    }
}

pub(super) fn history(
    root: &Root,
    c: &RelativePath,
    id: &str,
    path: &str,
    candidate: bool,
) -> Result<(Option<String>, bool), TxError> {
    let dir = root.path().join(c.as_path());
    let repo = match git::discover_worktree(&dir) {
        Ok(v) => v,
        Err(GitError::NotRepository) => return Ok((None, false)),
        Err(e) => return Err(fail("history", e)),
    };
    let scope = dir.strip_prefix(&repo).map_err(|e| fail("history", e))?;
    let head = match git::probe_head(&repo).map_err(|e| fail("history", e))? {
        HeadState::Unborn => return Ok((None, false)),
        HeadState::Commit(v) => v,
    };
    let facts = History {
        repo: &repo,
        scope,
        head: &head,
    };
    let recorded = facts.recorded(id, path, candidate)?;
    if git::probe_head(&repo).map_err(|e| fail("history", e))? != HeadState::Commit(head.clone()) {
        return Err(fail("history", "HEAD changed during capture"));
    }
    Ok((Some(head), recorded))
}
