//! Investigation query requests. Results must originate from a validated snapshot.
mod list;
pub use list::*;
mod trace;
pub use trace::*;
mod metadata;
mod search;
pub use metadata::*;
mod show;
pub use show::*;
mod content;
pub use content::*;
mod candidates;
pub use candidates::*;

use super::options::{ListOptions, SearchOptions, TraceOptions};
/// Inclusive formedAt bounds supplied to an Investigation content search.
#[derive(Clone, Copy, Debug)]
pub struct FormationRange<'a> {
    pub from: Option<&'a str>,
    pub to: Option<&'a str>,
}
#[derive(Clone, Debug)]
pub enum InvestigationQueryCommand {
    Candidates,
    Check {
        ids: Vec<String>,
    },
    List {
        options: ListOptions,
        formed_from: Option<String>,
        formed_to: Option<String>,
    },
    Search {
        options: SearchOptions,
        formed_from: Option<String>,
        formed_to: Option<String>,
    },
    Show {
        selector: String,
    },
    ShowCandidate {
        selector: String,
    },
    Trace(TraceOptions),
}

use super::{
    facets::{self, TagFacet, TimeFacets},
    relation_filter::FilterRelation,
    trace::compare_text,
};
use crate::{domains::investigation::InvestigationState, index::QuerySnapshot};
use serde::Serialize;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

#[derive(Serialize)]
#[serde(untagged)]
pub enum QueryResult {
    List(ListResult),
    Trace(TraceResult),
    MetadataSearch(MetadataSearchResult),
    ContentSearch(ContentSearchResult),
    Show(ShowResult),
    Candidates(CandidatesResult),
    ShowCandidate(CandidateResult),
    Check(crate::mutations::check::CheckResult),
}
impl QueryResult {
    pub fn warnings(&self) -> &[String] {
        match self {
            Self::List(result) => &result.warnings,
            Self::MetadataSearch(result) => &result.warnings,
            Self::ContentSearch(result) => &result.warnings,
            Self::Show(result) => &result.warnings,
            Self::Candidates(result) => &result.warnings,
            Self::ShowCandidate(result) => &result.warnings,
            Self::Check(result) => &result.warnings,
            Self::Trace(result) => &result.warnings,
        }
    }
}
pub fn run(
    root: &crate::source::Root,
    directory: &str,
    command: InvestigationQueryCommand,
) -> Result<QueryResult, crate::protocol::CommandError> {
    match command {
        InvestigationQueryCommand::List {
            options,
            formed_from,
            formed_to,
        } => run_list(
            root,
            directory,
            &options,
            formed_from.as_deref(),
            formed_to.as_deref(),
        ),
        InvestigationQueryCommand::Trace(options) => run_trace(root, directory, &options),
        InvestigationQueryCommand::Search {
            options,
            formed_from,
            formed_to,
        } => run_search(
            root,
            directory,
            &options,
            FormationRange {
                from: formed_from.as_deref(),
                to: formed_to.as_deref(),
            },
        ),
        InvestigationQueryCommand::Check { ids } => {
            crate::mutations::check::investigation(root, directory, &ids)
                .map(QueryResult::Check)
                .map_err(super::check_error)
        }
        InvestigationQueryCommand::Candidates => run_candidates(root, directory),
        InvestigationQueryCommand::ShowCandidate { selector } => {
            run_candidate(root, directory, &selector)
        }
        InvestigationQueryCommand::Show { selector } => run_show(root, directory, &selector),
    }
}
fn run_list(
    root: &crate::source::Root,
    directory: &str,
    options: &ListOptions,
    formed_from: Option<&str>,
    formed_to: Option<&str>,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let snapshot = super::load::snapshot(
        root,
        directory,
        "investigation-index.json",
        &crate::domains::investigation::Definition,
    )?;
    let path = root
        .path
        .join(directory)
        .join("investigation-index.json")
        .display()
        .to_string();
    super::verify_selector(&snapshot, options.relation.related_to.as_deref(), |state| {
        &state.name
    })?;
    project_list(&snapshot, options, formed_from, formed_to, path)
        .map(QueryResult::List)
        .map_err(super::projection_error)
}
fn run_trace(
    root: &crate::source::Root,
    directory: &str,
    options: &TraceOptions,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let snapshot = super::load::snapshot(
        root,
        directory,
        "investigation-index.json",
        &crate::domains::investigation::Definition,
    )?;
    super::verify_selector(&snapshot, Some(&options.selector), |state| &state.name)?;
    project_trace(&snapshot, options)
        .map(QueryResult::Trace)
        .map_err(super::projection_error)
}
fn run_search(
    root: &crate::source::Root,
    directory: &str,
    options: &SearchOptions,
    range: FormationRange<'_>,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let index_path = root
        .path()
        .join(directory)
        .join("investigation-index.json")
        .display()
        .to_string();
    execute_search(root, directory, options, range, &index_path)
        .map_err(|error| search_failure(error, &index_path))
}
// This phase uses one validated snapshot; the caller adds Investigation-specific partial errors.
fn execute_search(
    root: &crate::source::Root,
    directory: &str,
    options: &SearchOptions,
    range: FormationRange<'_>,
    index_path: &str,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let snapshot = super::load::snapshot(
        root,
        directory,
        "investigation-index.json",
        &crate::domains::investigation::Definition,
    )?;
    super::verify_selector(&snapshot, options.relation.related_to.as_deref(), |state| {
        &state.name
    })?;
    match options.scope {
        super::options::SearchScope::Metadata => project_metadata(
            &snapshot,
            options,
            range.from,
            range.to,
            index_path.to_owned(),
        )
        .map(QueryResult::MetadataSearch),
        super::options::SearchScope::Content => {
            project_content(root, directory, &snapshot, options, range)
                .map(QueryResult::ContentSearch)
        }
    }
    .map_err(super::projection_error)
}
// Investigation search failures carry their own partial-result contract.
fn search_failure(
    mut error: crate::protocol::CommandError,
    index_path: &str,
) -> crate::protocol::CommandError {
    let partial = serde_json::json!({"status":"error","indexPath":index_path,"errors":[&error.message],"warnings":[],"entries":[],"searchInfo":null,"failureKind":"operation","truncation":{"files":false,"matches":false,"previewCharacters":false}});
    match serde_json::to_string(&partial) {
        Ok(value) => error.partial = Some(Box::new(value)),
        Err(failure) => error.diagnostics.push(crate::protocol::Diagnostic {
            code: "partial-serialization-failed".into(),
            message: failure.to_string(),
            path: None,
            target: None,
            cause_category: None,
            operation: None,
            detail: None,
            reason: None,
            recovery: None,
        }),
    }
    error
}
fn run_candidates(
    root: &crate::source::Root,
    directory: &str,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let (candidates, warnings) = candidates(root, directory, None)?;
    Ok(QueryResult::Candidates(CandidatesResult {
        status: "ok",
        candidates,
        warnings,
        errors: vec![],
    }))
}
fn run_candidate(
    root: &crate::source::Root,
    directory: &str,
    selector: &str,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let (mut candidates, warnings) = candidates(root, directory, Some(selector))?;
    let candidate = candidates.pop().ok_or_else(|| {
        crate::protocol::CommandError::new(
            "candidate-invalid",
            "selected candidate was not returned",
        )
    })?;
    Ok(QueryResult::ShowCandidate(CandidateResult {
        status: "ok",
        candidate,
        warnings,
        errors: vec![],
    }))
}
fn run_show(
    root: &crate::source::Root,
    directory: &str,
    selector: &str,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let snapshot = super::load::snapshot(
        root,
        directory,
        "investigation-index.json",
        &crate::domains::investigation::Definition,
    )?;
    show(root, directory, &snapshot, selector).map(QueryResult::Show)
}
