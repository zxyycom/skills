//! Thin, ordered wrapper around independent investigation queries.
use super::investigation_config::Source;
use crate::{
    protocol::CommandError,
    queries::investigation::{self, InvestigationQueryCommand, QueryResult},
};
use serde::Serialize;
use std::path::Path;

pub(super) struct Sources {
    pub key: String,
    pub sources: Vec<Source>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GroupResult {
    key: String,
    sources: Vec<SourceResult>,
}
struct SourceResult {
    source: Source,
    outcome: SourceOutcome,
}

enum SourceOutcome {
    Success {
        result: Box<QueryResult>,
        review: Option<crate::resource_review::Review>,
    },
    Failure(CommandError),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SuccessView<'a> {
    root: &'a Path,
    investigations_dir: &'a str,
    ok: bool,
    result: ReviewedResult<'a>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReviewedResult<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    resource_review: &'a Option<crate::resource_review::Review>,
    #[serde(flatten)]
    result: &'a QueryResult,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FailureView<'a> {
    root: &'a Path,
    investigations_dir: &'a str,
    ok: bool,
    error: &'a CommandError,
    #[serde(skip_serializing_if = "<[crate::protocol::Diagnostic]>::is_empty")]
    diagnostics: &'a [crate::protocol::Diagnostic],
    #[serde(skip_serializing_if = "Option::is_none")]
    partial: Option<Box<serde_json::value::RawValue>>,
}

impl Serialize for SourceResult {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match &self.outcome {
            SourceOutcome::Success { result, review } => SuccessView {
                root: &self.source.root,
                investigations_dir: &self.source.directory,
                ok: true,
                result: ReviewedResult {
                    result,
                    resource_review: review,
                },
            }
            .serialize(serializer),
            SourceOutcome::Failure(error) => FailureView {
                root: &self.source.root,
                investigations_dir: &self.source.directory,
                ok: false,
                error,
                diagnostics: &error.diagnostics,
                partial: error
                    .partial
                    .as_ref()
                    .map(|partial| serde_json::value::RawValue::from_string((**partial).clone()))
                    .transpose()
                    .map_err(serde::ser::Error::custom)?,
            }
            .serialize(serializer),
        }
    }
}
pub(super) fn dispatch(
    command: &str,
    json: bool,
    group: Sources,
    query: InvestigationQueryCommand,
    policy: &crate::resource_review::policy::Policy,
) -> i32 {
    let sources = group
        .sources
        .into_iter()
        .map(|source| run_source(source, &query, policy))
        .collect();
    let result = GroupResult {
        key: group.key,
        sources,
    };
    output_group(command, json, &result)
}

fn run_source(
    source: Source,
    query: &InvestigationQueryCommand,
    policy: &crate::resource_review::policy::Policy,
) -> SourceResult {
    let outcome = crate::source::open_root(&source.root)
        .map_err(|error| CommandError::new("source-error", error.to_string()))
        .and_then(|root| {
            let value = investigation::run(&root, &source.directory, query.clone())?;
            let review =
                super::resource_review::review_query(&root, &source.directory, &value, policy);
            Ok((value, review))
        });
    let outcome = match outcome {
        Ok((value, review)) => {
            for warning in value.warnings() {
                eprintln!("{}: {warning}", source.root.display());
            }
            SourceOutcome::Success {
                result: Box::new(value),
                review,
            }
        }
        Err(error) => SourceOutcome::Failure(error),
    };
    SourceResult { source, outcome }
}

fn output_group(command: &str, json: bool, result: &GroupResult) -> i32 {
    if result
        .sources
        .iter()
        .any(|source| matches!(source.outcome, SourceOutcome::Failure(_)))
    {
        match CommandError::new("source-query-failed", "one or more sources failed")
            .with_partial(result)
        {
            Ok(error) => super::print_error(command, json, error, 1),
            Err(error) => super::print_error(
                command,
                json,
                CommandError::new("serialization-error", error.to_string()),
                1,
            ),
        }
    } else {
        super::emit_success(command, json, false, result, &[])
    }
}
