//! Independent post-write verification of actual journal and protected sources.
use super::*;
use crate::source::{MissingProof, Root, capture, capture_missing};
use std::collections::HashMap;

impl<T, O: TransactionOperation<T>> super::execute::LockedExecution<'_, T, O> {
    // Independently verify actual effects; the test barrier precedes all post-write reads.
    pub(super) fn verify_after_writes(
        &mut self,
        plan: &Plan<T>,
        fresh: &fresh::FreshPlan<'_>,
        writes: &writes::WriteJournal,
    ) -> Result<(), TxError> {
        #[cfg(test)]
        self.operation.before_postverify(self.root)?;
        let root = self.root;
        let operation = &mut self.operation;
        let outcome = &mut self.outcome;
        let resource_journal = &self.resource_journal;
        let resource_plan = &fresh.resources;
        let missing = &fresh.missing;
        let journal = &writes.entries;
        let removed = &writes.removed;
        outcome.verification = VerificationStatus::FailedOrUnknown;
        verify_written(root, journal)?;
        verify_removed(root, plan, removed, resource_journal)?;
        verify_protected(
            root,
            plan,
            &outcome.written_paths,
            missing,
            resource_journal,
        )?;
        let actual_writes: Vec<_> = journal
            .iter()
            .filter_map(|entry| match entry {
                Entry::Written(_, snapshot) => Some(snapshot),
                Entry::Removed(_) => None,
            })
            .collect();
        resource_journal.verify(root, &actual_writes)?;
        resource_plan.verify_sources(root)?;
        operation.verify(root, plan)?;
        outcome.verification = VerificationStatus::Passed;
        if outcome.committed {
            outcome.outcome = RecoveryStatus::Committed;
        }
        Ok(())
    }
}
// Each actual written file must still be the exact independently captured snapshot.
fn verify_written(root: &Root, journal: &[Entry]) -> Result<(), TxError> {
    for entry in journal {
        let Entry::Written(_, snapshot) = entry else {
            continue;
        };
        let actual = capture(root, &snapshot.path).map_err(|error| {
            TxError::new(
                "postverify-source",
                format!("{}: {error}", snapshot.path.as_path().display()),
            )
        })?;
        if !matches!(actual, ExpectedFile::Present(current) if current == *snapshot) {
            return Err(TxError::new(
                "postverify-source",
                format!(
                    "written file changed: {}",
                    snapshot.path.as_path().display()
                ),
            ));
        }
    }
    Ok(())
}
// Removed paths need a fresh absence proof linked to the original parent chain.
fn verify_removed<T>(
    root: &Root,
    plan: &Plan<T>,
    removed: &[RelativePath],
    resources: &resources::Journal,
) -> Result<(), TxError> {
    for path in removed {
        let before = plan
            .writes
            .iter()
            .find(|w| &w.path == path)
            .and_then(|w| match &w.before {
                ExpectedFile::Present(before) => Some(before),
                _ => None,
            })
            .expect("removed source snapshot");
        let valid = match capture_missing(root, path) {
            Ok(proof) => resources.verifies_removed_file(&proof, before),
            Err(crate::source::SourceError::Changed(_)) => false,
            Err(error) => {
                return Err(TxError::new(
                    "postverify-source",
                    format!("{}: {error}", path.as_path().display()),
                ));
            }
        };
        if !valid {
            return Err(TxError::new(
                "postverify-source",
                format!(
                    "removed path is no longer safely absent: {}",
                    path.as_path().display()
                ),
            ));
        }
    }
    Ok(())
}
// Guards and unwritten paths remain protected, including missing-parent identities.
fn verify_protected<T>(
    root: &Root,
    plan: &Plan<T>,
    written_paths: &[RelativePath],
    missing: &HashMap<RelativePath, MissingProof>,
    resources: &resources::Journal,
) -> Result<(), TxError> {
    for (path, expected) in plan.guards.iter().map(|g| (&g.path, &g.before)).chain(
        plan.writes
            .iter()
            .filter(|w| !written_paths.contains(&w.path))
            .map(|w| (&w.path, &w.before)),
    ) {
        let namespace_matches = if matches!(expected, ExpectedFile::Missing) {
            match (missing.get(path), capture_missing(root, path)) {
                (Some(before), Ok(current)) => {
                    before.extends(&current, &resources.observed_directories())
                }
                (_, Err(crate::source::SourceError::Changed(_))) | (None, Ok(_)) => false,
                (_, Err(error)) => {
                    let message = format!("{}: {error}", path.as_path().display());
                    return Err(TxError::new("postverify-source", message));
                }
            }
        } else {
            true
        };
        if namespace_matches {
            let actual = capture(root, path).map_err(|error| {
                let message = format!("{}: {error}", path.as_path().display());
                TxError::new("postverify-source", message)
            })?;
            if &actual == expected {
                continue;
            }
        }
        return Err(TxError::new(
            "postverify-source",
            format!("protected source changed: {}", path.as_path().display()),
        ));
    }
    Ok(())
}
