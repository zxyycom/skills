use super::*;

const FLAGS: [&str; 3] = ["json", "detail", "full-time"];

const LIST_OPTIONS: &[&str] = &[
    "tag",
    "related-to",
    "direction",
    "relation-type",
    "limit",
    "offset",
    "detail",
];
const SEARCH_OPTIONS: &[&str] = &[
    "in",
    "match",
    "tag",
    "related-to",
    "direction",
    "relation-type",
    "limit",
];
const DECISION_LIST_OPTIONS: &[&str] = &[
    "status",
    "alignment",
    "created-from",
    "created-to",
    "full-time",
];

pub(super) struct ParsedArguments {
    pub values: HashMap<String, Vec<String>>,
    pub positional: Vec<String>,
}

pub(super) fn parse_arguments(
    domain: Domain,
    command: &str,
    argv: &[String],
) -> Result<ParsedArguments, ArgumentError> {
    let mut values: HashMap<String, Vec<String>> = HashMap::new();
    let mut positional = Vec::new();
    let mut index = 1;
    while index < argv.len() {
        let arg = &argv[index];
        if let Some(option) = arg.strip_prefix("--") {
            let (name, value) = parse_option(option, arg, argv, &mut index)?;
            values.entry(name).or_default().push(value);
        } else {
            positional.push(arg.clone());
        }
        index += 1;
    }
    validate_option_names(domain, command, &values)?;
    Ok(ParsedArguments { values, positional })
}

fn parse_option(
    option: &str,
    arg: &str,
    argv: &[String],
    index: &mut usize,
) -> Result<(String, String), ArgumentError> {
    let (name, inline) = option
        .split_once('=')
        .map_or((option, None), |(n, v)| (n, Some(v)));
    if name.is_empty() {
        return Err(ArgumentError(format!("invalid option {arg}")));
    }
    let value = if FLAGS.contains(&name) {
        if inline.is_some() {
            return Err(ArgumentError(format!("--{name} does not take a value")));
        }
        String::new()
    } else if let Some(value) = inline {
        if value.is_empty() {
            return Err(ArgumentError(format!("--{name} needs a value")));
        }
        value.to_owned()
    } else {
        *index += 1;
        let value = argv
            .get(*index)
            .ok_or_else(|| ArgumentError(format!("--{name} needs a value")))?;
        if value.starts_with("--") {
            return Err(ArgumentError(format!("--{name} needs a value")));
        }
        value.clone()
    };
    Ok((name.to_string(), value))
}

fn allowed_options(domain: Domain, command: &str) -> Vec<&'static str> {
    let mut allowed = vec!["root", "json"];
    allowed.push(domain.directory_option());
    match command {
        "check" if domain == Domain::Investigation => allowed.extend(["id"]),
        "list" => {
            allowed.extend_from_slice(LIST_OPTIONS);
            if domain == Domain::Decision {
                allowed.extend_from_slice(DECISION_LIST_OPTIONS);
            } else {
                allowed.extend(["formed-from", "formed-to"]);
            }
        }
        "search" => {
            allowed.extend_from_slice(SEARCH_OPTIONS);
            if domain == Domain::Decision {
                allowed.extend(["status", "alignment"]);
            } else {
                allowed.extend(["formed-from", "formed-to"]);
            }
        }
        "trace" => allowed.extend(["direction", "depth", "max-records"]),
        _ => {}
    }
    allowed
}

fn validate_option_names(
    domain: Domain,
    command: &str,
    values: &HashMap<String, Vec<String>>,
) -> Result<(), ArgumentError> {
    let allowed = allowed_options(domain, command);
    for (key, entries) in values {
        if !allowed.contains(&key.as_str()) {
            return Err(ArgumentError(format!("{command} does not accept --{key}")));
        }
        if !["tag", "id"].contains(&key.as_str()) && entries.len() > 1 {
            return Err(ArgumentError(format!("--{key} may occur only once")));
        }
    }
    Ok(())
}

pub(super) fn validate_filters(
    domain: Domain,
    values: &HashMap<String, Vec<String>>,
) -> Result<Vec<String>, ArgumentError> {
    let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
    let tags = values.get("tag").cloned().unwrap_or_default();
    if tags.iter().collect::<HashSet<_>>().len() != tags.len() {
        return Err(ArgumentError("duplicate tag".into()));
    }
    if tags.iter().any(|tag| !crate::domains::is_kebab(tag)) {
        return Err(ArgumentError("invalid tag".into()));
    }
    if let Some(ids) = values.get("id")
        && (ids.iter().any(|id| !crate::domains::is_kebab(id))
            || ids.iter().collect::<HashSet<_>>().len() != ids.len())
    {
        return Err(ArgumentError("invalid or duplicate id".into()));
    }
    validate_dates(values)?;
    if let Some(kind) = get("relation-type") {
        let allowed: &[&str] = match domain {
            Domain::Decision => &["修订", "替代", "判定无效", "归并", "拆分", "重划"],
            Domain::Investigation => &["补充", "复查", "修正", "推翻", "归并", "拆分"],
        };
        if !allowed.contains(&kind.as_str()) {
            return Err(ArgumentError("invalid --relation-type".into()));
        }
    }
    Ok(tags)
}

fn parse_date(key: &str, value: &str) -> Result<time::OffsetDateTime, ArgumentError> {
    let length = value.len();
    let strict_shape = (length == 20 && value.ends_with('Z'))
        || (length == 25 && matches!(value.as_bytes().get(19), Some(b'+' | b'-')));
    if !strict_shape {
        return Err(ArgumentError(format!("invalid --{key}")));
    }
    time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339)
        .map_err(|_| ArgumentError(format!("invalid --{key}")))
}

fn validate_dates(values: &HashMap<String, Vec<String>>) -> Result<(), ArgumentError> {
    let mut parsed = HashMap::new();
    for key in ["created-from", "created-to", "formed-from", "formed-to"] {
        if let Some(value) = values.get(key).and_then(|entries| entries.first()) {
            parsed.insert(key, parse_date(key, value)?);
        }
    }
    for (start, end) in [("created-from", "created-to"), ("formed-from", "formed-to")] {
        if let (Some(a), Some(b)) = (parsed.get(start), parsed.get(end))
            && a > b
        {
            return Err(ArgumentError(format!("--{start} exceeds --{end}")));
        }
    }
    Ok(())
}

pub(super) fn validate_presence(
    command: &str,
    values: &HashMap<String, Vec<String>>,
    positional: &[String],
) -> Result<(), ArgumentError> {
    let flags = ["json", "detail", "full-time"];
    if values.iter().any(|(key, entries)| {
        !flags.contains(&key.as_str()) && entries.iter().any(|value| value.is_empty())
    }) {
        return Err(ArgumentError("empty option value".into()));
    }
    if positional.iter().any(String::is_empty) {
        return Err(ArgumentError("empty positional argument".into()));
    }
    let want_positionals = matches!(command, "show" | "show-candidate" | "trace" | "search");
    if positional.len() != usize::from(want_positionals) {
        return Err(ArgumentError(format!(
            "{command} expects {} positional argument(s)",
            usize::from(want_positionals)
        )));
    }
    Ok(())
}
