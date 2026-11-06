//! Transaction intent, operation contract, and observed result types.
use super::*;

#[derive(Debug)]
pub enum WriteMode {
    Exact(u32),
    Native(u32),
}
#[derive(Debug)]
pub struct WriteIntent {
    pub path: RelativePath,
    pub before: ExpectedFile,
    pub after: Option<Vec<u8>>,
    pub mode: Option<WriteMode>,
}
#[derive(Debug)]
pub struct Guard {
    pub path: RelativePath,
    pub before: ExpectedFile,
}
#[derive(Debug)]
pub enum CommitPoint {
    NoCommit,
    Created(RelativePath),
    Updated(RelativePath),
    Exited(RelativePath),
    Renamed {
        old: RelativePath,
        new: RelativePath,
    },
    PublishedIndex(RelativePath),
}
/// Retained, independently verified bytes for manual recovery of a removed resource.
#[derive(Clone, Debug)]
pub struct RecoveryBackup {
    pub source: RelativePath,
    pub backup: RelativePath,
    /// Original platform mode/attributes, also applied to the backup file.
    pub mode: u32,
}
/// Original representation of a resource directory requiring reconciliation.
#[derive(Clone, Debug)]
pub struct RecoveryDirectory {
    pub path: RelativePath,
    pub mode: u32,
}
#[derive(Debug)]
pub struct TransactionOutcome<T> {
    pub status: TxStatus,
    pub value: Option<T>,
    /// A lock-held prepared proposal retained only on failure; never proof of mutation.
    pub planned_value: Option<T>,
    pub changed: bool,
    pub committed: bool,
    pub verification: VerificationStatus,
    pub outcome: RecoveryStatus,
    pub written_paths: Vec<RelativePath>,
    /// Writes whose system call may have changed data but cannot be proven.
    pub unknown_paths: Vec<RelativePath>,
    pub recovery_backups: Vec<RecoveryBackup>,
    pub recovery_directories: Vec<RecoveryDirectory>,
    pub errors: Vec<Diagnostic>,
    pub cleanup_errors: Vec<Diagnostic>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TxStatus {
    Ok,
    Error,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VerificationStatus {
    Passed,
    FailedOrUnknown,
    NotRun,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RecoveryStatus {
    NoChange,
    Committed,
    RolledBack,
    PartialOrUnknown,
    CommittedCleanupPending,
}

/// Planned member operations. A plan is not proof of an actual write.
#[derive(Debug)]
pub enum ResourceIntent {
    CreateDirectory {
        path: RelativePath,
    },
    /// Copy a selected source directory's exact representable mode, without
    /// treating the newly observed directory as transaction-owned.
    CreateDirectoryFrom {
        source: RelativePath,
        destination: RelativePath,
    },
    /// Move a fully validated owner tree to a missing sibling without replacement.
    MoveDirectory {
        source: RelativePath,
        destination: RelativePath,
    },
    CopyFile {
        source: RelativePath,
        destination: RelativePath,
    },
    RemoveFile {
        path: RelativePath,
    },
    RemoveDirectory {
        path: RelativePath,
    },
}
#[derive(Debug)]
pub struct Plan<T> {
    pub value: T,
    pub writes: Vec<WriteIntent>,
    pub guards: Vec<Guard>,
    pub resources: Vec<ResourceIntent>,
    pub commit_point: CommitPoint,
}
#[derive(Debug)]
pub struct TxError {
    pub code: String,
    pub message: String,
    pub diagnostics: Vec<crate::protocol::Diagnostic>,
}
impl TxError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            diagnostics: Vec::new(),
        }
    }
    pub fn with_diagnostics(mut self, diagnostics: Vec<crate::protocol::Diagnostic>) -> Self {
        self.diagnostics = diagnostics;
        self
    }
}
impl std::fmt::Display for TxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for TxError {}
/// The operation owns selection and domain validation. The transaction owns the
/// ordering, write journal, conditional recovery and explicit commit marker.
pub trait TransactionOperation<T> {
    fn prepare(&mut self, root: &crate::source::Root) -> Result<Plan<T>, TxError>;
    #[cfg(test)]
    fn before_write(&mut self, _root: &crate::source::Root, _index: usize) -> Result<(), TxError> {
        Ok(())
    }
    #[cfg(test)]
    fn before_postverify(&mut self, _root: &crate::source::Root) -> Result<(), TxError> {
        Ok(())
    }
    fn fresh(&mut self, root: &crate::source::Root, plan: &Plan<T>) -> Result<(), TxError>;
    fn verify(&mut self, root: &crate::source::Root, plan: &Plan<T>) -> Result<(), TxError>;
    fn verify_recovered(
        &mut self,
        root: &crate::source::Root,
        plan: &Plan<T>,
    ) -> Result<(), TxError>;
}

impl<T> TransactionOutcome<T> {
    pub(super) fn pending() -> Self {
        Self {
            status: TxStatus::Error,
            value: None,
            planned_value: None,
            changed: false,
            committed: false,
            verification: VerificationStatus::NotRun,
            outcome: RecoveryStatus::NoChange,
            written_paths: Vec::new(),
            unknown_paths: Vec::new(),
            recovery_backups: Vec::new(),
            recovery_directories: Vec::new(),
            errors: Vec::new(),
            cleanup_errors: Vec::new(),
        }
    }
}

// Protected facts are ordered guards first, then actual write candidates.
pub(super) fn protected_sources<T>(
    plan: &Plan<T>,
) -> impl Iterator<Item = (&RelativePath, &ExpectedFile)> {
    plan.guards
        .iter()
        .map(|g| (&g.path, &g.before))
        .chain(plan.writes.iter().map(|w| (&w.path, &w.before)))
}
