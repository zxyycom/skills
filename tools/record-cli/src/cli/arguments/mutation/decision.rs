use super::*;

type CommandParser = fn(&Args) -> Result<MutationCommand, ArgumentError>;

pub(super) fn parse(command: &str, args: &Args) -> Result<MutationCommand, ArgumentError> {
    let parsers: &[(&str, CommandParser)] = &[
        ("archive", parse_archive),
        ("mark-aligned", parse_mark_aligned),
        ("reactivate", parse_reactivate),
        ("new", parse_new),
        ("publish", parse_publish),
        ("discard", parse_discard),
        ("rename", parse_rename),
        ("set-relations", parse_set_relations),
        ("sync-index", parse_sync_index),
        ("stage", parse_stage),
        ("evolve", parse_evolve),
    ];
    let parser = parsers
        .iter()
        .find(|(name, _)| *name == command)
        .ok_or_else(|| ArgumentError(format!("unknown mutation command: {command}")))?
        .1;
    parser(args)
}

fn parse_archive(args: &Args) -> Result<MutationCommand, ArgumentError> {
    args.positionals(1, usize::MAX)?;
    Ok(MutationCommand::Decision(DecisionCommand::Archive {
        selectors: args.positional.clone(),
        keep_unrecorded_history: args.has("keep-unrecorded-history"),
    }))
}

fn parse_mark_aligned(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    Ok(MutationCommand::Decision(DecisionCommand::MarkAligned {
        selector: position(0),
    }))
}

fn parse_reactivate(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    Ok(MutationCommand::Decision(DecisionCommand::Reactivate {
        selector: position(0),
        alignment: alignment(&args.required("alignment")?)?,
        preflight,
    }))
}

fn parse_new(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    let tags = parse_tags(args, false)?;
    Ok(MutationCommand::Decision(DecisionCommand::New {
        selector: position(0),
        title: args.required("title")?,
        purpose: args.required("purpose")?,
        background: args.required("background")?,
        decision: args.required("decision")?,
        tags,
        relations: relations(&args.options, decision_kind)?,
        preflight_alignment: args
            .one("preflight-alignment")
            .map(|s| alignment(&s))
            .transpose()?,
    }))
}

fn parse_publish(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    Ok(MutationCommand::Decision(DecisionCommand::Publish {
        selector: position(0),
        alignment: alignment(&args.required("alignment")?)?,
        keep_unrecorded_history: args.has("keep-unrecorded-history"),
        preflight,
    }))
}

fn parse_discard(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let position = |i: usize| args.positional[i].clone();
    args.positionals(1, 1)?;
    Ok(MutationCommand::Decision(DecisionCommand::Discard {
        selector: position(0),
        delete_recorded: args.has("delete-recorded"),
    }))
}

fn parse_rename(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    let position = |i: usize| args.positional[i].clone();
    args.positionals(2, 2)?;
    Ok(MutationCommand::Decision(DecisionCommand::Rename {
        source: position(0),
        target: position(1),
        rename_recorded: args.has("rename-recorded-decision"),
        preflight,
    }))
}

fn parse_set_relations(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    args.positionals(0, 0)?;
    Ok(MutationCommand::Decision(DecisionCommand::SetRelations {
        groups: groups(args, decision_kind)?,
        preflight,
    }))
}

fn parse_sync_index(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    args.positionals(0, 0)?;
    Ok(MutationCommand::Decision(DecisionCommand::SyncIndex {
        selectors: args.values("select"),
        preflight,
    }))
}

fn parse_stage(args: &Args) -> Result<MutationCommand, ArgumentError> {
    args.positionals(1, usize::MAX)?;
    Ok(MutationCommand::Decision(DecisionCommand::Stage {
        selectors: args.positional.clone(),
        scope: scope(args.one("scope").as_deref().unwrap_or("all"))?,
    }))
}

fn parse_evolve(args: &Args) -> Result<MutationCommand, ArgumentError> {
    let preflight = args.has("preflight");
    args.positionals(0, 0)?;
    if args.has("delete-recorded") && !args.has("discard") {
        return Err(ArgumentError("--delete-recorded requires --discard".into()));
    }
    let successors = parse_successors(args)?;
    if successors.is_empty() {
        return Err(ArgumentError(
            "evolve requires at least one successor".into(),
        ));
    }
    let rel = parse_relation_override(args)?;
    Ok(MutationCommand::Decision(DecisionCommand::Evolve {
        successors,
        discard: args.one("discard"),
        relations: rel,
        delete_recorded: args.has("delete-recorded"),
        keep_unrecorded_history: args.has("keep-unrecorded-history"),
        preflight,
    }))
}

fn parse_relation_override(args: &Args) -> Result<DecisionRelationOverride, ArgumentError> {
    let rel = if args.has("source") {
        DecisionRelationOverride::Groups(groups(args, decision_kind)?)
    } else if args.has("relation") || args.has("relation-summary") || args.has("clear-relations") {
        DecisionRelationOverride::All(relations(&args.options, decision_kind)?)
    } else {
        DecisionRelationOverride::Preserve
    };
    Ok(rel)
}

fn parse_successors(args: &Args) -> Result<Vec<Successor>, ArgumentError> {
    let mut successors = Vec::new();
    for raw in args.values("successor") {
        let (a, b) = pair(&raw)?;
        successors.push(Successor {
            selector: b.into(),
            alignment: alignment(a)?,
        });
    }
    let ids: Vec<_> = successors
        .iter()
        .map(|successor| normalized(&successor.selector))
        .collect();
    if ids.iter().collect::<HashSet<_>>().len() != ids.len() {
        return Err(ArgumentError("duplicate successor".into()));
    }
    Ok(successors)
}
