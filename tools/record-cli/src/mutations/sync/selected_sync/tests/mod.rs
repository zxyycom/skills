use super::*;
fn entry(state: u8, revision: &str) -> Entry<u8> {
    Entry {
        state,
        revision: revision.into(),
    }
}
#[test]
fn selected_change_keeps_unread_baseline_and_reports_only_observed_coverage() {
    let baseline = BTreeMap::from([
        ("a".into(), entry(1, "a1")),
        ("unread".into(), entry(2, "old")),
    ]);
    let projected = project_selected(
        &baseline,
        &[SelectedUpdate {
            id: "a".into(),
            current: Some(entry(3, "a2")),
            located_from: None,
        }],
        &["neighbor".into()],
        |_| Ok::<_, ()>(()),
    )
    .unwrap();
    assert_eq!(projected.entries["unread"], baseline["unread"]);
    assert_eq!(projected.changed_ids, vec!["a"]);
    assert_eq!(projected.checked_ids, vec!["a", "neighbor"]);
}
#[test]
fn deletion_and_rename_require_explicit_selection_and_valid_combined_graph() {
    let baseline = BTreeMap::from([("old".into(), entry(1, "r"))]);
    let updates = vec![
        SelectedUpdate {
            id: "old".into(),
            current: None,
            located_from: None,
        },
        SelectedUpdate {
            id: "new".into(),
            current: Some(entry(1, "new")),
            located_from: Some("old".into()),
        },
    ];
    let projection = project_selected(&baseline, &updates, &[], |_| Ok::<_, ()>(())).unwrap();
    assert_eq!(projection.changed_ids, vec!["new", "old"]);
    assert_eq!(
        project_selected(
            &baseline,
            &[SelectedUpdate {
                id: "new".into(),
                current: Some(entry(1, "new")),
                located_from: None
            }],
            &[],
            |_| Ok::<_, ()>(())
        ),
        Err(SelectedError::NewIdentityRequiresSelectedLocator(
            "new".into()
        ))
    );
    assert_eq!(
        project_selected(&baseline, &updates, &[], |_| Err("bad graph")),
        Err(SelectedError::InvalidProjection("bad graph"))
    );
    assert_eq!(
        project_selected(
            &baseline,
            &[SelectedUpdate {
                id: "missing".into(),
                current: None,
                located_from: None
            }],
            &[],
            |_| Ok::<_, ()>(())
        ),
        Err(SelectedError::UnknownSelection("missing".into()))
    );
}

#[test]
fn selector_failures_preserve_order_targets_and_recovery() {
    use crate::source_revision::Domain;
    let selectors = vec!["missing1".to_owned(), "missing2".to_owned()];
    for domain in [Domain::Decision, Domain::Investigation] {
        let entries = BTreeMap::<String, String>::new();
        let error = resolve_selection(&entries, &selectors, String::as_str, domain, "index.json")
            .unwrap_err();
        assert_eq!(error.diagnostics.len(), 2);
        for (diagnostic, target) in error.diagnostics.iter().zip(&selectors) {
            assert_eq!(diagnostic.target.as_ref(), Some(target));
            assert!(diagnostic.reason.as_ref().unwrap().contains(target));
            assert!(diagnostic.recovery.is_some());
        }
    }
}

#[test]
fn selector_validation_aggregates_invalid_and_duplicate_before_baseline() {
    use crate::source_revision::Domain;
    let selectors = vec!["bad ".into(), "same".into(), "same".into(), "".into()];
    let error = require_selection(&selectors, Domain::Decision).unwrap_err();
    let codes: Vec<_> = error
        .diagnostics
        .iter()
        .map(|item| item.code.as_str())
        .collect();
    assert_eq!(
        codes,
        [
            "decision-records.selector-invalid",
            "decision-records.selector-duplicate",
            "decision-records.selector-invalid"
        ]
    );
}
