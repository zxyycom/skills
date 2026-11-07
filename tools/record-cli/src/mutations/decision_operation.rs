//! Isolated Decision mark-aligned operation; not a public CLI entry point.
use super::{
    contract::Alignment,
    decision_lifecycle::{self, PreparedLifecycle},
    lifecycle::{
        self, EstablishedLifecycle, HistoryFact, LifecycleAction, LifecycleRecord, Status,
    },
};
use crate::{
    source::{ExpectedFile, RelativePath, Root, capture},
    transaction::{Plan, TransactionOperation, TxError},
};

fn failure(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}

fn same_mode(
    a: &Option<crate::transaction::WriteMode>,
    b: &Option<crate::transaction::WriteMode>,
) -> bool {
    use crate::transaction::WriteMode;
    match (a, b) {
        (None, None) => true,
        (Some(WriteMode::Exact(x)), Some(WriteMode::Exact(y)))
        | (Some(WriteMode::Native(x)), Some(WriteMode::Native(y))) => x == y,
        _ => false,
    }
}
mod archive;
mod mark_aligned;
mod reactivate;

pub use archive::{ArchiveOperation, PreparedArchive};
pub use mark_aligned::MarkAlignedOperation;
pub use reactivate::ReactivateOperation;

#[cfg(test)]
mod tests;

fn prepare_lifecycle(
    root: &Root,
    collection: &RelativePath,
    index_path: &RelativePath,
    selector: &str,
    action: LifecycleAction,
) -> Result<Plan<PreparedLifecycle>, TxError> {
    let first = capture(root, index_path).map_err(|e| failure("index-read", e.to_string()))?;
    let ExpectedFile::Present(snapshot) = &first else {
        return Err(failure("index-missing", "published index is missing"));
    };
    let selected = resolve_lifecycle(snapshot, selector)?;
    let edits = lifecycle::plan_lifecycle(
        &[(selected.clone(), HistoryFact::NotApplicable)],
        action,
        false,
    )
    .map_err(|e| lifecycle_failure(e, &selected, action))?;
    let plan = decision_lifecycle::capture_plan(root, collection, index_path, &edits)?;
    let second = plan
        .writes
        .iter()
        .find(|write| &write.path == index_path)
        .map(|write| &write.before)
        .ok_or_else(|| failure("invalid-plan", "index proof missing"))?;
    if !crate::source::equivalent_file(&first, second) {
        return Err(failure("index-changed", "index changed during selection"));
    }
    Ok(plan)
}

fn lifecycle_failure(
    error: lifecycle::LifecyclePlanError,
    record: &LifecycleRecord,
    action: LifecycleAction,
) -> TxError {
    let mut failure = failure("lifecycle-invalid", format!("{error:?}"));
    if matches!(
        error,
        lifecycle::LifecyclePlanError::InvalidTransition { .. }
    ) {
        let reason = match action {
            LifecycleAction::MarkAligned => format!(
                "mark-aligned requires an active unaligned decision: {}",
                record.source_path
            ),
            LifecycleAction::Reactivate(_) => format!(
                "reactivate requires an archived decision: {}",
                record.source_path
            ),
            LifecycleAction::Archive => {
                format!("Decision is already archived: {}", record.source_path)
            }
        };
        failure.diagnostics.push(lifecycle_diagnostic(
            "decision-records.lifecycle-invalid",
            "Decision lifecycle",
            reason,
            "Correct the lifecycle request or decision state, then retry the command.",
        ));
    }
    failure
}

fn lifecycle_diagnostic(
    code: &str,
    target: &str,
    reason: String,
    recovery: &str,
) -> crate::protocol::Diagnostic {
    crate::protocol::Diagnostic {
        code: code.into(),
        message: reason.clone(),
        path: None,
        target: Some(target.into()),
        cause_category: None,
        operation: None,
        detail: None,
        reason: Some(reason),
        recovery: Some(recovery.into()),
    }
}

fn resolve_lifecycle(
    snapshot: &crate::source::SourceSnapshot,
    selector: &str,
) -> Result<LifecycleRecord, TxError> {
    let baseline =
        crate::index::parse_index(&snapshot.bytes, &crate::domains::decision::Definition)
            .map_err(|e| failure("index-invalid", e.to_string()))?;
    let (id, state) =
        crate::domains::resolve_selector(&baseline.index().entries, selector, |s| &s.name)
            .map_err(|e| failure("selector", format!("{e:?}")))?;
    lifecycle_record(id, state)
}

fn lifecycle_record(
    id: &str,
    state: &crate::domains::decision::DecisionState,
) -> Result<LifecycleRecord, TxError> {
    let status = match state.status.as_str() {
        "active" => Status::Active,
        "archived" => Status::Archived,
        _ => return Err(failure("lifecycle-invalid", "invalid status")),
    };
    let alignment = match state.alignment.as_str() {
        "aligned" => Alignment::Aligned,
        "unaligned" => Alignment::Unaligned,
        _ => return Err(failure("lifecycle-invalid", "invalid alignment")),
    };
    let selected = LifecycleRecord {
        id: id.to_owned(),
        source_path: state.source_path.clone(),
        created_at: state.created_at.clone(),
        lifecycle: EstablishedLifecycle { status, alignment },
    };
    Ok(selected)
}

fn verify_recovered_files(
    root: &Root,
    writes: &[crate::transaction::WriteIntent],
    allow_missing: bool,
) -> Result<(), TxError> {
    for write in writes {
        let actual = capture(root, &write.path).map_err(|e| failure("recovery", e.to_string()))?;
        match (&write.before, actual) {
            (ExpectedFile::Missing, ExpectedFile::Missing) if allow_missing => {}
            (ExpectedFile::Present(before), ExpectedFile::Present(actual))
                if before.bytes == actual.bytes && before.identity.mode == actual.identity.mode => {
            }
            _ => return Err(failure("recovery", "original source was not restored")),
        }
    }
    Ok(())
}

fn verify_moving_files(
    root: &Root,
    index_path: &RelativePath,
    writes: &[crate::transaction::WriteIntent],
) -> Result<(), TxError> {
    for write in writes {
        let actual =
            capture(root, &write.path).map_err(|e| failure("postverify", e.to_string()))?;
        match (&write.after, actual) {
            (None, ExpectedFile::Missing) => {}
            (Some(expected), ExpectedFile::Present(actual)) if actual.bytes == *expected => {
                if let ExpectedFile::Present(before) = &write.before
                    && actual.identity.mode != before.identity.mode
                {
                    return Err(failure("postverify", "written file mode differs"));
                }
                if let Some(crate::transaction::WriteMode::Exact(expected_mode)) =
                    write.mode.as_ref()
                {
                    #[cfg(unix)]
                    let actual_mode = actual.identity.mode & 0o7777;
                    if actual_mode != *expected_mode {
                        return Err(failure("postverify", "created file mode differs"));
                    }
                }
            }
            _ => return Err(failure("postverify", "actual file does not match plan")),
        }
    }
    verify_index_graph(root, index_path)
}

fn verify_index_graph(root: &Root, index_path: &RelativePath) -> Result<(), TxError> {
    let index = capture(root, index_path).map_err(|e| failure("postverify", e.to_string()))?;
    let ExpectedFile::Present(index) = index else {
        return Err(failure("postverify", "index missing"));
    };
    let parsed = crate::index::parse_index(&index.bytes, &crate::domains::decision::Definition)
        .map_err(|e| failure("postverify", e.to_string()))?;
    crate::index::QuerySnapshot::new(parsed)
        .graph(&crate::domains::decision::Definition)
        .map_err(|e| failure("postverify", e.to_string()))?;
    Ok(())
}

#[derive(Clone, Copy)]
enum ModeEvidence {
    Absent,
    Equal,
}
fn same_writes(
    old: &[crate::transaction::WriteIntent],
    fresh: &[crate::transaction::WriteIntent],
    policy: ModeEvidence,
) -> bool {
    old.len() == fresh.len()
        && old.iter().zip(fresh).all(|(a, b)| {
            a.path == b.path
                && crate::source::equivalent_file(&a.before, &b.before)
                && a.after == b.after
                && match policy {
                    ModeEvidence::Absent => a.mode.is_none() && b.mode.is_none(),
                    ModeEvidence::Equal => same_mode(&a.mode, &b.mode),
                }
        })
}
