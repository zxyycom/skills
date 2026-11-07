use super::*;

pub(super) fn parse_args(argv: &[String]) -> Result<Args, ArgumentError> {
    let flags = [
        "json",
        "preflight",
        "delete-recorded",
        "delete-owned-resources",
        "keep-unrecorded-history",
        "clear-relations",
        "rename-recorded-decision",
        "rename-recorded-report",
        "rename-recorded-candidate",
    ];
    let mut args = Args {
        options: vec![],
        positional: vec![],
    };
    let mut i = 1;
    while i < argv.len() {
        let item = &argv[i];
        if let Some(option) = item.strip_prefix("--") {
            let (key, value) = parse_option(option, argv, &mut i, &flags)?;
            args.options.push((key, value));
        } else {
            args.positional.push(item.clone());
        }
        i += 1;
    }
    Ok(args)
}

fn parse_option(
    option: &str,
    argv: &[String],
    index: &mut usize,
    flags: &[&str],
) -> Result<(String, String), ArgumentError> {
    let (key, inline) = option
        .split_once('=')
        .map_or((option, None), |(k, v)| (k, Some(v)));
    if key.is_empty() {
        return Err(ArgumentError("invalid option".into()));
    }
    let value = if flags.contains(&key) {
        if inline.is_some() {
            return Err(ArgumentError(format!("--{key} does not take a value")));
        }
        String::new()
    } else if let Some(value) = inline {
        if value.is_empty() {
            return Err(ArgumentError(format!("--{key} needs a value")));
        }
        value.to_owned()
    } else {
        *index += 1;
        let value = argv
            .get(*index)
            .ok_or_else(|| ArgumentError(format!("--{key} needs a value")))?;
        if value.is_empty() || value.starts_with("--") {
            return Err(ArgumentError(format!("--{key} needs a value")));
        }
        value.clone()
    };
    Ok((key.into(), value))
}
