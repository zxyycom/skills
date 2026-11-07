use super::*;

type CommandParser = fn(&Args) -> Result<MutationCommand, ArgumentError>;

pub(super) fn parse(command: &str, args: &Args) -> Result<MutationCommand, ArgumentError> {
    let parsers: &[(&str, CommandParser)] = &[
        ("new", parse_new),
        ("publish", parse_publish),
        ("discard", parse_discard),
        ("rename", parse_rename),
        ("set-relations", parse_set_relations),
        ("sync-index", parse_sync_index),
        ("stage", parse_stage),
    ];
    let parser = parsers
        .iter()
        .find(|(name, _)| *name == command)
        .ok_or_else(|| ArgumentError(format!("unknown mutation command: {command}")))?
        .1;
    parser(args)
}

fn parse_new(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    if let Some(value) = args.one("formed-at")
        && !crate::domains::valid_timestamp(&value)
    {
        return Err(ArgumentError("invalid --formed-at".into()));
    }
    let tags = parse_tags(args, true)?;
    Ok(MutationCommand::Investigation(InvestigationCommand::New {
        selector: position(0),
        title: args.required("title")?,
        question: args.required("question")?,
        tags,
        relations: relations(&args.options, investigation_kind)?,
        formed_at: args.one("formed-at"),
    }))
}

fn parse_publish(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    args.positionals(1, usize::MAX)?;
    Ok(MutationCommand::Investigation(
        InvestigationCommand::Publish {
            selectors: args.positional.clone(),
            preflight,
        },
    ))
}

fn parse_discard(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    Ok(MutationCommand::Investigation(
        InvestigationCommand::Discard {
            selector: position(0),
            delete_recorded: args.has("delete-recorded"),
            delete_owned_resources: args.has("delete-owned-resources"),
        },
    ))
}

fn parse_rename(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    let position = |i: usize| args.positional[i].clone();
    args.positionals(2, 2)?;
    Ok(MutationCommand::Investigation(
        InvestigationCommand::Rename {
            source: position(0),
            target: position(1),
            rename_recorded_report: args.has("rename-recorded-report"),
            rename_recorded_candidate: args.has("rename-recorded-candidate"),
            preflight,
        },
    ))
}

fn parse_set_relations(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    args.positionals(0, 0)?;
    Ok(MutationCommand::Investigation(
        InvestigationCommand::SetRelations {
            groups: groups(args, investigation_kind)?,
            preflight,
        },
    ))
}

fn parse_sync_index(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    args.positionals(0, 0)?;
    Ok(MutationCommand::Investigation(
        InvestigationCommand::SyncIndex {
            selectors: args.values("select"),
            preflight,
        },
    ))
}

fn parse_stage(args: &Args) -> Result<MutationCommand, ArgumentError> {
    args.positionals(1, usize::MAX)?;
    Ok(MutationCommand::Investigation(
        InvestigationCommand::Stage {
            selectors: args.positional.clone(),
            scope: scope(args.one("scope").as_deref().unwrap_or("all"))?,
        },
    ))
}
