//! Conditional update through a verified handle and independent readback.
use super::*;

// The opened update handle is bound to the old snapshot until its bytes are changed.
struct PendingUpdate<'a> {
    index: usize,
    write: &'a WriteIntent,
    before: &'a crate::source::SourceSnapshot,
    after: &'a [u8],
    handle: std::fs::File,
}
impl WriteJournal {
    pub(super) fn update<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        index: usize,
        write: &WriteIntent,
    ) -> Result<(), TxError> {
        let root = context.root;
        let (ExpectedFile::Present(before), Some(after)) = (&write.before, &write.after) else {
            return Ok(());
        };
        if before.bytes == *after {
            return Ok(());
        }
        let handle = match open_verified_for_update(root, before) {
            Ok(handle) => handle,
            Err(error) => {
                return Err(TxError::new("write-open", error.to_string()));
            }
        };
        self.finish_update(
            context,
            PendingUpdate {
                index,
                write,
                before,
                after,
                handle,
            },
        )
    }
    // A verified update handle may mutate bytes; independently read back before recording ownership.
    fn finish_update<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        mut pending: PendingUpdate<'_>,
    ) -> Result<(), TxError> {
        // From the first write onward an error may have changed bytes.
        if let Err(error) = write_synced(&mut pending.handle, pending.after) {
            self.unknown = true;
            context
                .outcome
                .unknown_paths
                .push(pending.write.path.clone());
            return Err(TxError::new(
                "write-unknown",
                format!("{}: {error}", pending.write.path.as_path().display()),
            ));
        }
        context.outcome.changed = true;
        context
            .outcome
            .written_paths
            .push(pending.write.path.clone());
        self.record_update(context, pending)
    }
    // Publication can commit before readback; ordinary update commits only after it matches.
    fn record_update<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        pending: PendingUpdate<'_>,
    ) -> Result<(), TxError> {
        let WriteContext {
            root,
            plan,
            outcome,
            ..
        } = context;
        let PendingUpdate {
            index,
            write,
            before,
            after,
            handle,
        } = pending;
        if matches!(&plan.commit_point, CommitPoint::PublishedIndex(path) if *path == write.path) {
            outcome.committed = true;
        }
        match readback_update(root, write, before, after, &handle) {
            Some(snapshot) => {
                self.entries.push(Entry::Written(index, snapshot));
                if matches!(&plan.commit_point, CommitPoint::Updated(path) if *path == write.path) {
                    outcome.committed = true;
                }
            }
            None => {
                self.unknown = true;
                outcome.unknown_paths.push(write.path.clone());
                return Err(TxError::new(
                    "write-readback",
                    format!(
                        "written file could not be independently verified: {}",
                        write.path.as_path().display()
                    ),
                ));
            }
        }
        Ok(())
    }
}

// Read back the named file and the open handle; bind them to the original identity and bytes.
fn readback_update(
    root: &Root,
    write: &WriteIntent,
    before: &crate::source::SourceSnapshot,
    after: &[u8],
    handle: &std::fs::File,
) -> Option<crate::source::SourceSnapshot> {
    let observed = capture(root, &write.path);
    let handle_identity = identity_from_handle(handle);
    match (observed, handle_identity) {
        (Ok(ExpectedFile::Present(snapshot)), Ok(identity))
            if snapshot.identity == identity
                && snapshot.identity.device == before.identity.device
                && snapshot.identity.inode == before.identity.inode
                && snapshot.identity.mode == before.identity.mode
                && snapshot.parents == before.parents
                && snapshot.bytes == *after =>
        {
            Some(snapshot)
        }
        _ => None,
    }
}
