//! Capture and validate selected source documents against the phase's index and Git evidence.
use super::{
    FreshnessError, StageScope,
    index_scope::{IndexStageError, Phase, checked_index, validated_pending_index},
};
use crate::{
    git::{self, ContentSnapshot, publish::PendingFile},
    index::{DomainDefinition, ValidatedIndex},
    source::{self, ExpectedFile, RelativePath, Root},
};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
};

type Paths = BTreeMap<PathBuf, BTreeSet<String>>;
type Verify<S> =
    fn(&source::SourceSnapshot, &str, &S, &ValidatedIndex<S>) -> Result<(), IndexStageError>;
type Updates = BTreeMap<PathBuf, Option<PendingFile>>;
type Sources = Vec<(RelativePath, ExpectedFile)>;
type IndexPair<S> = (ValidatedIndex<S>, Option<ValidatedIndex<S>>);

pub(super) enum FileMode {
    Fixed,
    Git(bool),
}

pub(super) struct SourceCapture<'a, S> {
    pub root: &'a Root,
    pub index_path: &'a RelativePath,
    pub workspace: &'a ValidatedIndex<S>,
    pub ids: &'a BTreeSet<&'a str>,
    pub paths: &'a Paths,
    pub selected_paths: &'a [PathBuf],
    pub pending: &'a ContentSnapshot,
    pub source_path: fn(&S) -> &str,
    pub verify: Verify<S>,
    pub identity: fn(&str) -> Option<String>,
    pub mode: FileMode,
}

pub(super) fn path_in_domain(
    index_path: &Path,
    source_path: &str,
) -> Result<PathBuf, IndexStageError> {
    let rel = index_path
        .parent()
        .unwrap_or_else(|| Path::new(""))
        .join(source_path);
    RelativePath::new(&rel).map_err(IndexStageError::Source)?;
    Ok(rel)
}

impl<S> SourceCapture<'_, S> {
    pub fn capture(&self) -> Result<(Updates, Sources), IndexStageError> {
        let mut updates = Updates::new();
        let mut sources = Vec::new();
        for path in self.selected_paths {
            let (relative, snapshot, update) = self.capture_one(path)?;
            updates.insert(path.clone(), update);
            sources.push((relative, snapshot));
        }
        Ok((updates, sources))
    }

    fn capture_one(
        &self,
        path: &PathBuf,
    ) -> Result<(RelativePath, ExpectedFile, Option<PendingFile>), IndexStageError> {
        let relative = RelativePath::new(path).map_err(IndexStageError::Source)?;
        let snapshot = source::capture(self.root, &relative).map_err(IndexStageError::Source)?;
        let owner = self.workspace.index().entries.iter().find(|(id, state)| {
            self.ids.contains(id.as_str())
                && path_in_domain(self.index_path.as_path(), (self.source_path)(state))
                    .ok()
                    .as_ref()
                    == Some(path)
        });
        let update = match (owner, &snapshot) {
            (Some((id, state)), ExpectedFile::Present(source)) => {
                Some(self.project_source(source, id, state)?)
            }
            (None, ExpectedFile::Missing) => None,
            (Some((id, _)), ExpectedFile::Missing) => {
                return Err(IndexStageError::SelectedSource {
                    id: id.clone(),
                    path: path.clone(),
                    issue: super::index_scope::SelectedSourceIssue::Missing,
                });
            }
            (None, ExpectedFile::Present(_)) => {
                return Err(IndexStageError::Selection(
                    "obsolete selected path still exists".into(),
                ));
            }
        };
        self.verify_pending_identity(path)?;
        Ok((relative, snapshot, update))
    }

    /// Verify the indexed document and derive its staged file representation.
    fn project_source(
        &self,
        source: &source::SourceSnapshot,
        id: &str,
        state: &S,
    ) -> Result<PendingFile, IndexStageError> {
        (self.verify)(source, id, state, self.workspace)?;
        let mode = match self.mode {
            FileMode::Fixed => 0o100644,
            FileMode::Git(file_mode) => {
                git::workspace_file_mode(source, self.pending.membership(), file_mode)
                    .map_err(IndexStageError::Git)?
            }
        };
        Ok(PendingFile {
            mode,
            bytes: source.bytes.clone(),
        })
    }

    fn verify_pending_identity(&self, path: &Path) -> Result<(), IndexStageError> {
        if let Some((_, bytes)) = self.pending.blobs().iter().find(|(p, _)| p == path) {
            let invalid = |reason: &str| IndexStageError::PendingSourceInvalid {
                path: path.to_owned(),
                reason: reason.into(),
            };
            let text =
                std::str::from_utf8(bytes).map_err(|_| invalid("pending source is not UTF-8"))?;
            let id =
                (self.identity)(text).ok_or_else(|| invalid("pending source lacks identity"))?;
            if !self.paths[path].contains(&id) || !self.ids.contains(id.as_str()) {
                return Err(IndexStageError::SelectedSource {
                    id,
                    path: path.to_owned(),
                    issue: super::index_scope::SelectedSourceIssue::PendingIdentityMismatch,
                });
            }
        }
        Ok(())
    }
}

/// Reuse the index observations already bound to this acquisition phase.
pub(super) fn stage_indexes<D: DomainDefinition>(
    base: &Phase,
    index_path: &RelativePath,
    domain: &D,
    scope: StageScope,
) -> Result<IndexPair<D::State>, IndexStageError> {
    let workspace = match &base.workspace {
        ExpectedFile::Present(snapshot) => checked_index(&snapshot.bytes, domain)?,
        ExpectedFile::Missing => return Err(IndexStageError::Drift),
    };
    let pending = validated_pending_index(&base.pending, index_path, domain, scope)?;
    Ok((workspace, pending))
}

/// Bind a broader selected-content read to the index and locator observations.
pub(super) fn pending_for_sources(
    root: &Root,
    index_path: &RelativePath,
    base: &Phase,
    locator: Option<&ContentSnapshot>,
    mut paths: Vec<PathBuf>,
) -> Result<ContentSnapshot, IndexStageError> {
    if base
        .pending
        .paths()
        .iter()
        .any(|path| path == index_path.as_path())
    {
        paths.push(index_path.as_path().to_owned());
    }
    let pending = git::read_selected(root.path(), &paths).map_err(IndexStageError::Git)?;
    if locator.is_some_and(|snapshot| {
        snapshot.membership() != pending.membership()
            || snapshot
                .blobs()
                .iter()
                .any(|blob| !pending.blobs().contains(blob))
    }) {
        return Err(IndexStageError::Drift);
    }
    if pending.membership() != base.pending.membership()
        || pending
            .blobs()
            .iter()
            .find(|(p, _)| p == index_path.as_path())
            != base
                .pending
                .blobs()
                .iter()
                .find(|(p, _)| p == index_path.as_path())
    {
        return Err(IndexStageError::Drift);
    }
    Ok(pending)
}

/// Recheck the workspace index and selected documents without conflating drift and read failure.
pub(super) fn check_document_sources(
    root: &Root,
    index_path: &RelativePath,
    workspace: &ExpectedFile,
    sources: &[(RelativePath, ExpectedFile)],
) -> Result<(), FreshnessError> {
    if !source::equivalent_file(
        &source::capture(root, index_path).map_err(|_| FreshnessError::Read)?,
        workspace,
    ) {
        return Err(FreshnessError::Drift);
    }
    for (path, expected) in sources {
        if !source::equivalent_file(
            &source::capture(root, path).map_err(|_| FreshnessError::Read)?,
            expected,
        ) {
            return Err(FreshnessError::Drift);
        }
    }
    Ok(())
}

/// Map every indexed source path to its observed owners across the fixed snapshots.
pub(super) fn source_owners<S>(
    index_path: &RelativePath,
    indexes: [Option<&ValidatedIndex<S>>; 3],
    source_path: fn(&S) -> &str,
) -> Result<Paths, IndexStageError> {
    let mut paths = Paths::new();
    for index in indexes.into_iter().flatten() {
        for (id, state) in &index.index().entries {
            let path = path_in_domain(index_path.as_path(), source_path(state))?;
            paths.entry(path).or_default().insert(id.clone());
        }
    }
    Ok(paths)
}

/// A selected path cannot also be owned by an unselected identity.
pub(super) fn selected_owned_paths(
    paths: &Paths,
    ids: &BTreeSet<&str>,
) -> Result<Vec<PathBuf>, IndexStageError> {
    let mut selected = Vec::new();
    for (path, owners) in paths {
        if owners.iter().any(|id| ids.contains(id.as_str())) {
            if owners.iter().any(|id| !ids.contains(id.as_str())) {
                return Err(IndexStageError::Selection(
                    "selected path is owned by an unselected ID".into(),
                ));
            }
            selected.push(path.clone());
        }
    }
    Ok(selected)
}

/// Selected source evidence compared between independent stage acquisitions.
pub(super) struct SourceEvidence<'a> {
    pub base: &'a Phase,
    pub pending: &'a ContentSnapshot,
    pub sources: &'a [(RelativePath, ExpectedFile)],
    pub updates: &'a [crate::git::publish::PendingUpdate],
}
impl SourceEvidence<'_> {
    pub fn equivalent(&self, other: &Self) -> bool {
        source::equivalent_file(&self.base.workspace, &other.base.workspace)
            && self.base.selected == other.base.selected
            && self.base.target == other.base.target
            && self.pending == other.pending
            && self.sources.len() == other.sources.len()
            && self
                .sources
                .iter()
                .zip(other.sources)
                .all(|((ap, a), (bp, b))| ap == bp && source::equivalent_file(a, b))
            && self.updates == other.updates
    }
}

/// Complete a source-stage update batch, adding the index only for all scope.
pub(super) fn finish_updates(
    scope: StageScope,
    index_path: &RelativePath,
    target: &[u8],
    mut updates: Updates,
) -> Vec<crate::git::publish::PendingUpdate> {
    if scope == StageScope::All {
        updates.insert(
            index_path.as_path().to_owned(),
            Some(PendingFile {
                mode: 0o100644,
                bytes: target.to_vec(),
            }),
        );
    }
    updates
        .into_iter()
        .map(|(path, file)| crate::git::publish::PendingUpdate { path, file })
        .collect()
}

/// Phase recapture distinguishes observed drift from an unreadable source.
pub(super) fn phase_freshness_error(error: FreshnessError) -> IndexStageError {
    match error {
        FreshnessError::Drift => IndexStageError::Drift,
        FreshnessError::Read => IndexStageError::Selection("source verification failed".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn source_recheck_accepts_equal_replacement_but_rejects_changed_mode() {
        let workspace = tempfile::tempdir().unwrap();
        let path = workspace.path().join("index.json");
        std::fs::write(&path, b"index").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o640)).unwrap();
        let root = source::open_root(workspace.path()).unwrap();
        let relative = RelativePath::new("index.json").unwrap();
        let before = source::capture(&root, &relative).unwrap();
        let replacement = workspace.path().join("replacement");
        std::fs::write(&replacement, b"index").unwrap();
        std::fs::set_permissions(&replacement, std::fs::Permissions::from_mode(0o640)).unwrap();
        std::fs::rename(&replacement, &path).unwrap();
        assert!(check_document_sources(&root, &relative, &before, &[]).is_ok());
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert!(matches!(
            check_document_sources(&root, &relative, &before, &[]),
            Err(FreshnessError::Drift)
        ));
    }
}
