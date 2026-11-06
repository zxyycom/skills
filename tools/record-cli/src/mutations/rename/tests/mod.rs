use super::*;
#[test]
fn target_prefers_name_then_id_without_overwriting() {
    let source = RenameSource {
        id: "261106-old".into(),
        source_path: "archive/old.md".into(),
        location: Location::DecisionArchived,
    };
    let target = RenameIdentity {
        id: "261106-new".into(),
        name: "new".into(),
    };
    let ids = HashSet::new();
    let mut paths = HashSet::from(["archive/new.md".into()]);
    let p = plan_rename(
        &source,
        &target,
        &ids,
        &paths,
        RenameHistoryCheck {
            history: History::NotRecorded,
            recorded_rename_confirmed: false,
        },
    )
    .unwrap();
    assert_eq!(p.new_source_path, "archive/261106-new.md");
    paths.insert(p.new_source_path);
    assert_eq!(
        plan_rename(
            &source,
            &target,
            &ids,
            &paths,
            RenameHistoryCheck {
                history: History::NotRecorded,
                recorded_rename_confirmed: false
            }
        ),
        Err(RenameError::PathConflict)
    );
}
#[test]
fn genuine_noop_does_not_request_history_but_actual_rename_does() {
    let source = RenameSource {
        id: "261106-a".into(),
        source_path: "_candidate.a".into(),
        location: Location::InvestigationCandidate,
    };
    let same = RenameIdentity {
        id: source.id.clone(),
        name: "a".into(),
    };
    assert!(
        plan_rename(
            &source,
            &same,
            &HashSet::new(),
            &HashSet::new(),
            RenameHistoryCheck {
                history: History::Unavailable,
                recorded_rename_confirmed: false
            }
        )
        .unwrap()
        .no_change
    );
    let other = RenameIdentity {
        id: "261106-b".into(),
        name: "b".into(),
    };
    assert_eq!(
        plan_rename(
            &source,
            &other,
            &HashSet::new(),
            &HashSet::new(),
            RenameHistoryCheck {
                history: History::Recorded,
                recorded_rename_confirmed: false
            }
        ),
        Err(RenameError::RecordedConfirmationRequired)
    );
}
