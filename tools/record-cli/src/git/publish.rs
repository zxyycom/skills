//! Conditional Git index publication. Stage callers still own source fresh and verification.
use super::{
    ContentSnapshot, GitError, PendingEntry, command, command_index, git_path, read_selected,
    read_selected_index,
};
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingFile {
    pub mode: u32,
    pub bytes: Vec<u8>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingUpdate {
    pub path: PathBuf,
    pub file: Option<PendingFile>,
}
#[derive(Debug, PartialEq, Eq)]
pub enum FailureKind {
    Conflict,
    Failed,
    RecoveryFailed,
    CommittedUnverified,
    CommittedCleanupPending,
}
#[derive(Debug)]
pub enum GuardFailure {
    Conflict,
    Failed,
}
#[derive(Debug)]
pub struct ReplacementFailure {
    pub kind: FailureKind,
    pub detail: String,
    /// Present only when the pending index rename definitely succeeded.
    pub committed_paths: Option<Vec<PathBuf>>,
}
#[derive(Debug)]
pub struct ReplacementResult {
    pub changed_paths: Vec<PathBuf>,
    pub pending_after: super::PendingSnapshot,
}
fn failed(kind: FailureKind, detail: impl Into<String>) -> ReplacementFailure {
    ReplacementFailure {
        kind,
        detail: detail.into(),
        committed_paths: None,
    }
}
fn operation(error: impl std::fmt::Display) -> ReplacementFailure {
    failed(FailureKind::Failed, error.to_string())
}
mod alternate;
mod attempt;
use attempt::PublicationAttempt;
mod cleanup;
use alternate::AlternateIndex;
mod files;
use cleanup::OwnedFiles;
mod updates;
use alternate::PreparedIndex;
use files::{
    index_path, open_regular, read_optional_index, read_regular, same_file, write_verified_lock,
};
use updates::{PreparedUpdates, prepare_updates, validate_targets, verify_prepared};

static NEXT: AtomicU64 = AtomicU64::new(0);

/// Replace only explicit, already selected paths. This protects Git pending and HEAD;
/// it does not replace the stage caller's independent worktree/source fresh proof.
pub fn replace_selected(
    root: &Path,
    expected_head: &str,
    expected: &ContentSnapshot,
    updates: &[PendingUpdate],
) -> Result<ReplacementResult, ReplacementFailure> {
    replace_selected_guarded(root, expected_head, expected, updates, || Ok(()))
}

/// Recheck additional caller-owned sources while the cooperative Git lock is held.
pub fn replace_selected_guarded<F>(
    root: &Path,
    expected_head: &str,
    expected: &ContentSnapshot,
    updates: &[PendingUpdate],
    verify_source: F,
) -> Result<ReplacementResult, ReplacementFailure>
where
    F: FnOnce() -> Result<(), GuardFailure>,
{
    replace_selected_guarded_revision(root, Some(expected_head), expected, updates, verify_source)
}

/// Conditional publication with an explicit unborn-HEAD expectation.
pub fn replace_selected_guarded_revision<F>(
    root: &Path,
    expected_head: Option<&str>,
    expected: &ContentSnapshot,
    updates: &[PendingUpdate],
    verify_source: F,
) -> Result<ReplacementResult, ReplacementFailure>
where
    F: FnOnce() -> Result<(), GuardFailure>,
{
    let mut attempt = PublicationAttempt::open(root, expected_head, expected, updates)?;
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        attempt.execute(verify_source)
    }))
    .unwrap_or_else(|_| {
        Err(failed(
            if attempt.published {
                FailureKind::CommittedUnverified
            } else {
                FailureKind::Failed
            },
            "publication aborted unexpectedly",
        ))
    });
    attempt.finish(result)
}

/// The same pending and HEAD observations must survive both sides of source verification.
struct PendingGuard<'a> {
    root: &'a Path,
    index: &'a Path,
    expected_head: Option<&'a str>,
    expected: &'a ContentSnapshot,
    original: &'a Option<Vec<u8>>,
}
impl PendingGuard<'_> {
    fn check(&self, message: &'static str) -> Result<(), ReplacementFailure> {
        if !head_matches(self.root, self.expected_head).map_err(operation)?
            || index_path(self.root)? != self.index
            || read_selected(self.root, &self.expected.paths).map_err(operation)? != *self.expected
            || read_optional_index(self.index).map_err(operation)? != *self.original
        {
            return Err(failed(FailureKind::Conflict, message));
        }
        Ok(())
    }
}

fn head_matches(root: &Path, expected: Option<&str>) -> Result<bool, GitError> {
    match (super::probe_head(root)?, expected) {
        (super::HeadState::Commit(actual), Some(expected)) => Ok(actual == expected),
        (super::HeadState::Unborn, None) => Ok(true),
        _ => Ok(false),
    }
}
