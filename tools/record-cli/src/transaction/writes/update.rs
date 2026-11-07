//! Atomic replacement and independent readback journal.
use super::*;

impl WriteJournal {
    pub(super) fn update<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        index: usize,
        write: &WriteIntent,
    ) -> Result<(), TxError> {
        let (ExpectedFile::Present(before), Some(after)) = (&write.before, &write.after) else {
            return Ok(());
        };
        if before.bytes == *after {
            return Ok(());
        }
        self.replace(context, write, before, after)?;
        context.outcome.changed = true;
        context.outcome.written_paths.push(write.path.clone());
        if matches!(&context.plan.commit_point, CommitPoint::PublishedIndex(path) if *path == write.path)
        {
            context.outcome.committed = true;
        }
        self.readback(context, index, write, after)
    }
    fn readback<T, O>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        index: usize,
        write: &WriteIntent,
        after: &[u8],
    ) -> Result<(), TxError> {
        let ExpectedFile::Present(before) = &write.before else {
            unreachable!()
        };
        match capture(context.root, &write.path) {
            Ok(ExpectedFile::Present(snapshot))
                if snapshot.bytes == *after
                    && (snapshot.identity.mode & 0o7777) == (before.identity.mode & 0o7777) =>
            {
                self.entries.push(Entry::Written(index, snapshot));
                if matches!(&context.plan.commit_point, CommitPoint::Updated(path) if *path == write.path)
                    && !context.resource_plan.has_moves()
                {
                    context.outcome.committed = true;
                }
                Ok(())
            }
            observed => {
                let reason = match observed {
                    Err(error) => error.to_string(),
                    Ok(_) => "written file bytes or permissions differ".to_string(),
                };
                self.unknown = true;
                context.outcome.unknown_paths.push(write.path.clone());
                Err(TxError::new(
                    "write-readback",
                    format!("{}: {reason}", write.path.as_path().display()),
                ))
            }
        }
    }
    fn replace<T, O>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        write: &WriteIntent,
        before: &crate::source::SourceSnapshot,
        after: &[u8],
    ) -> Result<(), TxError> {
        if let Err(failure) = replace_if_matches(context.root, before, after) {
            if failure.unknown {
                self.unknown = true;
                context.outcome.unknown_paths.push(write.path.clone());
            }
            if let Some((path, error)) = failure.cleanup {
                context.outcome.cleanup_errors.push(diagnostic(
                    "temporary-cleanup",
                    format!("{}: {error}", path.display()),
                ));
            }
            return Err(TxError::new("write-replace", failure.error.to_string()));
        }
        Ok(())
    }
}
