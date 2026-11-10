//! Capture and validate selected source documents against the phase's index and Git evidence.
use super::{
    StageScope,
    index_scope::{IndexStageError, Phase, checked_index, validated_pending_index},
};
use crate::{
    git::{self, ContentSnapshot, publish::PendingFile},
    index::{DomainDefinition, ValidatedIndex},
    source::{self, ExpectedFile, RelativePath, Root},
};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    path::{Path, PathBuf},
};

type Paths = BTreeMap<PathBuf, BTreeSet<String>>;
type Verify<S> =
    fn(&source::SourceSnapshot, &str, &S, &ValidatedIndex<S>) -> Result<(), IndexStageError>;
type Updates = BTreeMap<PathBuf, Option<PendingFile>>;
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
    pub fn capture(&self) -> Result<Updates, IndexStageError> {
        // Keep the first matching entry, as the previous per-path scan did.
        let mut owners = HashMap::new();
        for (id, state) in &self.workspace.index().entries {
            if self.ids.contains(id.as_str())
                && let Ok(path) =
                    path_in_domain(self.index_path.as_path(), (self.source_path)(state))
            {
                owners.entry(path).or_insert((id, state));
            }
        }
        let mut blobs = HashMap::new();
        for (path, bytes) in self.pending.blobs() {
            blobs.entry(path.as_path()).or_insert(bytes.as_slice());
        }
        let mut updates = Updates::new();
        for path in self.selected_paths {
            let update = self.capture_one(
                path,
                owners.get(path).copied(),
                blobs.get(path.as_path()).copied(),
            )?;
            updates.insert(path.clone(), update);
        }
        Ok(updates)
    }

    fn capture_one(
        &self,
        path: &PathBuf,
        owner: Option<(&String, &S)>,
        pending_blob: Option<&[u8]>,
    ) -> Result<Option<PendingFile>, IndexStageError> {
        let relative = RelativePath::new(path).map_err(IndexStageError::Source)?;
        let snapshot = source::capture(self.root, &relative).map_err(IndexStageError::Source)?;
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
        self.verify_pending_identity(path, pending_blob)?;
        Ok(update)
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
                git::workspace_file_mode(self.root, source, self.pending.membership(), file_mode)
                    .map_err(IndexStageError::Git)?
            }
        };
        Ok(PendingFile {
            mode,
            bytes: source.bytes.clone(),
        })
    }

    fn verify_pending_identity(
        &self,
        path: &Path,
        pending_blob: Option<&[u8]>,
    ) -> Result<(), IndexStageError> {
        if let Some(bytes) = pending_blob {
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
        ExpectedFile::Missing => {
            return Err(IndexStageError::Selection("workspace index missing".into()));
        }
    };
    let pending = validated_pending_index(&base.pending, index_path, domain, scope)?;
    Ok((workspace, pending))
}

/// Read pending payloads for the selected source paths and index.
pub(super) fn pending_for_sources(
    root: &Root,
    index_path: &RelativePath,
    base: &Phase,
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
    Ok(pending)
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
