use super::*;
fn active(id: &str, name: &str) -> LifecycleRecord {
    LifecycleRecord {
        id: id.into(),
        source_path: format!("{name}.md"),
        created_at: "2025-01-02T00:00:00Z".into(),
        lifecycle: EstablishedLifecycle {
            status: Status::Active,
            alignment: Alignment::Unaligned,
        },
    }
}
#[test]
fn archive_plans_every_record_and_preserves_basename_and_metadata() {
    let selected = vec![
        (active("250102-one", "old-name"), HistoryFact::Recorded),
        (active("250102-two", "two"), HistoryFact::NotApplicable),
    ];
    let plan = plan_lifecycle(&selected, LifecycleAction::Archive, false).unwrap();
    assert_eq!(plan.len(), 2);
    assert_eq!(plan[0].target_path, "archive/old-name.md");
    assert_eq!(plan[0].created_at, selected[0].0.created_at);
    assert_eq!(plan[0].after.alignment, Alignment::Unaligned);
}
#[test]
fn archive_does_not_approve_missing_history_or_duplicate_selection() {
    let record = active("250102-one", "one");
    assert_eq!(
        plan_lifecycle(
            &[(record.clone(), HistoryFact::Unrecorded)],
            LifecycleAction::Archive,
            false
        ),
        Err(LifecyclePlanError::HistoryConfirmationRequired(
            record.id.clone()
        ))
    );
    assert!(
        plan_lifecycle(
            &[(record.clone(), HistoryFact::Unrecorded)],
            LifecycleAction::Archive,
            true
        )
        .is_ok()
    );
    assert_eq!(
        plan_lifecycle(
            &[(record.clone(), HistoryFact::Unavailable)],
            LifecycleAction::Archive,
            true
        ),
        Err(LifecyclePlanError::HistoryUnavailable(record.id.clone()))
    );
    assert_eq!(
        plan_lifecycle(
            &[
                (record.clone(), HistoryFact::Recorded),
                (record.clone(), HistoryFact::Recorded)
            ],
            LifecycleAction::Archive,
            false
        ),
        Err(LifecyclePlanError::DuplicateId(record.id))
    );
}
