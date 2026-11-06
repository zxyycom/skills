use super::*;
fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|v| (*v).to_string()).collect()
}
#[test]
fn inline_option_values_preserve_relation_equals() {
    let invocation = parse_mutation(
        Domain::Investigation,
        &args(&[
            "set-relations",
            "--source=one",
            "--relation=补充=two",
            "--preflight",
        ]),
    )
    .unwrap();
    let MutationCommand::Investigation(InvestigationCommand::SetRelations { groups, .. }) =
        invocation.command
    else {
        panic!("wrong command")
    };
    assert_eq!(groups[0].relations[0].target, "two");
    assert!(
        parse_mutation(
            Domain::Investigation,
            &args(&["sync-index", "--preflight=true"])
        )
        .is_err()
    );
}
#[test]
fn grouped_replacements_preserve_sources_targets_and_summaries() {
    let argv = args(&[
        "set-relations",
        "--source",
        "one",
        "--relation",
        "补充=two",
        "--relation-summary",
        "two=explanation",
        "--source",
        "three",
        "--clear-relations",
        "--preflight",
    ]);
    let parsed = parse_mutation(Domain::Investigation, &argv).unwrap();
    let MutationCommand::Investigation(InvestigationCommand::SetRelations { groups, preflight }) =
        parsed.command
    else {
        panic!("wrong command")
    };
    assert!(preflight);
    assert_eq!(groups.len(), 2);
    assert_eq!(groups[0].source, "one");
    assert_eq!(groups[0].relations[0].target, "two");
    assert_eq!(
        groups[0].relations[0].summary.as_deref(),
        Some("explanation")
    );
    assert_eq!(groups[1].source, "three");
    assert!(groups[1].relations.is_empty());
}
#[test]
fn mutation_arguments_reject_duplicate_singleton_and_invalid_group() {
    assert!(
        parse_mutation(
            Domain::Decision,
            &args(&["mark-aligned", "id", "--root", "a", "--root", "b"])
        )
        .is_err()
    );
    assert!(
        parse_mutation(
            Domain::Investigation,
            &args(&[
                "set-relations",
                "--source",
                "one",
                "--clear-relations",
                "--relation",
                "补充=two"
            ])
        )
        .is_err()
    );
    assert!(
        parse_mutation(
            Domain::Investigation,
            &args(&["set-relations", "--relation", "补充=two"])
        )
        .is_err()
    );
    assert!(parse_mutation(Domain::Investigation, &args(&["archive", "one"])).is_err());
}
