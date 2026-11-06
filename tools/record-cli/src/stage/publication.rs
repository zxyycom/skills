//! Bind Git index publication to caller-owned source freshness proofs.
use super::{FreshnessError, index_scope::IndexStageError};
use crate::{
    git::{
        self, ContentSnapshot,
        publish::{GuardFailure, PendingUpdate, ReplacementResult},
    },
    source::Root,
};

pub(super) struct SourcePublication<'a> {
    pub root: &'a Root,
    pub revision: Option<&'a str>,
    pub pending: &'a ContentSnapshot,
    pub updates: &'a [PendingUpdate],
}
impl SourcePublication<'_> {
    /// Recheck sources under the lock and distinguish drift from an uncertain commit.
    pub fn publish<G, V>(&self, guard: G, verify: V) -> Result<ReplacementResult, IndexStageError>
    where
        G: FnOnce() -> Result<(), FreshnessError>,
        V: FnOnce() -> Result<(), FreshnessError>,
    {
        let replaced = git::publish::replace_selected_guarded_revision(
            self.root.path(),
            self.revision,
            self.pending,
            self.updates,
            || {
                guard().map_err(|error| match error {
                    FreshnessError::Drift => GuardFailure::Conflict,
                    FreshnessError::Read => GuardFailure::Failed,
                })
            },
        )
        .map_err(IndexStageError::Publication)?;
        if verify().is_err() {
            if replaced.changed_paths.is_empty() {
                return Err(IndexStageError::Drift);
            }
            return Err(IndexStageError::CommittedUnverified {
                changed_paths: replaced.changed_paths,
            });
        }
        Ok(replaced)
    }
}
