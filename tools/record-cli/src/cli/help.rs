use super::*;

pub(super) fn command_names(domain: Domain) -> &'static [&'static str] {
    match domain {
        Domain::Decision => &[
            "archive",
            "candidates",
            "check",
            "discard",
            "evolve",
            "list",
            "mark-aligned",
            "new",
            "publish",
            "reactivate",
            "rename",
            "search",
            "set-relations",
            "show",
            "show-candidate",
            "stage",
            "sync-index",
            "trace",
        ],
        Domain::Investigation => &[
            "candidates",
            "check",
            "discard",
            "list",
            "new",
            "publish",
            "rename",
            "search",
            "set-relations",
            "show",
            "show-candidate",
            "stage",
            "sync-index",
            "trace",
        ],
    }
}
fn help_arguments(domain: Domain, command: &str) -> &'static str {
    let entries = [
        ("archive", None, "SELECTOR... [--keep-unrecorded-history]"),
        ("candidates", None, ""),
        ("check", Some(Domain::Investigation), "[--id ID]..."),
        ("check", None, ""),
        (
            "discard",
            Some(Domain::Decision),
            "SELECTOR [--delete-recorded]",
        ),
        (
            "discard",
            None,
            "SELECTOR [--delete-recorded] [--delete-owned-resources]",
        ),
        (
            "evolve",
            None,
            "--successor ALIGNMENT=SELECTOR [--successor ALIGNMENT=SELECTOR]... [--discard SELECTOR] [--delete-recorded] [--keep-unrecorded-history] [--preflight] [--source SELECTOR] [--relation TYPE=SELECTOR] [--relation-summary SELECTOR=TEXT] [--clear-relations]",
        ),
        (
            "list",
            Some(Domain::Decision),
            "[--tag TAG]... [--status active|archived|all] [--alignment aligned|unaligned|all] [--created-from TIMESTAMP] [--created-to TIMESTAMP] [--related-to SELECTOR] [--direction both|predecessors|successors] [--relation-type TYPE] [--limit N] [--offset N] [--detail]",
        ),
        (
            "list",
            None,
            "[--tag TAG]... [--related-to SELECTOR] [--direction both|predecessors|successors] [--relation-type TYPE] [--limit N] [--offset N] [--detail]",
        ),
        ("mark-aligned", None, "SELECTOR"),
        (
            "new",
            Some(Domain::Decision),
            "SELECTOR --title TEXT --purpose TEXT --background TEXT --decision TEXT [--tag TAG]... [--relation TYPE=SELECTOR]... [--relation-summary SELECTOR=TEXT]... [--preflight-alignment aligned|unaligned]",
        ),
        (
            "new",
            None,
            "SELECTOR --title TEXT --question TEXT --tag TAG [--tag TAG]... [--relation TYPE=SELECTOR]... [--relation-summary SELECTOR=TEXT]... [--formed-at TIMESTAMP]",
        ),
        (
            "publish",
            Some(Domain::Decision),
            "SELECTOR --alignment aligned|unaligned [--keep-unrecorded-history] [--preflight]",
        ),
        ("publish", None, "SELECTOR... [--preflight]"),
        (
            "reactivate",
            None,
            "SELECTOR --alignment aligned|unaligned [--preflight]",
        ),
        (
            "rename",
            None,
            "SOURCE TARGET [recorded confirmation] [--preflight]",
        ),
        (
            "search",
            Some(Domain::Decision),
            "TEXT [--in content|metadata] [--match all|any|phrase] [--tag TAG]... [--status active|archived|all] [--alignment aligned|unaligned|all] [--related-to SELECTOR] [--direction both|predecessors|successors] [--relation-type TYPE] [--limit N]",
        ),
        (
            "search",
            None,
            "TEXT [--in content|metadata] [--match all|any|phrase] [--tag TAG]... [--related-to SELECTOR] [--direction both|predecessors|successors] [--relation-type TYPE] [--limit N]",
        ),
        (
            "set-relations",
            None,
            "--source SELECTOR (--relation TYPE=SELECTOR | --clear-relations)... [--relation-summary SELECTOR=TEXT]... [--preflight]",
        ),
        ("show", None, "SELECTOR"),
        ("show-candidate", None, "SELECTOR"),
        ("stage", None, "SELECTOR... [--scope all|index|domain]"),
        ("sync-index", None, "[--select SELECTOR]... [--preflight]"),
        (
            "trace",
            None,
            "SELECTOR [--direction both|predecessors|successors] [--depth N|all] [--max-records N]",
        ),
    ];
    entries
        .iter()
        .find(|(name, required_domain, _)| {
            *name == command && required_domain.is_none_or(|required| required == domain)
        })
        .map_or("", |(_, _, arguments)| *arguments)
}

pub(super) fn print_help(domain: Domain, topic: Option<&str>) {
    let executable = match domain {
        Domain::Decision => "decision-records",
        Domain::Investigation => "investigation-report",
    };
    let directory = match domain {
        Domain::Decision => "--decisions-dir",
        Domain::Investigation => "--investigations-dir",
    };
    if let Some(command) = topic {
        let arguments = help_arguments(domain, command);
        println!(
            "Usage: {executable} {command} {arguments} [--root PATH] [{directory} PATH] [--json]"
        );
        if command == "new" {
            println!(
                "Relations identify predecessors; summaries explain each selected relation. The new scaffold can be valid before its body is ready for publication."
            );
        }
    } else {
        println!(
            "Usage: {executable} <command> [options]\n\nCommands: {}\n\nUse '{executable} help <command>' for arguments. Global options: --root PATH, {directory} PATH, --json, --help, --version.",
            command_names(domain).join(", ")
        );
    }
}
