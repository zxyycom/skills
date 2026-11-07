//! Conditional restoration of ordinary file journal entries.
use super::*;
use crate::source::SourceSnapshot;

pub(super) struct RestoreFailure {
    pub message: String,
    pub unknown: bool,
}
pub(super) fn restore_removed(root: &Root, before: &SourceSnapshot) -> Result<(), RestoreFailure> {
    let mut recovery_effect_unknown = false;
    let result = (|| -> Result<(), String> {
        let proof = capture_missing(root, &before.path).map_err(|e| e.to_string())?;
        if !proof.matches_parent_of(before) {
            return Err("original parent chain changed before recovery".into());
        }
        let created = create_exclusive(
            root,
            &proof,
            CreateMode::Exact(exact_mode(before.identity.mode)),
        )
        .map_err(|e| {
            recovery_effect_unknown = e.effect == CreateEffect::Unknown;
            e.error.to_string()
        })?;
        recovery_effect_unknown = true;
        let mut handle = created.file;
        write_synced(&mut handle, &before.bytes).map_err(|e| e.to_string())?;
        finalize_created_mode(&handle, CreateMode::Exact(exact_mode(before.identity.mode)))
            .and_then(|_| handle.sync_all().map_err(Into::into))
            .map_err(|e| e.to_string())?;
        if !restored_file_matches(root, before, &handle) {
            return Err("restored file verification failed".into());
        }
        Ok(())
    })();
    result.map_err(|message| RestoreFailure {
        message,
        unknown: recovery_effect_unknown,
    })
}

// A failed ordinary-file restoration retains precise unknown paths.
pub(super) fn restore_entries<T>(
    root: &Root,
    plan: &Plan<T>,
    journal: &[Entry],
    outcome: &mut TransactionOutcome<T>,
    unknown: bool,
) -> bool {
    let mut restored = !unknown;
    for entry in journal.iter().rev() {
        // An unknown deletion may already have removed the old name;
        // retaining the new name is safer than undoing the only copy.
        if unknown {
            break;
        }
        let (index, written) = match entry {
            Entry::Written(index, written) => (index, written),
            Entry::Removed(index) => {
                let ExpectedFile::Present(before) = &plan.writes[*index].before else {
                    unreachable!()
                };
                let result = files::restore_removed(root, before);
                if let Err(error) = result {
                    if error.unknown {
                        outcome.unknown_paths.push(before.path.clone());
                    }
                    restored = false;
                    outcome.cleanup_errors.push(diagnostic(
                        "recovery",
                        format!("{}: {}", before.path.as_path().display(), error.message),
                    ));
                    break;
                }
                continue;
            }
        };
        restored &= restore_written(root, &plan.writes[*index].before, written, outcome);
    }

    restored
}

fn restore_written<T>(
    root: &Root,
    original: &ExpectedFile,
    written: &SourceSnapshot,
    outcome: &mut TransactionOutcome<T>,
) -> bool {
    let mut restored = true;
    if matches!(*original, ExpectedFile::Missing) {
        if let Err(error) = crate::source::remove_if_owned(root, written) {
            if error.effect != RemoveEffect::NotStarted {
                outcome.unknown_paths.push(written.path.clone());
            }
            restored = false;
            outcome.cleanup_errors.push(diagnostic(
                "recovery",
                format!("{}: {}", written.path.as_path().display(), error.error),
            ));
        }
        return restored;
    }
    let ExpectedFile::Present(before) = original else {
        unreachable!()
    };
    let result = restore_replaced(root, before, written, outcome);
    if let Err(error) = result {
        restored = false;
        outcome.cleanup_errors.push(diagnostic(
            "recovery",
            format!("{}: {error}", written.path.as_path().display()),
        ));
    }
    restored
}

fn restore_replaced<T>(
    root: &Root,
    before: &SourceSnapshot,
    written: &SourceSnapshot,
    outcome: &mut TransactionOutcome<T>,
) -> Result<(), String> {
    if let Err(failure) = replace_if_matches(root, written, &before.bytes) {
        if failure.unknown {
            outcome.unknown_paths.push(written.path.clone());
        }
        if let Some((path, error)) = failure.cleanup {
            outcome.cleanup_errors.push(diagnostic(
                "temporary-cleanup",
                format!("{}: {error}", path.display()),
            ));
        }
        return Err(failure.error.to_string());
    }
    match capture(root, &before.path) {
        Ok(ExpectedFile::Present(current))
            if crate::source::same_content_and_mode(&current, before) =>
        {
            Ok(())
        }
        _ => Err("restored file does not match original bytes and mode".into()),
    }
}

// Recreated bytes and mode must match through the actual handle and original parents.
fn restored_file_matches(root: &Root, before: &SourceSnapshot, handle: &std::fs::File) -> bool {
    matches!((capture(root, &before.path), identity_from_handle(handle)),
        (Ok(ExpectedFile::Present(current)), Ok(identity))
            if current.identity == identity
                && current.bytes == before.bytes
                && current.identity.mode == before.identity.mode
                && current.parents == before.parents
                && current.parent_paths == before.parent_paths)
}
