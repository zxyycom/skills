//! Actual ordinary-file writes and their independent readback journal.
use super::*;
use crate::source::{
    CreateEffect, CreateMode, CreatedFile, MissingProof, RemoveEffect, Root, capture,
    capture_missing, create_exclusive, finalize_created_mode, identity_from_handle,
    open_verified_for_update, remove_if_matches,
};
use std::collections::HashMap;

pub(super) struct WriteJournal {
    pub entries: Vec<Entry>,
    pub removed: Vec<RelativePath>,
    pub unknown: bool,
    pub failure: Option<TxError>,
}
pub(super) struct WriteContext<'a, 'p, T, O> {
    pub root: &'a Root,
    pub plan: &'a Plan<T>,
    pub operation: &'a mut O,
    pub outcome: &'a mut TransactionOutcome<T>,
    pub resource_journal: &'a resources::Journal,
    pub resource_plan: &'a resources::Resources<'p>,
    pub missing: &'a HashMap<RelativePath, MissingProof>,
}
mod creation;
mod update;

impl WriteJournal {
    pub fn apply<T, O: TransactionOperation<T>>(
        mut self,
        mut context: WriteContext<'_, '_, T, O>,
    ) -> Self {
        for (index, write) in context.plan.writes.iter().enumerate() {
            if self.failure.is_some() {
                break;
            }
            if let Err(error) = self.verify_before_write(&context) {
                self.failure = Some(error);
                break;
            }
            #[cfg(test)]
            if let Err(error) = context.operation.before_write(context.root, index) {
                self.failure = Some(error);
                break;
            }
            #[cfg(not(test))]
            let _ = &context.operation;
            let result = match (&write.before, &write.after) {
                (ExpectedFile::Missing, Some(after)) => {
                    self.create(&mut context, index, write, after)
                }
                (ExpectedFile::Present(before), None) => {
                    self.remove(&mut context, index, write, before)
                }
                (ExpectedFile::Present(_), Some(_)) => self.update(&mut context, index, write),
                _ => Ok(()),
            };
            if let Err(error) = result {
                self.failure = Some(error);
                break;
            }
        }
        self
    }
    // Protect actual prior writes and source facts before every subsequent mutation.
    fn verify_before_write<T, O>(
        &self,
        context: &WriteContext<'_, '_, T, O>,
    ) -> Result<(), TxError> {
        let actual_writes: Vec<_> = self
            .entries
            .iter()
            .filter_map(|entry| match entry {
                Entry::Written(_, snapshot) => Some(snapshot),
                Entry::Removed(_) => None,
            })
            .collect();
        context
            .resource_journal
            .verify(context.root, &actual_writes)
            .and_then(|_| context.resource_plan.verify_sources(context.root))
    }
    fn remove<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        index: usize,
        write: &WriteIntent,
        before: &crate::source::SourceSnapshot,
    ) -> Result<(), TxError> {
        let WriteContext {
            root,
            plan,
            outcome,
            ..
        } = context;
        // Never remove an old copy after an earlier actual write has drifted.
        if self.entries.iter().any(|entry| matches!(entry, Entry::Written(_, snapshot) if !matches!(capture(root, &snapshot.path), Ok(ExpectedFile::Present(current)) if current == *snapshot))) {
                    return Err(TxError::new("write-changed-before-exit", format!("prior write changed before removing {}", write.path.as_path().display())));
                }
        match remove_if_matches(root, before) {
            Ok(()) => {
                outcome.changed = true;
                outcome.written_paths.push(write.path.clone());
                self.removed.push(write.path.clone());
                self.entries.push(Entry::Removed(index));
                if matches!(&plan.commit_point, CommitPoint::Exited(path) if *path == write.path)
                    || matches!(&plan.commit_point, CommitPoint::Renamed { old, .. } if *old == write.path)
                {
                    outcome.committed = true;
                }
            }
            Err(error) => {
                if error.effect == RemoveEffect::Unknown {
                    self.unknown = true;
                    outcome.unknown_paths.push(write.path.clone());
                }
                return Err(TxError::new("remove", error.error.to_string()));
            }
        }
        Ok(())
    }
}
