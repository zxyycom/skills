use super::*;
fn target(candidate: bool) -> DiscardTarget {
    DiscardTarget {
        id: "a".into(),
        source_path: "a.md".into(),
        candidate,
        owned_resources: vec!["_resources/a/x.png".into()],
    }
}
#[test]
fn blocks_formal_references_and_requires_resource_and_history_confirmation() {
    let t = target(false);
    let r = PublishedReferences {
        source_id: "b".into(),
        relation_targets: vec!["a".into()],
        resource_owners: vec![],
    };
    assert_eq!(
        plan_discard(
            Domain::Investigation,
            &t,
            &[r],
            DiscardChecks {
                history: History::NotRecorded,
                recorded_deletion_confirmed: false,
                owned_resources_deletion_confirmed: true
            }
        ),
        Err(DiscardError::ReferencedBy("b".into()))
    );
    assert_eq!(
        plan_discard(
            Domain::Investigation,
            &t,
            &[],
            DiscardChecks {
                history: History::Recorded,
                recorded_deletion_confirmed: false,
                owned_resources_deletion_confirmed: false
            }
        ),
        Err(DiscardError::ResourceDeletionNotConfirmed)
    );
    assert_eq!(
        plan_discard(
            Domain::Investigation,
            &t,
            &[],
            DiscardChecks {
                history: History::Recorded,
                recorded_deletion_confirmed: false,
                owned_resources_deletion_confirmed: true
            }
        ),
        Err(DiscardError::RecordedDeletionNotConfirmed)
    );
    assert_eq!(
        plan_discard(
            Domain::Investigation,
            &t,
            &[],
            DiscardChecks {
                history: History::Unavailable,
                recorded_deletion_confirmed: true,
                owned_resources_deletion_confirmed: true
            }
        ),
        Err(DiscardError::HistoryUnavailable)
    );
    let plan = plan_discard(
        Domain::Investigation,
        &t,
        &[],
        DiscardChecks {
            history: History::Recorded,
            recorded_deletion_confirmed: true,
            owned_resources_deletion_confirmed: true,
        },
    )
    .unwrap();
    assert!(plan.publish_index);
    assert_eq!(plan.delete_resources, t.owned_resources);
}
#[test]
fn candidate_discard_never_publishes_formal_index() {
    let t = DiscardTarget {
        owned_resources: vec![],
        ..target(true)
    };
    let plan = plan_discard(
        Domain::Investigation,
        &t,
        &[],
        DiscardChecks {
            history: History::NotRecorded,
            recorded_deletion_confirmed: false,
            owned_resources_deletion_confirmed: false,
        },
    )
    .unwrap();
    assert!(!plan.publish_index);
}
