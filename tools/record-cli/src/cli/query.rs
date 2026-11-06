use super::*;

mod arguments;
mod build;
mod filters;
use arguments::{ParsedArguments, parse_arguments, validate_presence};
use build::QueryBuilder;
use filters::{QueryFilters, parse_filters};

const QUERY_COMMANDS: &[&str] = &[
    "candidates",
    "check",
    "list",
    "search",
    "show",
    "show-candidate",
    "trace",
];

/// Query command parser; mutations and help have separate entry points.
pub fn parse_query(domain: Domain, argv: &[String]) -> Result<QueryInvocation, ArgumentError> {
    let command = argv
        .first()
        .ok_or_else(|| ArgumentError("missing command".into()))?;
    if !QUERY_COMMANDS.contains(&command.as_str()) {
        return Err(ArgumentError(format!(
            "unsupported query command: {command}"
        )));
    }
    let ParsedArguments { values, positional } = parse_arguments(domain, command, argv)?;
    validate_presence(command, &values, &positional)?;
    let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
    let root = get("root").unwrap_or_else(|| ".".into());
    let directory =
        get(domain.directory_option()).unwrap_or_else(|| domain.default_directory().into());
    let QueryFilters {
        tags,
        relation,
        direction,
        status,
        alignment,
    } = parse_filters(domain, command, &values)?;
    let command = QueryBuilder {
        domain,
        values: &values,
        positional: &positional,
        tags,
        relation,
        direction,
        status,
        alignment,
    }
    .build(command)?;
    Ok(QueryInvocation {
        root,
        directory,
        json: values.contains_key("json"),
        command,
    })
}
