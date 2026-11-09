use crate::cli::*;

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
    let location = parse_location(domain, &values)?;
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
        root: location.root,
        directory: location.directory,
        json: values.contains_key("json"),
        config: get("config"),
        key: get("key"),
        explicit_location: location.explicit,
        command,
    })
}

struct Location {
    root: String,
    directory: String,
    explicit: bool,
}

fn parse_location(
    domain: Domain,
    values: &HashMap<String, Vec<String>>,
) -> Result<Location, ArgumentError> {
    let explicit_location =
        values.contains_key("root") || values.contains_key(domain.directory_option());
    if explicit_location && (values.contains_key("key") || values.contains_key("config")) {
        return Err(ArgumentError(
            "--root/--investigations-dir conflict with --key/--config".into(),
        ));
    }
    let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
    let root = get("root").unwrap_or_else(|| ".".into());
    let directory =
        get(domain.directory_option()).unwrap_or_else(|| domain.default_directory().into());
    Ok(Location {
        root,
        directory,
        explicit: explicit_location,
    })
}
