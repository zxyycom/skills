//! Backup reconciliation, lock release, and final result status.
use super::*;
use crate::source::{CollectionLock, Root};

pub(super) fn finish<T>(
    root: &Root,
    lock: CollectionLock,
    mut resource_journal: resources::Journal,
    mut outcome: TransactionOutcome<T>,
) -> TransactionOutcome<T> {
    cleanup_verified_backups(root, &mut resource_journal, &mut outcome);
    collect_retained_backups(root, &resource_journal, &mut outcome);
    if outcome.committed
        && outcome.verification == VerificationStatus::Passed
        && !outcome.cleanup_errors.is_empty()
    {
        outcome.outcome = RecoveryStatus::CommittedCleanupPending;
    }
    if let Err(error) = lock.release(root) {
        outcome
            .cleanup_errors
            .push(diagnostic("collection-lock-release", error.to_string()));
        if outcome.committed && outcome.verification == VerificationStatus::Passed {
            outcome.outcome = RecoveryStatus::CommittedCleanupPending;
        }
    }
    if outcome.errors.is_empty() && outcome.cleanup_errors.is_empty() {
        outcome.status = TxStatus::Ok;
    } else {
        // A cleanup failure is not a successful review; retain only the
        // explicitly labelled prepared proposal for diagnostics.
        if outcome.planned_value.is_none() {
            outcome.planned_value = outcome.value.take();
        } else {
            outcome.value = None;
        }
    }
    outcome
}

fn cleanup_verified_backups<T>(
    root: &Root,
    resource_journal: &mut resources::Journal,
    outcome: &mut TransactionOutcome<T>,
) {
    // A verified success or a complete restoration no longer needs the backups.
    // Partial/unknown outcomes keep them available after process exit.
    let cleanup_backups = (outcome.errors.is_empty()
        && outcome.verification == VerificationStatus::Passed)
        || (!outcome.committed
            && matches!(
                outcome.outcome,
                RecoveryStatus::NoChange | RecoveryStatus::RolledBack
            )
            && outcome.unknown_paths.is_empty());
    if cleanup_backups {
        let (errors, uncertain) = resource_journal.cleanup_backups(root);
        for error in errors {
            outcome
                .cleanup_errors
                .push(diagnostic("backup-cleanup", error));
        }
        for path in uncertain {
            if !outcome.unknown_paths.contains(&path) {
                outcome.unknown_paths.push(path);
            }
        }
    }
}

fn collect_retained_backups<T>(
    root: &Root,
    resource_journal: &resources::Journal,
    outcome: &mut TransactionOutcome<T>,
) {
    let (backups, backup_errors, backup_unknown) = resource_journal.retained_backups(root);
    outcome.recovery_backups = backups;
    if !outcome.recovery_backups.is_empty() {
        outcome.changed = true;
        if outcome.outcome == RecoveryStatus::NoChange {
            outcome.outcome = RecoveryStatus::PartialOrUnknown;
        }
    }
    for error in backup_errors {
        outcome
            .cleanup_errors
            .push(diagnostic("backup-verification", error));
    }
    for path in backup_unknown {
        if !outcome.unknown_paths.contains(&path) {
            outcome.unknown_paths.push(path);
        }
    }
    if outcome.outcome == RecoveryStatus::PartialOrUnknown || !outcome.recovery_backups.is_empty() {
        outcome.recovery_directories = resource_journal.recovery_directories();
    }
}
