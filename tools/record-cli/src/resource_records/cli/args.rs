use std::{collections::HashSet, ffi::OsString};

#[derive(Clone, Copy)]
pub(super) enum ListView {
    Brief,
    Tree,
}

#[derive(Default)]
pub(super) struct Args {
    pub(super) command: String,
    pub(super) root: Option<String>,
    pub(super) dir: Option<String>,
    pub(super) json: bool,
    pub(super) view: Option<ListView>,
    pub(super) positionals: Vec<String>,
    pub(super) collection: Option<String>,
    pub(super) descendants: bool,
    pub(super) kind: Option<String>,
    pub(super) tags: Vec<String>,
    pub(super) slot: Option<String>,
    pub(super) version: Option<String>,
    pub(super) member: Option<String>,
    pub(super) offset: usize,
    pub(super) limit: Option<usize>,
    pub(super) metadata: bool,
    pub(super) types: Vec<String>,
    pub(super) direction: Option<String>,
    pub(super) depth: Option<usize>,
    pub(super) nodes: Option<usize>,
    pub(super) edges: Option<usize>,
}
pub(super) const HELP: &str = "resource-records <list|show|search|trace|check|sync-index> [options]\n  --root <path> --resources-dir <path> --json\n  list: --collection <id> --descendants --kind <collection|resource> --tag <tag> --slot <slot> --offset <n> --limit <n> [--brief|--tree]\n  show: <id> [--version <id>] [--member <id>]\n  search: <text> [--metadata] [--offset <n>] [--limit <n>]\n  trace: <id> [--version <id>] [--member <id>] [--type <type>] [--direction <upstream|downstream>] [--depth <n>] [--max-nodes <n>] [--max-edges <n>]";
pub(super) struct ParseError {
    pub(super) message: String,
    pub(super) command: String,
    pub(super) json: bool,
}

#[derive(Default)]
struct ArgumentScan {
    args: Args,
    seen: HashSet<String>,
    command: Option<String>,
    positional_only: bool,
}

impl ArgumentScan {
    fn consume(
        &mut self,
        raw: OsString,
        remaining: &mut impl Iterator<Item = OsString>,
    ) -> Result<(), String> {
        let token = raw.into_string().map_err(|raw| {
            if self.positional_only || !raw.as_encoded_bytes().starts_with(b"-") {
                self.command.get_or_insert_default();
            }
            "argument must be valid Unicode"
        })?;
        if !self.positional_only {
            if token == "--" {
                self.positional_only = true;
                return Ok(());
            }
            if token.starts_with('-') {
                return consume_option(&mut self.args, &mut self.seen, remaining, &token);
            }
        }
        if self.command.is_some() {
            self.args.positionals.push(token);
        } else {
            self.command = Some(token);
        }
        Ok(())
    }
}

pub(super) fn parse_args(args: Vec<OsString>) -> Result<Args, ParseError> {
    let mut scan = ArgumentScan::default();
    let mut remaining = args.into_iter();
    let mut first_error = None;
    while let Some(raw) = remaining.next() {
        if let Err(error) = scan.consume(raw, &mut remaining) {
            first_error.get_or_insert(error);
        }
    }
    let mut args = scan.args;
    args.command = scan.command.unwrap_or_default();
    let error = first_error.or_else(|| validate_args(&args, &scan.seen).err());
    match error {
        Some(message) => Err(ParseError {
            message,
            command: if is_command(&args.command) {
                args.command
            } else {
                String::new()
            },
            json: args.json,
        }),
        None => Ok(args),
    }
}

fn validate_args(a: &Args, seen: &HashSet<String>) -> Result<(), String> {
    validate_shape(a)?;
    if seen.contains("--brief") && seen.contains("--tree") {
        return Err("--brief and --tree are mutually exclusive".into());
    }
    validate_options(a, seen)?;
    if a.command == "search" && a.positionals[0].is_empty() {
        return Err("search text must not be empty".into());
    }
    if a.types.iter().any(|x| {
        !matches!(
            x.as_str(),
            "input"
                | "preview-of"
                | "version-parent"
                | "parent"
                | "collection"
                | "member"
                | "selection"
                | "reference"
        )
    }) {
        return Err("invalid relation type".into());
    }
    Ok(())
}

fn set_value(a: &mut Args, name: &str, v: String) -> Result<(), String> {
    match name {
        "--root" => a.root = Some(v),
        "--resources-dir" => a.dir = Some(v),
        "--collection" => a.collection = Some(v),
        _ => return set_query_value(a, name, v),
    }
    Ok(())
}
fn set_numeric(a: &mut Args, name: &str, value: &str) -> Result<(), String> {
    let n = value
        .parse()
        .map_err(|_| format!("invalid {}", &name[2..]))?;
    match name {
        "--offset" => a.offset = n,
        "--limit" => a.limit = Some(n),
        "--depth" => a.depth = Some(n),
        "--max-nodes" => a.nodes = Some(n),
        "--max-edges" => a.edges = Some(n),
        _ => return Err(format!("unknown option {name}")),
    }
    Ok(())
}

fn consume_option(
    a: &mut Args,
    seen: &mut HashSet<String>,
    remaining: &mut impl Iterator<Item = OsString>,
    name: &str,
) -> Result<(), String> {
    const VALUE_OPTIONS: &[&str] = &[
        "--root",
        "--resources-dir",
        "--collection",
        "--kind",
        "--tag",
        "--slot",
        "--version",
        "--member",
        "--offset",
        "--limit",
        "--type",
        "--direction",
        "--depth",
        "--max-nodes",
        "--max-edges",
    ];
    let duplicate = check_duplicate(seen, name);
    let result = if set_flag(a, name) {
        Ok(())
    } else if VALUE_OPTIONS.contains(&name) {
        option_value(remaining, name).and_then(|value| set_value(a, name, value))
    } else {
        Err(format!("unknown option {name}"))
    };
    duplicate.and(result)
}

fn option_value(
    remaining: &mut impl Iterator<Item = OsString>,
    name: &str,
) -> Result<String, String> {
    remaining
        .next()
        .ok_or_else(|| format!("{name} requires a value"))?
        .into_string()
        .map_err(|_| format!("{name} value must be valid Unicode"))
}

pub(super) fn is_command(command: &str) -> bool {
    matches!(
        command,
        "list" | "show" | "search" | "trace" | "check" | "sync-index"
    )
}

fn validate_shape(a: &Args) -> Result<(), String> {
    if !is_command(&a.command) {
        return Err("unknown or missing command".into());
    }
    let count = if matches!(a.command.as_str(), "show" | "search" | "trace") {
        1
    } else {
        0
    };
    if a.positionals.len() != count {
        return Err(format!(
            "{} requires {count} positional arguments",
            a.command
        ));
    }
    if a.member.is_some() && a.version.is_none() {
        return Err("--member requires --version".into());
    }
    validate_limits(a)?;
    Ok(())
}

fn validate_options(a: &Args, seen: &HashSet<String>) -> Result<(), String> {
    let invalid = invalid_filter_options(a, seen) || invalid_relation_options(a);
    if invalid {
        Err("option is not applicable to this command".into())
    } else {
        Ok(())
    }
}

fn set_query_value(a: &mut Args, name: &str, v: String) -> Result<(), String> {
    match name {
        "--kind" => a.kind = Some(v),
        "--tag" => a.tags.push(v),
        "--slot" => a.slot = Some(v),
        "--version" => a.version = Some(v),
        "--member" => a.member = Some(v),
        "--type" => a.types.push(v),
        "--direction" => a.direction = Some(v),
        _ => return set_numeric(a, name, &v),
    }
    Ok(())
}

fn check_duplicate(seen: &mut HashSet<String>, x: &str) -> Result<(), String> {
    if x.starts_with("--") && x != "--tag" && x != "--type" && !seen.insert(x.to_string()) {
        Err(format!("duplicate option {x}"))
    } else {
        Ok(())
    }
}

fn validate_limits(a: &Args) -> Result<(), String> {
    if a.limit == Some(0) || a.depth == Some(0) || a.nodes == Some(0) || a.edges == Some(0) {
        return Err("limits must be positive".into());
    }
    if a.kind
        .as_ref()
        .is_some_and(|s| !matches!(s.as_str(), "collection" | "resource"))
        || a.direction
            .as_ref()
            .is_some_and(|s| !matches!(s.as_str(), "upstream" | "downstream"))
    {
        return Err("invalid kind or direction".into());
    }
    Ok(())
}

fn has_list_options(a: &Args) -> bool {
    a.view.is_some()
        || a.collection.is_some()
        || a.descendants
        || a.kind.is_some()
        || !a.tags.is_empty()
        || a.slot.is_some()
}
fn has_trace_options(a: &Args) -> bool {
    !a.types.is_empty()
        || a.direction.is_some()
        || a.depth.is_some()
        || a.nodes.is_some()
        || a.edges.is_some()
}

fn set_flag(a: &mut Args, name: &str) -> bool {
    match name {
        "--json" => a.json = true,
        "--brief" => a.view = Some(ListView::Brief),
        "--tree" => a.view = Some(ListView::Tree),
        "--descendants" => a.descendants = true,
        "--metadata" => a.metadata = true,
        _ => return false,
    }
    true
}

fn invalid_filter_options(a: &Args, seen: &HashSet<String>) -> bool {
    (a.command != "list" && has_list_options(a))
        || (!matches!(a.command.as_str(), "list" | "search")
            && (seen.contains("--offset") || a.limit.is_some()))
        || (a.command != "search" && a.metadata)
        || (a.descendants && a.collection.is_none())
}
fn invalid_relation_options(a: &Args) -> bool {
    (!matches!(a.command.as_str(), "show" | "trace") && (a.version.is_some() || a.member.is_some()))
        || (a.command != "trace" && has_trace_options(a))
}
