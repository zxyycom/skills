//! Thin, ordered wrapper around independent investigation queries.
use crate::{
    protocol::CommandError,
    queries::investigation::{self, InvestigationQueryCommand, QueryResult},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Config {
    default_key: String,
    sources: HashMap<String, Vec<ConfiguredSource>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConfiguredSource {
    root: String,
    investigations_dir: String,
}
struct Source {
    root: PathBuf,
    directory: String,
}
pub(super) struct Sources {
    key: String,
    sources: Vec<Source>,
}

pub(super) fn load(
    config: Option<&str>,
    key: Option<&str>,
) -> Result<Option<Sources>, CommandError> {
    let cwd = std::env::current_dir().map_err(|e| config_error(e.to_string()))?;
    let path = config.map_or_else(
        || cwd.join(".local/.investigation-report.local.json"),
        |p| cwd.join(p),
    );
    let Some(bytes) = read_config(&path, config.is_some() || key.is_some())? else {
        return Ok(None);
    };
    let parsed: Config = serde_json::from_slice(&bytes)
        .map_err(|e| config_error(format!("{}: {e}", path.display())))?;
    validate_config(&parsed, &path)?;
    select_sources(&parsed, key, &path).map(Some)
}

fn read_config(path: &Path, required: bool) -> Result<Option<Vec<u8>>, CommandError> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound && !required => Ok(None),
        Err(error) => Err(config_error(format!("{}: {error}", path.display()))),
    }
}

fn validate_config(parsed: &Config, path: &Path) -> Result<(), CommandError> {
    if parsed.default_key.is_empty() || !parsed.sources.contains_key(&parsed.default_key) {
        return Err(config_error(format!(
            "{}: defaultKey must name an existing source group",
            path.display()
        )));
    }
    for (key, sources) in &parsed.sources {
        if key.is_empty() || sources.is_empty() {
            return Err(config_error(format!(
                "{}: sources must have nonempty keys and groups (key: {key:?})",
                path.display()
            )));
        }
        for (index, source) in sources.iter().enumerate() {
            if source.root.is_empty() {
                return Err(config_error(format!(
                    "{}: sources[{key:?}][{index}].root must not be empty",
                    path.display()
                )));
            }
            if let Err(error) = crate::source::RelativePath::new(&source.investigations_dir) {
                return Err(config_error(format!(
                    "{}: sources[{key:?}][{index}].investigationsDir: {error}",
                    path.display()
                )));
            }
        }
    }
    Ok(())
}

fn select_sources(
    parsed: &Config,
    key: Option<&str>,
    path: &Path,
) -> Result<Sources, CommandError> {
    let selected = key.unwrap_or(&parsed.default_key);
    let group = parsed.sources.get(selected).ok_or_else(|| {
        config_error(format!(
            "{}: unknown source key: {selected}",
            path.display()
        ))
    })?;
    let parent = path.parent().unwrap_or(Path::new("."));
    let sources = group
        .iter()
        .map(|s| Source {
            root: parent.join(&s.root),
            directory: s.investigations_dir.clone(),
        })
        .collect();
    Ok(Sources {
        key: selected.to_owned(),
        sources,
    })
}
fn config_error(message: String) -> CommandError {
    CommandError::new("config-error", message)
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
    Success(Box<QueryResult>),
    Failure(CommandError),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SuccessView<'a> {
    root: &'a Path,
    investigations_dir: &'a str,
    ok: bool,
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
            SourceOutcome::Success(result) => SuccessView {
                root: &self.source.root,
                investigations_dir: &self.source.directory,
                ok: true,
                result,
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
) -> i32 {
    let sources = group
        .sources
        .into_iter()
        .map(|source| run_source(source, &query))
        .collect();
    let result = GroupResult {
        key: group.key,
        sources,
    };
    output_group(command, json, &result)
}

fn run_source(source: Source, query: &InvestigationQueryCommand) -> SourceResult {
    let outcome = crate::source::open_root(&source.root)
        .map_err(|error| CommandError::new("source-error", error.to_string()))
        .and_then(|root| investigation::run(&root, &source.directory, query.clone()));
    let outcome = match outcome {
        Ok(value) => {
            for warning in value.warnings() {
                eprintln!("{}: {warning}", source.root.display());
            }
            SourceOutcome::Success(Box::new(value))
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
