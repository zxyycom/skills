use super::*;

pub(crate) fn history(
    root: &Root,
    c: &RelativePath,
    id: &str,
    path: &str,
    candidate: bool,
) -> Result<(Option<String>, bool), TxError> {
    let historical = crate::mutations::decision::history::capture_history(
        root,
        c,
        &BTreeMap::from([(id.into(), path.into())]),
    )
    .map_err(|e| fail("history", format!("{e:?}")))?;
    let indexed = matches!(
        historical.facts[id],
        crate::mutations::decision::lifecycle::rules::HistoryFact::Recorded
    );
    if !candidate || historical.head.is_none() || indexed {
        return Ok((historical.head, indexed));
    }
    candidate_history(root, c, id, path, historical.head.as_deref())
}

fn candidate_history(
    root: &Root,
    c: &RelativePath,
    id: &str,
    path: &str,
    expected_head: Option<&str>,
) -> Result<(Option<String>, bool), TxError> {
    let directory = root.path().join(c.as_path());
    let repo = match crate::git::discover_worktree(&directory) {
        Ok(r) => r,
        Err(crate::git::GitError::NotRepository) => return Ok((None, false)),
        Err(e) => return Err(fail("history", e)),
    };
    let head = match crate::git::probe_head(&repo).map_err(|e| fail("history", e))? {
        crate::git::HeadState::Unborn => return Ok((None, false)),
        crate::git::HeadState::Commit(h) => h,
    };
    if expected_head != Some(&head) {
        return Err(fail(
            "history",
            "HEAD changed during historical identity capture",
        ));
    }
    let scope = directory
        .strip_prefix(&repo)
        .map_err(|e| fail("history", e))?;
    let recorded = candidate_at_head(&repo, &head, &scope.join(path), id)?;
    if crate::git::probe_head(&repo).map_err(|e| fail("history", e))?
        != crate::git::HeadState::Commit(head.clone())
    {
        return Err(fail("history", "HEAD changed during observation"));
    }
    Ok((Some(head), recorded))
}

fn candidate_at_head(
    repo: &std::path::Path,
    head: &str,
    path: &std::path::Path,
    id: &str,
) -> Result<bool, TxError> {
    match crate::git::read_revision_file(repo, head, path).map_err(|e| fail("history", e))? {
        None => Ok(false),
        Some((0o100644 | 0o100755, bytes)) => {
            let text = std::str::from_utf8(&bytes).map_err(|e| fail("history", e))?;
            let historical_id = decision::id_from_markdown(text)
                .ok_or_else(|| fail("history", "historical candidate identity is unavailable"))?;
            Ok(historical_id == id)
        }
        Some(_) => Err(fail(
            "history",
            "historical candidate is not a regular file",
        )),
    }
}
