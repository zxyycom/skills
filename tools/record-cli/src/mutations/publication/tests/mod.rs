use super::*;
fn candidate(id: &str) -> InvestigationCandidate {
    InvestigationCandidate {
        id: id.into(),
        source_path: format!("_candidate.{id}"),
        body_ready: true,
        resource_ready: true,
        relations: vec![],
    }
}
#[test]
fn batch_targets_may_refer_to_selected_candidates_but_graph_validation_is_required() {
    let mut first = candidate("first");
    first.relations.push(Relation {
        summary_selector: None,
        kind: InvestigationRelationKind::Supplement,
        target: "second".into(),
        summary: None,
    });
    let second = candidate("second");
    let selected = vec![first, second];
    let plan = plan_investigation_publication(&selected, &HashSet::new(), &HashSet::new(), |_| {
        Ok::<_, ()>(())
    })
    .unwrap();
    assert_eq!(plan[0].formal_path, "first.md");
    assert_eq!(plan[0].relation_review.action, ReviewAction::Establish);
    assert_eq!(
        plan_investigation_publication(&selected, &HashSet::new(), &HashSet::new(), |_| Err(
            "invalid graph"
        )),
        Err(PublicationError::FinalGraph("invalid graph"))
    );
    assert!(matches!(
        plan_investigation_publication(&selected[..1], &HashSet::new(), &HashSet::new(), |_| Ok::<
            _,
            (),
        >(
            ()
        )),
        Err(PublicationError::MissingTarget { .. })
    ));
}
