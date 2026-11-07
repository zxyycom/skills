//! Index-only stage: no domain documents or resource payloads are read.
use super::{
    IndexInputs, StageScope, compose_index, publication::SourcePublication, reporting::StageReport,
};
use crate::{
    git::{
        self, ContentSnapshot,
        publish::{PendingFile, PendingUpdate, ReplacementFailure},
    },
    index::{DomainDefinition, IndexError, ValidatedIndex, parse_index},
    source::{self, ExpectedFile, RelativePath, Root},
};
use std::{collections::BTreeSet, path::PathBuf};
mod acquisition;
mod history;
mod pending;
mod selection;
pub(super) use acquisition::{Acquisition, acquire};
pub(super) use history::capture_baseline;
pub(super) use pending::{
    Preservation, count_scope, decision_pending_basename, preserved_paths, validate_scope,
    validated_pending_index,
};

#[derive(Debug)]
pub enum IndexStageError {
    Source(source::SourceError),
    Git(git::GitError),
    Index(IndexError),
    Selection(String),
    SelectorUnresolved {
        selector: String,
    },
    SelectedSource {
        id: String,
        path: PathBuf,
        issue: SelectedSourceIssue,
    },
    PendingSourceInvalid {
        path: PathBuf,
        reason: String,
    },
    HistoricalIndexMissing {
        namespace_indeterminate: bool,
    },
    Publication(ReplacementFailure),
}
#[derive(Debug)]
pub enum SelectedSourceIssue {
    StaleIndex,
    Invalid(String),
    Missing,
    PendingIdentityMismatch,
}
impl IndexStageError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Source(_) => "source-error",
            Self::Git(git::GitError::NotRepository) => "not-repository",
            Self::Git(_) => "git-error",
            Self::Index(_) => "invalid-index",
            Self::Selection(_)
            | Self::SelectorUnresolved { .. }
            | Self::SelectedSource { .. }
            | Self::PendingSourceInvalid { .. } => "invalid-selection",
            Self::HistoricalIndexMissing { .. } => "historical-index-missing",
            Self::Publication(error) => publication_code(&error.kind),
        }
    }
    /// Recovery advice is available only when its precondition is established.
    pub fn recovery(&self) -> Option<&'static str> {
        match self {
            Self::HistoricalIndexMissing { .. } => Some(
                "Restore a trusted, consistent historical index before staging; do not infer an empty historical namespace.",
            ),
            _ => None,
        }
    }
    pub fn committed_paths(&self) -> Option<&[PathBuf]> {
        match self {
            Self::Publication(error) => error.committed_paths.as_deref(),
            _ => None,
        }
    }
}
/// Translate Git publication outcomes at the stage protocol boundary.
fn publication_code(kind: &git::publish::FailureKind) -> &'static str {
    use git::publish::FailureKind;
    match kind {
        FailureKind::Failed => "pending-replacement-failed",
        FailureKind::PartialOrUnknown => "pending-replacement-failed",
        FailureKind::CountUnavailable => "pending-count-unavailable",
    }
}

#[derive(Debug)]
pub struct IndexStageResult {
    pub selected_ids: Vec<String>,
    pub changed_paths: Vec<PathBuf>,
    pub updated_paths: Vec<PathBuf>,
    pub caller_owned_paths: Vec<PathBuf>,
    pub preserved_pending_paths: Vec<PathBuf>,
    pub pending_file_count: usize,
    pub pending_before: git::PendingSnapshot,
}
pub(super) struct Phase {
    pub(super) workspace: ExpectedFile,
    pub(super) pending: ContentSnapshot,
    pub(super) selected: Vec<String>,
    pub(super) target: Vec<u8>,
}

/// The caller owns selector syntax and result mapping. Scope is only index; this
/// operation neither loads nor claims freshness of record Markdown/resources.
pub fn stage_index<D, F>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
    selectors: &[String],
    name: F,
) -> Result<IndexStageResult, IndexStageError>
where
    D: DomainDefinition,
    D::State: Clone,
    F: Fn(&D::State) -> &str + Copy,
{
    if selectors.is_empty() {
        return Err(IndexStageError::Selection("selectors are required".into()));
    }
    let (revision, baseline) = capture_baseline(root, index_path, domain)?;
    let before = acquire(
        root,
        index_path,
        domain,
        baseline.as_ref(),
        Acquisition {
            selectors,
            name,
            scope: StageScope::Index,
            extra_ids: &[],
        },
    )?;
    validate_scope(index_path, before.pending.membership())?;
    let report = index_report(root, index_path, revision.as_deref(), domain, &before)?;
    IndexPublication { root, index_path }.publish(before, report)
}
/// Calculate the index-only stage report before publication.
fn index_report<'a, D: DomainDefinition>(
    root: &'a Root,
    index_path: &'a RelativePath,
    revision: Option<&'a str>,
    domain: &D,
    before: &Phase,
) -> Result<StageReport<'a>, IndexStageError> {
    let updated_paths = vec![index_path.as_path().to_owned()];
    let caller_owned_paths = caller_owned_sources(domain, index_path, before)?;
    StageReport::for_index(
        Preservation {
            root,
            revision,
            index_path,
            namespace: domain.namespace(),
        },
        &before.pending,
        updated_paths,
        caller_owned_paths,
    )
}

/// Publish the prepared index under fresh workspace evidence.
struct IndexPublication<'a> {
    root: &'a Root,
    index_path: &'a RelativePath,
}
impl IndexPublication<'_> {
    fn publish(
        &self,
        before: Phase,
        report: StageReport<'_>,
    ) -> Result<IndexStageResult, IndexStageError> {
        let updates = [PendingUpdate {
            path: self.index_path.as_path().to_owned(),
            file: Some(PendingFile {
                mode: 0o100644,
                bytes: before.target,
            }),
        }];
        let replacement = SourcePublication {
            root: self.root,
            pending: &before.pending,
            updates: &updates,
        }
        .publish()?;
        Ok(report.finish(before.selected, &before.pending, replacement))
    }
}

/// Report decision documents that an index-only stage leaves to its caller.
fn caller_owned_sources<D: DomainDefinition>(
    domain: &D,
    index_path: &RelativePath,
    before: &Phase,
) -> Result<Vec<PathBuf>, IndexStageError> {
    if domain.namespace() == "decisions" {
        let source = match &before.workspace {
            ExpectedFile::Present(snapshot) => checked_index(&snapshot.bytes, domain)?,
            ExpectedFile::Missing => {
                return Err(IndexStageError::Selection("workspace index missing".into()));
            }
        };
        let mut paths = Vec::new();
        for id in &before.selected {
            if let Some(state) = source.index().entries.get(id) {
                let path = indexed_source_path(index_path, state)?;
                paths.push(path);
            }
        }
        Ok(paths)
    } else {
        Ok(Vec::new())
    }
}

/// Resolve a serialized index source path within its collection directory.
fn indexed_source_path<S: serde::Serialize>(
    index_path: &RelativePath,
    state: &S,
) -> Result<PathBuf, IndexStageError> {
    let value = serde_json::to_value(state)
        .map_err(|error| IndexStageError::Selection(error.to_string()))?;
    let path = value
        .get("sourcePath")
        .and_then(|value| value.as_str())
        .ok_or_else(|| IndexStageError::Selection("state source path missing".into()))?;
    let path = index_path
        .as_path()
        .parent()
        .unwrap_or_else(|| std::path::Path::new(""))
        .join(path);
    RelativePath::new(&path).map_err(IndexStageError::Source)?;
    Ok(path)
}

pub(super) fn checked_index<D: DomainDefinition>(
    bytes: &[u8],
    domain: &D,
) -> Result<ValidatedIndex<D::State>, IndexStageError> {
    let index = parse_index(bytes, domain).map_err(IndexStageError::Index)?;
    domain
        .graph(index.index())
        .map_err(IndexStageError::Index)?;
    Ok(index)
}
