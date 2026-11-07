//! Publish the already prepared selected paths.
use super::index_scope::IndexStageError;
use crate::{
    git::{
        self, ContentSnapshot,
        publish::{PendingUpdate, ReplacementResult},
    },
    source::Root,
};

pub(super) struct SourcePublication<'a> {
    pub root: &'a Root,
    pub pending: &'a ContentSnapshot,
    pub updates: &'a [PendingUpdate],
}
impl SourcePublication<'_> {
    pub fn publish(&self) -> Result<ReplacementResult, IndexStageError> {
        git::publish::replace_selected(self.root.path(), self.pending, self.updates)
            .map_err(IndexStageError::Publication)
    }
}
