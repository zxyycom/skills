//! CLI input boundary. Parsing never performs an operation or grants authorization.
use crate::queries::{
    decision::{AlignmentFilter, DecisionQueryCommand, StatusFilter},
    investigation::InvestigationQueryCommand,
    matcher::MatchMode,
    options::{ListOptions, RelationFilter, SearchOptions, SearchScope, TraceOptions},
    trace::RequestedDirection,
};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Domain {
    Decision,
    Investigation,
}
impl Domain {
    pub(crate) fn directory_option(self) -> &'static str {
        match self {
            Self::Decision => "decisions-dir",
            Self::Investigation => "investigations-dir",
        }
    }
    pub(crate) fn default_directory(self) -> &'static str {
        match self {
            Self::Decision => "docs/decisions",
            Self::Investigation => "docs/investigations",
        }
    }
}
#[derive(Debug)]
pub enum Query {
    Decision(DecisionQueryCommand),
    Investigation(InvestigationQueryCommand),
}
#[derive(Debug)]
pub struct QueryInvocation {
    pub root: String,
    pub directory: String,
    pub json: bool,
    pub config: Option<String>,
    pub key: Option<String>,
    pub explicit_location: bool,
    pub command: Query,
}
#[derive(Debug)]
pub struct ArgumentError(pub String);
impl std::fmt::Display for ArgumentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}
impl std::error::Error for ArgumentError {}

pub mod arguments;
mod decision_identity;
mod help;
mod investigation_identity;
mod multi_source;
mod mutation;
mod output;

pub use arguments::query::parse_query;
use decision_identity::output_decision_identity;
use help::{command_names, print_help};
use investigation_identity::output_investigation_identity;
use mutation::dispatch_mutation;
use output::identity::*;
use output::transaction::*;
use output::{
    emit_success, print_argument_error, print_error, print_transaction_error, transaction_error,
};

fn global_argument_width(argument: &std::ffi::OsStr) -> usize {
    let bytes = argument.as_encoded_bytes();
    for option in [
        "--root",
        "--decisions-dir",
        "--investigations-dir",
        "--config",
        "--key",
    ] {
        if bytes == option.as_bytes() {
            return 2;
        }
        if bytes.starts_with(option.as_bytes()) && bytes.get(option.len()) == Some(&b'=') {
            return 1;
        }
    }
    0
}

fn leading_global_arguments(arguments: &[std::ffi::OsString]) -> usize {
    let mut leading = 0;
    while let Some(argument) = arguments.get(leading) {
        let width = global_argument_width(argument);
        if width == 0 || leading + width > arguments.len() {
            break;
        }
        leading += width;
    }
    leading
}

fn read_arguments(
    arguments: Vec<std::ffi::OsString>,
    leading: usize,
) -> Result<Vec<String>, ArgumentError> {
    let mut raw = Vec::new();
    for value in arguments {
        match value.into_string() {
            Ok(value) => raw.push(value),
            Err(_) => {
                return Err(ArgumentError("argument is not valid Unicode".into()));
            }
        }
    }
    // Commander accepts global location options before the subcommand as well
    // as after it. Move only those known globals, retaining their occurrences
    // so the common parser still enforces cardinality.
    if leading > 0 && leading < raw.len() {
        raw[..=leading].rotate_right(1);
    }
    Ok(raw)
}

fn help_topic(raw: &[String]) -> Option<&str> {
    if raw.len() == 2 && raw[0] == "help" {
        Some(raw[1].as_str())
    } else if raw.len() >= 2 && raw[1..].iter().any(|arg| arg == "--help") {
        Some(raw[0].as_str())
    } else {
        None
    }
}

fn handle_help(domain: Domain, raw: &[String]) -> Option<i32> {
    if raw.first().is_some_and(|arg| arg == "--version") {
        println!(
            "{} {}",
            match domain {
                Domain::Decision => "decision-records",
                Domain::Investigation => "investigation-report",
            },
            env!("CARGO_PKG_VERSION")
        );
        return Some(0);
    }
    if raw.is_empty() {
        print_help(domain, None);
        return Some(2);
    }
    if raw.first().is_some_and(|arg| arg == "--help") || raw == ["help"] {
        print_help(domain, None);
        return Some(0);
    }
    let requested_help = help_topic(raw);
    if let Some(topic) = requested_help {
        if !command_names(domain).contains(&topic) {
            eprintln!("unknown command: {topic}");
            return Some(2);
        }
        print_help(domain, Some(topic));
        return Some(0);
    }
    None
}

const MUTATION_COMMANDS: &[&str] = &[
    "new",
    "publish",
    "discard",
    "rename",
    "set-relations",
    "sync-index",
    "stage",
    "archive",
    "evolve",
    "mark-aligned",
    "reactivate",
];

/// Parses and dispatches the selected command; invalid input fails closed.
pub fn main_entry(domain: Domain) -> i32 {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    let json = arguments.iter().any(|arg| arg == "--json");
    let leading = leading_global_arguments(&arguments);
    let command_hint = arguments
        .get(leading)
        .and_then(|argument| argument.to_str())
        .unwrap_or("")
        .to_owned();
    let raw = match read_arguments(arguments, leading) {
        Ok(raw) => raw,
        Err(error) => {
            return print_argument_error(&command_hint, json, error);
        }
    };
    if let Some(exit) = handle_help(domain, &raw) {
        return exit;
    }
    let command = raw.first().map(String::as_str).unwrap_or("");
    if MUTATION_COMMANDS.contains(&command) {
        return match crate::cli::arguments::mutation::parse_mutation(domain, &raw) {
            Ok(invocation) => dispatch_mutation(command, invocation),
            Err(error) => print_argument_error(command, json, error),
        };
    }
    let invocation = match parse_query(domain, &raw) {
        Ok(parsed) => parsed,
        Err(error) => {
            return print_argument_error(command, json, error);
        }
    };
    dispatch_query(command, json, invocation)
}

fn dispatch_query(command: &str, json: bool, invocation: QueryInvocation) -> i32 {
    if let Query::Investigation(ref query) = invocation.command
        && matches!(
            query,
            InvestigationQueryCommand::List { .. } | InvestigationQueryCommand::Search { .. }
        )
        && !invocation.explicit_location
    {
        match multi_source::load(invocation.config.as_deref(), invocation.key.as_deref()) {
            Ok(Some(sources)) => {
                return multi_source::dispatch(command, json, sources, query.clone());
            }
            Ok(None) => {}
            Err(error) => return print_error(command, json, error, 1),
        }
    }
    let root = match crate::source::open_root(std::path::Path::new(&invocation.root)) {
        Ok(root) => root,
        Err(error) => {
            return print_error(
                command,
                json,
                crate::protocol::CommandError::new("source-error", error.to_string()),
                1,
            );
        }
    };
    match invocation.command {
        Query::Decision(query) => {
            let trace = matches!(&query, DecisionQueryCommand::Trace(_));
            match crate::queries::decision::run(&root, &invocation.directory, query) {
                Ok(value) => emit_success(command, json, trace, &value, value.warnings()),
                Err(error) => print_error(command, json, error, 1),
            }
        }
        Query::Investigation(query) => {
            let trace = matches!(&query, InvestigationQueryCommand::Trace(_));
            match crate::queries::investigation::run(&root, &invocation.directory, query) {
                Ok(value) => emit_success(command, json, trace, &value, value.warnings()),
                Err(error) => print_error(command, json, error, 1),
            }
        }
    }
}

#[cfg(test)]
mod tests;
