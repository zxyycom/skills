//! Isolated Decision mark-aligned operation; not a public CLI entry point.
use crate::mutations::{
    contract::Alignment,
    decision::lifecycle::preparation::{self as decision_lifecycle, PreparedLifecycle},
    decision::lifecycle::rules::{
        self as lifecycle, EstablishedLifecycle, HistoryFact, LifecycleAction, LifecycleRecord,
        Status,
    },
};
use crate::{
    source::{ExpectedFile, RelativePath, Root, capture},
    transaction::{Plan, TransactionOperation, TxError},
};

fn failure(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
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
    decision_lifecycle::capture_plan(root, collection, index_path, first, &edits)
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
