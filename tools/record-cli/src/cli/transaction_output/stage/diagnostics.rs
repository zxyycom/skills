use super::*;
use crate::{
    protocol::Diagnostic,
    stage::index_scope::{IndexStageError, SelectedSourceIssue},
};

pub(super) fn stage_diagnostic(
    output: &StageOutput<'_>,
    error: &IndexStageError,
) -> Option<Diagnostic> {
    match error {
        IndexStageError::SelectorUnresolved { .. } => selector_diagnostic(output, error),
        IndexStageError::SelectedSource { id, path, issue } => {
            Some(source_diagnostic(error, id, path, issue))
        }
        IndexStageError::PendingSourceInvalid { path, reason } => Some(Diagnostic {
            code: error.code().into(),
            operation: Some("stage".into()),
            detail: None, message: "Pending source is invalid.".into(),
            path: Some(path.to_string_lossy().replace('\\', "/")), target: None,
            reason: Some(reason.clone()), recovery: Some("Inspect and correct the selected pending source before retrying.".into()),
            cause_category: Some("pending-source-invalid".into()),
        }),
        IndexStageError::Selection(reason) => Some(Diagnostic {
            code: error.code().into(),
            operation: Some("stage".into()),
            detail: None,
            message: "Stage selection is invalid.".into(),
            path: None,
            target: None,
            reason: Some(reason.clone()),
            recovery: None,
            cause_category: Some("selection-invalid".into()),
        }),
        IndexStageError::Publication(failure) => Some(Diagnostic {
            code: error.code().into(),
            operation: Some("stage".into()),
            detail: None,
            message: "Pending index publication failed.".into(),
            path: None,
            target: None,
            reason: Some(failure.detail.clone()),
            recovery: Some("Inspect the pending index and any reported committed paths before deciding whether to retry.".into()),
            cause_category: None,
        }),
        _ => observation_diagnostic(output, error),
    }
}

/// Index and freshness observations do not imply a particular selected source.
fn observation_diagnostic(output: &StageOutput<'_>, error: &IndexStageError) -> Option<Diagnostic> {
    match error {
        IndexStageError::Index(reason) => Some(Diagnostic {
            code: error.code().into(),
            operation: Some("stage".into()),
            detail: None, message: "An observed index is invalid.".into(),
            path: None, target: None, reason: Some(reason.to_string()),
            recovery: Some("Inspect the workspace, pending, and historical index observations before retrying.".into()),
            cause_category: Some("index-invalid".into()),
        }),
        IndexStageError::HistoricalIndexMissing { .. } => Some(Diagnostic {
            code: error.code().into(),
            operation: Some("stage".into()),
            detail: None,
            message: "Historical index is missing.".into(),
            path: Some(output.index_display.to_owned()),
            target: None,
            reason: Some(
                "A trusted historical index is needed to establish the historical namespace."
                    .into(),
            ),
            recovery: error.recovery().map(str::to_owned),
            cause_category: Some("historical-index-missing".into()),
        }),
        _ => None,
    }
}

fn source_diagnostic(
    error: &IndexStageError,
    id: &str,
    path: &std::path::Path,
    issue: &SelectedSourceIssue,
) -> Diagnostic {
    let (category, reason, recovery) = match issue {
        SelectedSourceIssue::StaleIndex => (
            "index-stale",
            "Selected source differs from the workspace index.",
            Some("Run a scoped check and sync-index for the selected source, then retry staging."),
        ),
        SelectedSourceIssue::Invalid(_) => (
            "source-invalid",
            "Selected source is invalid or its identity does not match the index.",
            Some("Correct the selected source and run a scoped check before staging."),
        ),
        SelectedSourceIssue::Missing => (
            "source-missing",
            "The selected indexed source is missing.",
            Some("Restore the selected source or reconcile the index before staging."),
        ),
        SelectedSourceIssue::PendingIdentityMismatch => (
            "pending-identity-mismatch",
            "The pending source identity does not match the selection.",
            Some("Inspect the pending source and its selected identity before retrying."),
        ),
    };
    let reason = match issue {
        SelectedSourceIssue::Invalid(detail) => format!("{reason} {detail}"),
        _ => reason.to_owned(),
    };
    Diagnostic {
        code: error.code().into(),
        operation: Some("stage".into()),
        detail: None,
        message: "Selected source could not be staged.".into(),
        path: Some(path.to_string_lossy().replace('\\', "/")),
        target: Some(id.to_owned()),
        reason: Some(reason),
        recovery: recovery.map(str::to_owned),
        cause_category: Some(category.into()),
    }
}

fn selector_diagnostic(
    output: &StageOutput<'_>,
    error: &crate::stage::index_scope::IndexStageError,
) -> Option<crate::protocol::Diagnostic> {
    let crate::stage::index_scope::IndexStageError::SelectorUnresolved { selector } = error else {
        return None;
    };
    let (reason, recovery, path) = match output.domain {
        Domain::Decision => (
            format!("Decision stage selector is missing or ambiguous: {selector}"),
            "Correct the selected Decision IDs or Decision source state, then retry staging.",
            None,
        ),
        Domain::Investigation => (
            format!(
                "Report name {selector:?} was not found in the observed index snapshots or applicable pending locators."
            ),
            "Run a scoped check for the reported source; correct it and explicitly sync-index when needed, then rerun the selected stage.",
            Some(output.index_display.to_owned()),
        ),
    };
    Some(crate::protocol::Diagnostic {
        code: error.code().into(),
        operation: Some("stage".into()),
        detail: None,
        message: "The selected stage source could not be resolved.".into(),
        path,
        target: Some(selector.clone()),
        reason: Some(reason),
        recovery: Some(recovery.into()),
        cause_category: Some("selector-unresolved".into()),
    })
}
