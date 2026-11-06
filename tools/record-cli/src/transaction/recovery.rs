//! Conditional recovery and reconciliation after an unsuccessful execution.
mod files;
use super::*;
use crate::source::{
    CreateEffect, CreateMode, RemoveEffect, Root, capture, capture_missing, create_exclusive,
    finalize_created_mode, identity_from_handle, open_verified_for_update, remove_if_matches,
};

pub(super) struct Recovery<'a, 'p, T, O> {
    pub root: &'a Root,
    pub plan: &'a Plan<T>,
    pub operation: &'a mut O,
    pub outcome: &'a mut TransactionOutcome<T>,
    pub resource_journal: &'a mut resources::Journal,
    pub fresh: &'a fresh::FreshPlan<'p>,
    pub writes: &'a writes::WriteJournal,
}
impl<T, O: TransactionOperation<T>> Recovery<'_, '_, T, O> {
    pub fn execute(mut self) {
        if self.outcome.committed {
            self.outcome.outcome = RecoveryStatus::PartialOrUnknown;
        } else if !self.writes.entries.is_empty()
            || !self.resource_journal.changed.is_empty()
            || self.writes.unknown
        {
            self.recover_before_commit();
        }
        self.verify_original_moves();
    }
    // Recover actual file effects first, then resources and the complete original scope.
    fn recover_before_commit(&mut self) {
        let files::FileRecovery {
            mut restored,
            recreated,
        } = files::restore_entries(
            self.root,
            self.plan,
            &self.writes.entries,
            self.outcome,
            self.writes.unknown,
        );
        if restored {
            restored = recover_resources(self.root, self.resource_journal, self.outcome);
        }
        if restored {
            let errors = verify_original_scope(self.root, self.plan, &recreated);
            restored = errors.is_empty();
            self.outcome.cleanup_errors.extend(errors);
        }
        if restored && let Err(error) = self.operation.verify_recovered(self.root, self.plan) {
            restored = false;
            append_error(&mut self.outcome.cleanup_errors, error);
        }
        self.outcome.outcome = if restored {
            RecoveryStatus::RolledBack
        } else {
            RecoveryStatus::PartialOrUnknown
        };
    }
    // Before discarding backups, a noncommitted move must still have its original tree.
    fn verify_original_moves(&mut self) {
        if !self.outcome.committed
            && matches!(
                self.outcome.outcome,
                RecoveryStatus::NoChange | RecoveryStatus::RolledBack
            )
            && let Err(error) = self.fresh.resources.verify_move_originals(self.root)
        {
            self.outcome.outcome = RecoveryStatus::PartialOrUnknown;
            append_error(&mut self.outcome.cleanup_errors, error);
        }
    }
}

// Reconcile resource recovery failures without claiming uncertain paths.
fn recover_resources<T>(
    root: &Root,
    journal: &resources::Journal,
    outcome: &mut TransactionOutcome<T>,
) -> bool {
    let (errors, uncertain) = journal.recover(root);
    let restored = errors.is_empty() && uncertain.is_empty();
    for error in errors {
        outcome
            .cleanup_errors
            .push(diagnostic("resource-recovery", error));
    }
    for path in uncertain {
        if !outcome.unknown_paths.contains(&path) {
            outcome.unknown_paths.push(path);
        }
    }
    restored
}

// Recreated files may have new identity; bytes, mode, and parent chain must still match.
fn verify_original_scope<T>(
    root: &Root,
    plan: &Plan<T>,
    recreated: &std::collections::HashSet<RelativePath>,
) -> Vec<Diagnostic> {
    let mut errors = Vec::new();
    for (path, expected) in protected_sources(plan) {
        let matches_original = match (capture(root, path), expected) {
            (Ok(ExpectedFile::Present(actual)), ExpectedFile::Present(before))
                if recreated.contains(path) =>
            {
                actual.bytes == before.bytes
                    && actual.identity.mode == before.identity.mode
                    && actual.parents == before.parents
                    && actual.parent_paths == before.parent_paths
            }
            (Ok(actual), _) => &actual == expected,
            (Err(error), _) => {
                errors.push(diagnostic(
                    "recovery-verification",
                    format!("{}: {error}", path.as_path().display()),
                ));
                continue;
            }
        };
        if !matches_original {
            errors.push(diagnostic(
                "recovery-verification",
                format!("original scope changed: {}", path.as_path().display()),
            ));
        }
    }
    errors
}
