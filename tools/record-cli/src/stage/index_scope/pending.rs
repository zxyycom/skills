use super::*;

pub(in crate::stage) fn decision_pending_basename<'a>(
    index_path: &std::path::Path,
    path: &'a std::path::Path,
) -> Option<&'a str> {
    let relative = path
        .strip_prefix(
            index_path
                .parent()
                .unwrap_or_else(|| std::path::Path::new("")),
        )
        .ok()?;
    let text = relative.to_str()?;
    let name = text.strip_prefix("archive/").unwrap_or(text);
    if name.contains('/') || name.contains('\\') {
        return None;
    }
    name.strip_suffix(".md").filter(|name| !name.is_empty())
}

pub(in crate::stage) fn in_scope(index_path: &RelativePath, path: &std::path::Path) -> bool {
    let scope = index_path
        .as_path()
        .parent()
        .unwrap_or_else(|| std::path::Path::new(""));
    path.starts_with(scope)
}
pub(in crate::stage) fn validate_scope(
    index_path: &RelativePath,
    snapshot: &git::PendingSnapshot,
) -> Result<(), IndexStageError> {
    let mut seen = BTreeSet::new();
    for entry in snapshot
        .entries
        .iter()
        .filter(|entry| in_scope(index_path, &entry.path))
    {
        if entry.stage != 0
            || !matches!(entry.mode, 0o100644 | 0o100755 | 0o120000)
            || !seen.insert(&entry.path)
        {
            return Err(IndexStageError::Selection(
                "pending domain has unresolved or unsupported file representation".into(),
            ));
        }
    }
    Ok(())
}

pub(in crate::stage) fn count_scope(
    index_path: &RelativePath,
    snapshot: &git::PendingSnapshot,
) -> usize {
    snapshot
        .entries
        .iter()
        .filter(|entry| in_scope(index_path, &entry.path))
        .map(|entry| &entry.path)
        .collect::<BTreeSet<_>>()
        .len()
}
/// Fixed historical and domain scope used to report preserved pending changes.
pub(in crate::stage) struct Preservation<'a> {
    pub root: &'a Root,
    pub revision: Option<&'a str>,
    pub index_path: &'a RelativePath,
    pub namespace: &'a str,
}

pub(in crate::stage) fn preserved_paths(
    context: Preservation<'_>,
    pending: &git::PendingSnapshot,
    updates: &[PathBuf],
) -> Result<Vec<PathBuf>, IndexStageError> {
    let Preservation {
        root,
        revision,
        index_path,
        namespace,
    } = context;
    let updated: BTreeSet<_> = updates.iter().collect();
    if namespace == "decisions" {
        return Ok(pending
            .entries
            .iter()
            .filter(|entry| in_scope(index_path, &entry.path) && !updated.contains(&entry.path))
            .map(|entry| entry.path.clone())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect());
    }
    changed_pending_paths(root, revision, index_path, pending, &updated)
}

/// Investigations report changes relative to fixed HEAD, including deletions.
fn changed_pending_paths(
    root: &Root,
    revision: Option<&str>,
    index_path: &RelativePath,
    pending: &git::PendingSnapshot,
    updated: &BTreeSet<&PathBuf>,
) -> Result<Vec<PathBuf>, IndexStageError> {
    let parent = index_path
        .as_path()
        .parent()
        .unwrap_or_else(|| std::path::Path::new(""));
    let scopes = if parent.as_os_str().is_empty() {
        vec![]
    } else {
        vec![parent.to_owned()]
    };
    let head = match revision {
        Some(revision) => git::list_revision_files(root.path(), revision, &scopes)
            .map_err(IndexStageError::Git)?,
        None => Vec::new(),
    };
    let mut before = std::collections::BTreeMap::new();
    for entry in head {
        before.insert(entry.path, (entry.mode, entry.oid, entry.stage));
    }
    let current = pending_representation(index_path, pending)?;
    let paths: BTreeSet<_> = before.keys().chain(current.keys()).cloned().collect();
    Ok(paths
        .into_iter()
        .filter(|path| !updated.contains(path) && before.get(path) != current.get(path))
        .collect())
}

/// Reject unresolved pending paths before comparing their representations with HEAD.
type Representation = std::collections::BTreeMap<PathBuf, (u32, String, u8)>;
fn pending_representation(
    index_path: &RelativePath,
    pending: &git::PendingSnapshot,
) -> Result<Representation, IndexStageError> {
    let mut current = std::collections::BTreeMap::new();
    for entry in pending
        .entries
        .iter()
        .filter(|entry| in_scope(index_path, &entry.path))
    {
        if current
            .insert(
                entry.path.clone(),
                (entry.mode, entry.oid.clone(), entry.stage),
            )
            .is_some()
        {
            return Err(IndexStageError::Selection(
                "pending domain contains unresolved paths".into(),
            ));
        }
    }
    Ok(current)
}

/// Pending membership and the optional validated index from the same capture.
pub(super) struct PendingIndex<S> {
    pub(super) pending: ContentSnapshot,
    pub(super) pending_index: Option<ValidatedIndex<S>>,
}

pub(super) fn capture_pending_index<D: DomainDefinition>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
    scope: StageScope,
) -> Result<PendingIndex<D::State>, IndexStageError> {
    let pending = match git::read_selected(&root.path, &[index_path.as_path().to_owned()]) {
        Ok(snapshot) => snapshot,
        Err(_) if scope == StageScope::Domain => {
            git::read_selected(&root.path, &[]).map_err(IndexStageError::Git)?
        }
        Err(error) => return Err(IndexStageError::Git(error)),
    };
    validate_scope(index_path, pending.membership())?;
    if let Some(entry) = pending
        .membership()
        .entries
        .iter()
        .find(|entry| entry.path == index_path.as_path())
        && scope != StageScope::Domain
        && !matches!(entry.mode, 0o100644 | 0o100755)
    {
        return Err(IndexStageError::Selection(
            "pending index is not a regular file".into(),
        ));
    }
    let pending_index = validated_pending_index(&pending, index_path, domain, scope)?;
    Ok(PendingIndex {
        pending,
        pending_index,
    })
}

/// Parse the selected pending index, allowing an unreadable index only in domain scope.
pub(in crate::stage) fn validated_pending_index<D: DomainDefinition>(
    pending: &ContentSnapshot,
    index_path: &RelativePath,
    domain: &D,
    scope: StageScope,
) -> Result<Option<ValidatedIndex<D::State>>, IndexStageError> {
    match pending
        .blobs()
        .iter()
        .find(|(path, _)| path == index_path.as_path())
    {
        Some((_, bytes)) => match checked_index(bytes, domain) {
            Ok(index) => Ok(Some(index)),
            Err(_) if scope == StageScope::Domain => Ok(None),
            Err(error) => Err(error),
        },
        None => Ok(None),
    }
}
