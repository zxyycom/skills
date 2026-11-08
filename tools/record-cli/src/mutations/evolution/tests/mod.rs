use super::*;
#[test]
fn candidate_evolution_archives_active_predecessor_and_requires_history_confirmation() {
    let candidate = Successor {
        id: "new".into(),
        candidate: true,
        body_ready: true,
        existing_alignment: None,
        requested_alignment: Alignment::Unaligned,
        before: vec![Relation {
            summary_selector: None,
            kind: DecisionRelationKind::Revision,
            target: "old".into(),
            summary: None,
        }],
        after: vec![Relation {
            summary_selector: None,
            kind: DecisionRelationKind::Revision,
            target: "old".into(),
            summary: None,
        }],
    };
    let predecessors = BTreeMap::from([(
        "old".into(),
        Predecessor {
            status: Status::Active,
            history: HistoryFact::Unrecorded,
        },
    )]);
    let selection = [candidate];
    assert_eq!(
        plan_evolution(&selection, &predecessors, None, false, |_| Ok::<_, ()>(())),
        Err(EvolutionError::HistoryConfirmationRequired("old".into()))
    );
    let result =
        plan_evolution(&selection, &predecessors, None, true, |_| Ok::<_, ()>(())).unwrap();
    assert_eq!(result.archive_ids, vec!["old"]);
    assert_eq!(result.establish_ids, vec!["new"]);
    assert_eq!(result.review[0].action, ReviewAction::Establish);
    assert_eq!(
        plan_evolution(&selection, &predecessors, None, true, |_| Err("bad graph")),
        Err(EvolutionError::FinalGraph("bad graph"))
    );
}
