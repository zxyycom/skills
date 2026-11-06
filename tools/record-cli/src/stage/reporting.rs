//! Report stage effects without claiming caller-owned paths.
use super::{
    StageScope,
    index_scope::{IndexStageError, IndexStageResult, Preservation, count_scope, preserved_paths},
};
use crate::{
    git::{
        ContentSnapshot,
        publish::{PendingUpdate, ReplacementResult},
    },
    source::RelativePath,
};
use std::path::PathBuf;

pub(super) struct StageReport<'a> {
    index_path: &'a RelativePath,
    updated_paths: Vec<PathBuf>,
    caller_owned_paths: Vec<PathBuf>,
    preserved_pending_paths: Vec<PathBuf>,
}
impl<'a> StageReport<'a> {
    pub fn for_sources(
        context: Preservation<'a>,
        scope: StageScope,
        pending: &ContentSnapshot,
        updates: &[PendingUpdate],
    ) -> Result<Self, IndexStageError> {
        let updated_paths: Vec<_> = updates.iter().map(|update| update.path.clone()).collect();
        let index_path = context.index_path;
        let caller_owned_paths = if scope == StageScope::Domain {
            vec![index_path.as_path().to_owned()]
        } else {
            Vec::new()
        };
        Self::for_index(context, pending, updated_paths, caller_owned_paths)
    }

    /// Bind the fixed historical comparison and caller-owned paths to the report.
    pub fn for_index(
        context: Preservation<'a>,
        pending: &ContentSnapshot,
        updated_paths: Vec<PathBuf>,
        caller_owned_paths: Vec<PathBuf>,
    ) -> Result<Self, IndexStageError> {
        let index_path = context.index_path;
        let preserved_pending_paths =
            preserved_paths(context, pending.membership(), &updated_paths)?;
        Ok(Self {
            index_path,
            updated_paths,
            caller_owned_paths,
            preserved_pending_paths,
        })
    }

    pub fn finish(
        self,
        selected_ids: Vec<String>,
        pending: &ContentSnapshot,
        replaced: ReplacementResult,
    ) -> IndexStageResult {
        IndexStageResult {
            selected_ids,
            changed_paths: replaced.changed_paths,
            updated_paths: self.updated_paths,
            caller_owned_paths: self.caller_owned_paths,
            preserved_pending_paths: self.preserved_pending_paths,
            pending_file_count: count_scope(self.index_path, &replaced.pending_after),
            pending_before: pending.membership().clone(),
        }
    }
}
