use super::*;

/// Establish the fixed historical index without reading unselected blobs.
/// Decision root-level source paths are lifecycle-ambiguous (candidate and
/// formal use identical names); an index-less nonempty namespace fails closed.
pub(in crate::stage) fn historical_index<D: DomainDefinition>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
    revision: Option<&str>,
) -> Result<Option<ValidatedIndex<D::State>>, IndexStageError> {
    let Some(revision) = revision else {
        return Ok(None);
    };
    match git::read_revision_file(root.path(), revision, index_path.as_path())
        .map_err(IndexStageError::Git)?
    {
        Some((0o100644 | 0o100755, bytes)) => return checked_index(&bytes, domain).map(Some),
        Some(_) => {
            return Err(IndexStageError::Selection(
                "HEAD index is not a regular file".into(),
            ));
        }
        None => {}
    }
    verify_empty_history(root, index_path, domain.namespace(), revision)?;
    Ok(None)
}

/// Missing indexes are safe only when the fixed historical namespace is empty.
fn verify_empty_history(
    root: &Root,
    index_path: &RelativePath,
    namespace: &str,
    revision: &str,
) -> Result<(), IndexStageError> {
    let scope = index_path
        .as_path()
        .parent()
        .unwrap_or_else(|| std::path::Path::new(""));
    let scopes = if scope.as_os_str().is_empty() {
        Vec::new()
    } else {
        vec![scope.to_owned()]
    };
    let entries =
        git::list_revision_files(root.path(), revision, &scopes).map_err(IndexStageError::Git)?;
    let mut ambiguous = false;
    let mut formal = false;
    for entry in entries {
        match historical_entry(&entry, scope, namespace)? {
            HistoricalEntry::None => {}
            HistoricalEntry::Ambiguous => ambiguous = true,
            HistoricalEntry::Formal => formal = true,
        }
    }
    if formal || ambiguous {
        return Err(IndexStageError::HistoricalIndexMissing {
            namespace_indeterminate: !formal,
        });
    }
    Ok(())
}

/// Classify historical paths without loading unselected source payloads.
enum HistoricalEntry {
    None,
    Ambiguous,
    Formal,
}
fn historical_entry(
    entry: &git::PendingEntry,
    scope: &std::path::Path,
    namespace: &str,
) -> Result<HistoricalEntry, IndexStageError> {
    let relative = entry
        .path
        .strip_prefix(scope)
        .map_err(|_| IndexStageError::Selection("historical path outside domain".into()))?;
    let parts: Vec<_> = relative
        .components()
        .map(|part| part.as_os_str().to_str())
        .collect();
    let valid = |name: &str| {
        name.strip_suffix(".md")
            .is_some_and(crate::domains::is_kebab)
    };
    Ok(match (namespace, parts.as_slice()) {
        ("decisions", [Some(name)]) if valid(name) => HistoricalEntry::Ambiguous,
        ("decisions", [Some("archive"), Some(name)]) if valid(name) => HistoricalEntry::Ambiguous,
        ("investigations", [Some(name)]) if valid(name) => {
            if matches!(entry.mode, 0o100644 | 0o100755) {
                HistoricalEntry::Formal
            } else {
                HistoricalEntry::Ambiguous
            }
        }
        _ => HistoricalEntry::None,
    })
}

/// Resolve a fixed HEAD and its validated historical index for a stage operation.
type StageBaseline<S> = (Option<String>, Option<ValidatedIndex<S>>);
pub(in crate::stage) fn capture_baseline<D: DomainDefinition>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
) -> Result<StageBaseline<D::State>, IndexStageError> {
    git::verify_worktree_root(root.path()).map_err(IndexStageError::Git)?;
    let revision = match git::probe_head(root.path()).map_err(IndexStageError::Git)? {
        git::HeadState::Commit(oid) => Some(oid),
        git::HeadState::Unborn => None,
    };
    let index = historical_index(root, index_path, domain, revision.as_deref())?;
    Ok((revision, index))
}
