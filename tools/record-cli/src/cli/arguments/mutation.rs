//! Parse mutation syntax into typed intentions. Parsing never performs I/O.
use crate::{
    cli::{ArgumentError, Domain},
    mutations::contract::{
        Alignment, DecisionCommand, DecisionRelationKind, DecisionRelationOverride,
        InvestigationCommand, InvestigationRelationKind, Relation, RelationGroup, Successor,
    },
    stage::StageScope,
};
use std::collections::{HashMap, HashSet};

mod arguments;
mod decision;
mod investigation;
mod relations;

use arguments::parse_args;
use relations::{decision_kind, groups, investigation_kind, pair, relations};

#[derive(Debug)]
pub enum MutationCommand {
    Decision(DecisionCommand),
    Investigation(InvestigationCommand),
}
#[derive(Debug)]
pub struct MutationInvocation {
    pub config: Option<String>,
    pub key: Option<String>,
    pub explicit_location: bool,
    pub root: String,
    pub directory: String,
    pub json: bool,
    pub command: MutationCommand,
}
struct Args {
    options: Vec<(String, String)>,
    positional: Vec<String>,
}
impl Args {
    fn values(&self, key: &str) -> Vec<String> {
        self.options
            .iter()
            .filter(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
            .collect()
    }
    fn one(&self, key: &str) -> Option<String> {
        self.options
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
    }
    fn has(&self, key: &str) -> bool {
        self.options.iter().any(|(k, _)| k == key)
    }
    fn has_location(&self, domain: Domain) -> bool {
        self.has("root") || self.has(domain.directory_option())
    }
    fn required(&self, key: &str) -> Result<String, ArgumentError> {
        self.one(key)
            .ok_or_else(|| ArgumentError(format!("--{key} is required")))
    }
    fn positionals(&self, min: usize, max: usize) -> Result<(), ArgumentError> {
        if self.positional.len() < min
            || self.positional.len() > max
            || self.positional.iter().any(String::is_empty)
        {
            Err(ArgumentError("invalid positional arguments".into()))
        } else {
            Ok(())
        }
    }
}
fn parse_tags(args: &Args, required: bool) -> Result<Vec<String>, ArgumentError> {
    let tags = args.values("tag");
    if (required && tags.is_empty())
        || tags.iter().any(|tag| !crate::domains::is_kebab(tag))
        || tags.iter().collect::<HashSet<_>>().len() != tags.len()
    {
        return Err(ArgumentError("invalid or duplicate tags".into()));
    }
    Ok(tags)
}

fn alignment(s: &str) -> Result<Alignment, ArgumentError> {
    match s {
        "aligned" => Ok(Alignment::Aligned),
        "unaligned" => Ok(Alignment::Unaligned),
        _ => Err(ArgumentError("invalid alignment".into())),
    }
}
fn scope(s: &str) -> Result<StageScope, ArgumentError> {
    match s {
        "all" => Ok(StageScope::All),
        "index" => Ok(StageScope::Index),
        "domain" => Ok(StageScope::Domain),
        _ => Err(ArgumentError("invalid scope".into())),
    }
}
fn normalized(value: &str) -> String {
    if value.len() >= 3
        && value
            .get(value.len() - 3..)
            .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".md"))
    {
        value[..value.len() - 3].to_owned()
    } else {
        value.to_owned()
    }
}

const MUTATION_OPTIONS: &[(Domain, &str, &[&str])] = &[
    (Domain::Decision, "archive", &["keep-unrecorded-history"]),
    (Domain::Decision, "mark-aligned", &[]),
    (Domain::Decision, "reactivate", &["alignment", "preflight"]),
    (
        Domain::Decision,
        "evolve",
        &[
            "successor",
            "discard",
            "delete-recorded",
            "keep-unrecorded-history",
            "preflight",
            "source",
            "relation",
            "relation-summary",
            "clear-relations",
        ],
    ),
    (
        Domain::Decision,
        "new",
        &[
            "title",
            "tag",
            "relation",
            "relation-summary",
            "purpose",
            "background",
            "decision",
            "preflight-alignment",
        ],
    ),
    (
        Domain::Investigation,
        "new",
        &[
            "title",
            "tag",
            "relation",
            "relation-summary",
            "question",
            "formed-at",
        ],
    ),
    (
        Domain::Decision,
        "publish",
        &["preflight", "alignment", "keep-unrecorded-history"],
    ),
    (Domain::Investigation, "publish", &["preflight"]),
    (Domain::Decision, "discard", &["delete-recorded"]),
    (
        Domain::Investigation,
        "discard",
        &["delete-recorded", "delete-owned-resources"],
    ),
    (
        Domain::Decision,
        "rename",
        &["preflight", "rename-recorded-decision"],
    ),
    (
        Domain::Investigation,
        "rename",
        &[
            "preflight",
            "rename-recorded-report",
            "rename-recorded-candidate",
        ],
    ),
    (
        Domain::Decision,
        "set-relations",
        &[
            "source",
            "relation",
            "relation-summary",
            "clear-relations",
            "preflight",
        ],
    ),
    (
        Domain::Investigation,
        "set-relations",
        &[
            "source",
            "relation",
            "relation-summary",
            "clear-relations",
            "preflight",
        ],
    ),
    (Domain::Decision, "sync-index", &["select", "preflight"]),
    (
        Domain::Investigation,
        "sync-index",
        &["select", "preflight"],
    ),
    (Domain::Decision, "stage", &["scope"]),
    (Domain::Investigation, "stage", &["scope"]),
];

fn allowed_options(domain: Domain, command: &str) -> Result<Vec<&'static str>, ArgumentError> {
    use Domain::{Decision, Investigation};
    let options = MUTATION_OPTIONS
        .iter()
        .find(|(candidate_domain, name, _)| *candidate_domain == domain && *name == command)
        .ok_or_else(|| ArgumentError(format!("unknown mutation command: {command}")))?
        .2;
    let directory = match domain {
        Decision => "decisions-dir",
        Investigation => "investigations-dir",
    };
    let mut allowed = vec!["json", "root", directory];
    if domain == Domain::Investigation {
        allowed.extend(["config", "key"]);
    }
    allowed.extend_from_slice(options);
    Ok(allowed)
}

fn validate_options(domain: Domain, command: &str, args: &Args) -> Result<(), ArgumentError> {
    let allowed = allowed_options(domain, command)?;
    let repeatable = [
        "tag",
        "relation",
        "relation-summary",
        "source",
        "select",
        "successor",
    ];
    let mut count = HashMap::new();
    for (key, _) in &args.options {
        if !allowed.contains(&key.as_str()) {
            return Err(ArgumentError(format!("{command} does not accept --{key}")));
        }
        let n = count.entry(key).or_insert(0usize);
        *n += 1;
        if *n > 1
            && !repeatable.contains(&key.as_str())
            && !(key == "clear-relations" && args.has("source"))
        {
            return Err(ArgumentError(format!("--{key} may occur only once")));
        }
    }
    validate_selectors(command, args)?;
    validate_location(domain, args)
}

fn validate_selectors(command: &str, args: &Args) -> Result<(), ArgumentError> {
    if matches!(command, "archive" | "publish" | "stage") {
        let selectors: Vec<_> = args
            .positional
            .iter()
            .map(|value| normalized(value))
            .collect();
        if selectors.iter().collect::<HashSet<_>>().len() != selectors.len() {
            return Err(ArgumentError("duplicate selector".into()));
        }
    }
    if command == "sync-index" {
        return Ok(());
    }
    let selections: Vec<_> = args
        .values("select")
        .iter()
        .map(|value| normalized(value))
        .collect();
    if selections.iter().collect::<HashSet<_>>().len() != selections.len() {
        return Err(ArgumentError("duplicate selector".into()));
    }
    Ok(())
}

fn validate_location(domain: Domain, args: &Args) -> Result<(), ArgumentError> {
    if args.has("key") && args.has_location(domain) {
        return Err(ArgumentError(
            "--root/--investigations-dir conflict with --key".into(),
        ));
    }
    Ok(())
}

pub fn parse_mutation(
    domain: Domain,
    argv: &[String],
) -> Result<MutationInvocation, ArgumentError> {
    let command = argv
        .first()
        .ok_or_else(|| ArgumentError("missing command".into()))?
        .as_str();
    let args = parse_args(argv)?;
    validate_options(domain, command, &args)?;
    let root = args.one("root").unwrap_or_else(|| ".".into());
    let directory = args
        .one(domain.directory_option())
        .unwrap_or_else(|| domain.default_directory().into());
    let json = args.has("json");
    let parsed = match domain {
        Domain::Decision => decision::parse(command, &args)?,
        Domain::Investigation => investigation::parse(command, &args)?,
    };
    Ok(MutationInvocation {
        config: args.one("config"),
        key: args.one("key"),
        explicit_location: args.has_location(domain),
        root,
        directory,
        json,
        command: parsed,
    })
}

#[cfg(test)]
mod tests;
