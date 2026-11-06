//! Decision query requests. Results must originate from a validated snapshot.
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
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StatusFilter {
    Active,
    Archived,
    All,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AlignmentFilter {
    Aligned,
    Unaligned,
    All,
}
impl StatusFilter {
    fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Archived => "archived",
            Self::All => "all",
        }
    }
}
impl AlignmentFilter {
    fn as_str(self) -> &'static str {
        match self {
            Self::Aligned => "aligned",
            Self::Unaligned => "unaligned",
            Self::All => "all",
        }
    }
}
/// Lifecycle filters applied together to a Decision search.
#[derive(Clone, Copy, Debug)]
pub struct DecisionFilters {
    pub status: StatusFilter,
    pub alignment: AlignmentFilter,
}
#[derive(Clone, Debug)]
pub enum DecisionQueryCommand {
    Candidates,
    Check,
    List {
        options: ListOptions,
        status: StatusFilter,
        alignment: AlignmentFilter,
        created_from: Option<String>,
        created_to: Option<String>,
        full_time: bool,
    },
    Search {
        options: SearchOptions,
        status: StatusFilter,
        alignment: AlignmentFilter,
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
use crate::{
    domains::{Relation, decision::DecisionState},
    index::QuerySnapshot,
};
use serde::Serialize;

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
            Self::Trace(_) => &[],
        }
    }
}
pub fn run(
    root: &crate::source::Root,
    directory: &str,
    command: DecisionQueryCommand,
) -> Result<QueryResult, crate::protocol::CommandError> {
    match command {
        DecisionQueryCommand::List {
            options,
            status,
            alignment,
            created_from,
            created_to,
            ..
        } => run_list(
            root,
            directory,
            ListProjection {
                options: &options,
                status,
                alignment,
                created_from: created_from.as_deref(),
                created_to: created_to.as_deref(),
            },
        ),
        DecisionQueryCommand::Trace(options) => run_trace(root, directory, &options),
        DecisionQueryCommand::Search {
            options,
            status,
            alignment,
        } => run_search(root, directory, &options, status, alignment),
        DecisionQueryCommand::Check => crate::mutations::check::decision(root, directory, &[])
            .map(QueryResult::Check)
            .map_err(super::check_error),
        DecisionQueryCommand::Candidates => run_candidates(root, directory),
        DecisionQueryCommand::ShowCandidate { selector } => {
            run_candidate(root, directory, &selector)
        }
        DecisionQueryCommand::Show { selector } => run_show(root, directory, &selector),
    }
}

fn run_list(
    root: &crate::source::Root,
    directory: &str,
    request: ListProjection<'_>,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let snapshot = super::load::snapshot(
        root,
        directory,
        "decision-index.json",
        &crate::domains::decision::Definition,
    )?;
    super::verify_selector(
        &snapshot,
        request.options.relation.related_to.as_deref(),
        |state| &state.name,
    )?;
    project_list(&snapshot, request)
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
        "decision-index.json",
        &crate::domains::decision::Definition,
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
    status: StatusFilter,
    alignment: AlignmentFilter,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let snapshot = super::load::snapshot(
        root,
        directory,
        "decision-index.json",
        &crate::domains::decision::Definition,
    )?;
    super::verify_selector(&snapshot, options.relation.related_to.as_deref(), |state| {
        &state.name
    })?;
    match options.scope {
        super::options::SearchScope::Metadata => {
            project_metadata(&snapshot, options, status, alignment).map(QueryResult::MetadataSearch)
        }
        super::options::SearchScope::Content => project_content(
            root,
            directory,
            &snapshot,
            options,
            DecisionFilters { status, alignment },
        )
        .map(QueryResult::ContentSearch),
    }
    .map_err(super::projection_error)
}
fn run_candidates(
    root: &crate::source::Root,
    directory: &str,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let (items, warnings) = candidates(root, directory, None)?;
    Ok(QueryResult::Candidates(CandidatesResult {
        status: "ok",
        command: "candidates",
        records: items.into_iter().map(|(record, _)| record).collect(),
        warnings,
    }))
}
fn run_candidate(
    root: &crate::source::Root,
    directory: &str,
    selector: &str,
) -> Result<QueryResult, crate::protocol::CommandError> {
    let (mut items, warnings) = candidates(root, directory, Some(selector))?;
    let (record, body) = items.pop().ok_or_else(|| {
        crate::protocol::CommandError::new(
            "candidate-invalid",
            "selected candidate was not returned",
        )
    })?;
    Ok(QueryResult::ShowCandidate(CandidateResult {
        status: "ok",
        command: "show-candidate",
        body,
        record,
        warnings,
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
        "decision-index.json",
        &crate::domains::decision::Definition,
    )?;
    show(root, directory, &snapshot, selector).map(QueryResult::Show)
}
