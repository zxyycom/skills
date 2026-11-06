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
    fn execute(self, plan: &Plan<T>) -> Result<(), TxError> {
        let reserved = plan_validation::validate(plan, self.lock_path)?;
        let fresh = fresh::prepare(self.root, plan, self.operation)?;
        let writes = apply_resources(
            self.root,
            &fresh.resources,
            &reserved,
            self.resource_journal,
            self.outcome,
        );
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
}

// Back up and apply resource effects before ordinary writes; journal only actual effects.
fn apply_resources<T>(
    root: &Root,
    resource_plan: &resources::Resources<'_>,
    reserved: &std::collections::HashSet<RelativePath>,
    resource_journal: &mut resources::Journal,
    outcome: &mut TransactionOutcome<T>,
) -> writes::WriteJournal {
    let journal: Vec<Entry> = Vec::new();
    let mut failure = resource_plan
        .backup_removals(root, resource_journal, reserved)
        .err();
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
