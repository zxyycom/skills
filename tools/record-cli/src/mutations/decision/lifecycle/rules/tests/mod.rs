use super::*;
#[test]
fn lifecycle_preconditions_and_alignment() {
    let active = EstablishedLifecycle {
        status: Status::Active,
        alignment: Alignment::Unaligned,
    };
    let archived = transition(active, LifecycleAction::Archive).unwrap();
    assert_eq!(
        archived,
        EstablishedLifecycle {
            status: Status::Archived,
            alignment: Alignment::Unaligned
        }
    );
    assert_eq!(
        transition(archived, LifecycleAction::Archive),
        Err(LifecycleError::AlreadyArchived)
    );
    assert_eq!(
        transition(active, LifecycleAction::Reactivate(Alignment::Aligned)),
        Err(LifecycleError::RequiresArchived)
    );
    let reactivated =
        transition(archived, LifecycleAction::Reactivate(Alignment::Aligned)).unwrap();
    assert_eq!(
        reactivated,
        EstablishedLifecycle {
            status: Status::Active,
            alignment: Alignment::Aligned
        }
    );
    assert_eq!(
        transition(reactivated, LifecycleAction::MarkAligned),
        Err(LifecycleError::RequiresActiveUnaligned)
    );
    assert_eq!(
        transition(active, LifecycleAction::MarkAligned).unwrap(),
        reactivated
    );
    assert_eq!(
        transition(archived, LifecycleAction::MarkAligned),
        Err(LifecycleError::RequiresActiveUnaligned)
    );
}
