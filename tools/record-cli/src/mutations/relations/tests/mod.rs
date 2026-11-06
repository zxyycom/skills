use super::*;

fn edge(target: &str, summary: Option<&str>) -> Relation<u8> {
    Relation {
        kind: 1,
        target: target.into(),
        summary: summary.map(str::to_owned),
    }
}
fn source(id: &str, candidate: bool) -> SelectedSource<u8> {
    SelectedSource {
        id: id.into(),
        candidate,
        before: vec![edge("previous", Some("old"))],
    }
}

#[test]
fn groups_replace_completely_but_unmentioned_source_is_preserved() {
    let selected = vec![source("a", false), source("b", true)];
    let replacement = Replacement::Groups(vec![RelationGroup {
        source: "a".into(),
        relations: vec![edge("previous", None)],
    }]);
    let planned = plan_relations(&selected, &replacement).unwrap();
    assert_eq!(planned[0].action, ReviewAction::Replace);
    assert_eq!(planned[0].after[0].summary, None);
    assert_eq!(planned[1].action, ReviewAction::Establish);
    assert_eq!(planned[1].before, planned[1].after);
}

#[test]
fn clear_is_not_preserve_and_unchanged_is_reported() {
    let selected = vec![
        source("a", false),
        SelectedSource {
            id: "b".into(),
            candidate: false,
            before: vec![],
        },
    ];
    let planned = plan_relations(&selected, &Replacement::All(vec![])).unwrap();
    assert_eq!(planned[0].action, ReviewAction::Replace);
    assert!(planned[0].after.is_empty());
    assert_eq!(planned[1].action, ReviewAction::Unchanged);
}

#[test]
fn rejects_unknown_and_duplicate_resolved_sources_or_targets() {
    let selected = vec![source("a", false)];
    assert_eq!(
        plan_relations(
            &selected,
            &Replacement::Groups(vec![RelationGroup {
                source: "missing".into(),
                relations: vec![]
            }])
        ),
        Err(RelationPlanError::UnknownSource("missing".into()))
    );
    assert!(matches!(
        plan_relations(
            &selected,
            &Replacement::All(vec![edge("x", None), edge("x", Some("two"))])
        ),
        Err(RelationPlanError::DuplicateTarget { .. })
    ));
    assert!(matches!(
        plan_relations(
            &[source("a", false), source("a", true)],
            &Replacement::Preserve
        ),
        Err(RelationPlanError::DuplicateSource(_))
    ));
}
#[test]
fn review_json_keeps_domain_edge_names_and_omits_absent_summary() {
    use crate::mutations::contract::DecisionRelationKind;
    let entry = SourceReview {
        source_id: "a".into(),
        action: ReviewAction::Establish,
        before: vec![],
        after: vec![Relation {
            kind: DecisionRelationKind::Revision,
            target: "b".into(),
            summary: None,
        }],
    };
    let actual = serde_json::to_value(review(vec![entry], ReviewPhase::Preflight)).unwrap();
    assert_eq!(
        actual,
        serde_json::json!({
            "phase": "preflight",
            "sources": [{"sourceId": "a", "action": "establish", "before": [], "after": [{"type": "修订", "target": "b"}]}]
        })
    );
}
