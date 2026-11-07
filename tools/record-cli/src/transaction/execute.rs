//! Execute a prepared proposal while the collection lock is held.
use super::*;
use crate::source::Root;

pub(super) fn run<T, O: TransactionOperation<T>>(
    root: &Root,
    lock_path: &RelativePath,
    operation: &mut O,
    outcome: &mut TransactionOutcome<T>,
    resource_journal: &mut resources::Journal,
) -> Result<(), TxError> {
    let plan = operation.prepare(root)?;
    let execution = LockedExecution {
        root,
        lock_path,
        operation,
        outcome,
        resource_journal,
    }
    .execute(&plan);
    if execution.is_ok() {
        outcome.value = Some(plan.value);
    } else {
        outcome.planned_value = Some(plan.value);
    }
    execution
}

// One lock-held execution binds its domain operation, observations, and outcome journal.
pub(super) struct LockedExecution<'a, T, O> {
    pub(super) root: &'a Root,
    pub(super) lock_path: &'a RelativePath,
    pub(super) operation: &'a mut O,
    pub(super) outcome: &'a mut TransactionOutcome<T>,
    pub(super) resource_journal: &'a mut resources::Journal,
}
impl<T, O: TransactionOperation<T>> LockedExecution<'_, T, O> {
    fn execute(mut self, plan: &Plan<T>) -> Result<(), TxError> {
        let reserved = plan_validation::validate(plan, self.lock_path)?;
        let fresh = fresh::prepare(self.root, plan, self.operation)?;
        let writes = self.apply_resources(&fresh.resources, plan, &reserved);
        let writes = writes.apply(writes::WriteContext {
            root: self.root,
            plan,
            operation: self.operation,
            outcome: self.outcome,
            resource_journal: self.resource_journal,
            resource_plan: &fresh.resources,
            missing: &fresh.missing,
        });
        self.complete_writes(plan, &fresh, writes)
    }
    // Postverify a successful write phase; otherwise reconcile its actual journal.
    fn complete_writes(
        mut self,
        plan: &Plan<T>,
        fresh: &fresh::FreshPlan<'_>,
        mut writes: writes::WriteJournal,
    ) -> Result<(), TxError> {
        let mut failure = writes.failure.take();
        if failure.is_none() && fresh.resources.has_moves() {
            failure = self.retire_moves(plan, fresh).err();
        }
        if failure.is_none() {
            match self.verify_after_writes(plan, fresh, &writes) {
                Ok(()) => return Ok(()),
                Err(error) => failure = Some(error),
            }
        }
        let Self {
            root,
            operation,
            outcome,
            resource_journal,
            ..
        } = self;
        recovery::Recovery {
            root,
            plan,
            operation,
            outcome,
            resource_journal,
            fresh,
            writes: &writes,
        }
        .execute();
        Err(failure.expect("failure recorded"))
    }
    fn retire_moves(
        &mut self,
        plan: &Plan<T>,
        fresh: &fresh::FreshPlan<'_>,
    ) -> Result<(), TxError> {
        let previous = self.resource_journal.changed.len();
        let previous_unknown = self.resource_journal.unknown.len();
        let exit = fresh
            .resources
            .retire_moves(self.root, self.resource_journal);
        self.outcome
            .written_paths
            .extend(self.resource_journal.changed[previous..].iter().cloned());
        self.outcome.unknown_paths.extend(
            self.resource_journal.unknown[previous_unknown..]
                .iter()
                .cloned(),
        );
        self.outcome.changed |= self.resource_journal.changed.len() > previous;
        if fresh.resources.all_moves_exited(self.resource_journal)
            && matches!(
                plan.commit_point,
                CommitPoint::Renamed { .. } | CommitPoint::Updated(_)
            )
        {
            self.outcome.committed = true;
        }
        exit
    }
}

// Back up and apply resource effects before ordinary writes; journal only actual effects.
impl<T, O: TransactionOperation<T>> LockedExecution<'_, T, O> {
    fn apply_resources(
        &mut self,
        resource_plan: &resources::Resources<'_>,
        plan: &Plan<T>,
        reserved: &std::collections::HashSet<RelativePath>,
    ) -> writes::WriteJournal {
        let root = self.root;
        let resource_journal = &mut self.resource_journal;
        let outcome = &mut self.outcome;
        let journal: Vec<Entry> = Vec::new();
        let mut failure = resource_plan
            .backup_removals(root, resource_journal, reserved)
            .err();
        if failure.is_none() {
            failure =
                resources::Resources::backup_writes(root, plan, resource_journal, reserved).err();
        }
        if failure.is_none() {
            failure = resource_plan.execute(root, resource_journal).err();
        }
        outcome.changed |= !resource_journal.changed.is_empty();
        outcome
            .written_paths
            .extend(resource_journal.changed.iter().cloned());
        outcome
            .unknown_paths
            .extend(resource_journal.unknown.iter().cloned());
        let unknown = !resource_journal.unknown.is_empty();
        let removed = Vec::new();
        writes::WriteJournal {
            entries: journal,
            removed,
            unknown,
            failure,
        }
    }
}
