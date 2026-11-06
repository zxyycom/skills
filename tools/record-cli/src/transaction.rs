//! Transaction intent and observable outcome; execution must not infer commit from a plan.
mod execute;
mod file_io;
mod fresh;
mod plan_validation;
mod postverify;
mod recovery;
mod resources;
mod settle;
mod writes;
use crate::{
    protocol::Diagnostic,
    source::{ExpectedFile, RelativePath},
};
mod model;
use file_io::write_synced;
use model::protected_sources;
pub use model::{
    CommitPoint, Guard, Plan, RecoveryBackup, RecoveryDirectory, RecoveryStatus, ResourceIntent,
    TransactionOperation, TransactionOutcome, TxError, TxStatus, VerificationStatus, WriteIntent,
    WriteMode,
};

// A journal entry records independently captured writes, not intentions.
enum Entry {
    Written(usize, crate::source::SourceSnapshot),
    Removed(usize),
}

/// Read-only preflight produces a plan; execution must perform a separate
/// lock-held preparation and freshness check; it cannot authorize a write.
pub fn preflight<T, O: TransactionOperation<T>>(
    root: &crate::source::Root,
    operation: &mut O,
) -> Result<Plan<T>, TxError> {
    operation.prepare(root)
}

/// Execute a lock-held preparation, independent freshness check, and journaled writes.
/// A write error can have modified the file even when no completed write was recorded.
pub fn run_transaction<T, O: TransactionOperation<T>>(
    root: &crate::source::Root,
    lock_path: &RelativePath,
    operation: &mut O,
) -> TransactionOutcome<T> {
    use crate::source::acquire_collection_lock;

    let mut outcome = TransactionOutcome::pending();
    let lock = match acquire_collection_lock(root, lock_path) {
        Ok(lock) => lock,
        Err(error) => {
            outcome
                .errors
                .push(diagnostic("collection-lock", error.to_string()));
            return outcome;
        }
    };
    let mut resource_journal = resources::Journal::default();
    let execute = execute::run(
        root,
        lock_path,
        operation,
        &mut outcome,
        &mut resource_journal,
    );
    if let Err(error) = execute {
        append_error(&mut outcome.errors, error);
    }
    settle::finish(root, lock, resource_journal, outcome)
}
#[cfg(unix)]
fn exact_mode(mode: u32) -> u32 {
    mode & 0o7777
}
fn append_error(diagnostics: &mut Vec<Diagnostic>, error: TxError) {
    if error.diagnostics.is_empty() {
        diagnostics.push(diagnostic(&error.code, error.message));
    } else {
        diagnostics.extend(error.diagnostics);
    }
}

fn diagnostic(code: &str, message: String) -> Diagnostic {
    Diagnostic {
        code: code.into(),
        message,
        path: None,
        target: None,
        cause_category: None,
        operation: None,
        detail: None,
        reason: None,
        recovery: None,
    }
}

#[cfg(test)]
mod tests;
