use super::*;

pub(super) fn explained_failure(
    code: &str,
    target: &str,
    reason: String,
    recovery: &str,
) -> TxError {
    let diagnostic = crate::protocol::Diagnostic {
        code: code.into(),
        message: reason.clone(),
        path: None,
        target: Some(target.into()),
        cause_category: None,
        operation: None,
        detail: None,
        reason: Some(reason.clone()),
        recovery: Some(recovery.into()),
    };
    TxError::new(code, reason).with_diagnostics(vec![diagnostic])
}

pub(super) fn discard_failure(
    domain: super::super::discard::Domain,
    id: &str,
    resource_count: usize,
    error: super::super::discard::DiscardError,
) -> TxError {
    use super::super::discard::{DiscardError as E, Domain};
    let (code, reason, recovery) = match error {
        E::ResourceDeletionNotConfirmed => (
            "discard",
            format!("{id} owns {resource_count} resource(s); deletion is not confirmed"),
            "Inspect the owned resources and retry with --delete-owned-resources only after confirming their deletion.",
        ),
        E::RecordedDeletionNotConfirmed => (
            if domain == Domain::Investigation {
                "recorded-deletion-confirmation-required"
            } else {
                "discard"
            },
            format!("{id} is recorded in Git history; deletion is not confirmed"),
            "Review the recorded identity and retry with --delete-recorded only after confirming its deletion.",
        ),
        E::ReferencedBy(source) => (
            "discard",
            format!("{id} is referenced by published record {source}"),
            "Remove or replace the published relation before retrying discard.",
        ),
        E::ResourceOwnerReferencedBy(source) => (
            "discard",
            format!("{id} owns resources referenced by published record {source}"),
            "Remove or replace the published resource links before retrying discard.",
        ),
        other => return fail("discard", format!("{other:?}")),
    };
    explained_failure(code, id, reason, recovery)
}

pub(super) fn rename_failure(
    domain: super::super::discard::Domain,
    id: &str,
    target: &str,
    candidate: bool,
    error: super::super::rename::RenameError,
) -> TxError {
    use super::super::{discard::Domain, rename::RenameError as E};
    let (diagnostic_target, reason, recovery) = match error {
        E::IdentityConflict(conflict) => (
            conflict,
            format!("target identity {target} already exists"),
            "Choose an unused identity before retrying rename.",
        ),
        E::PathConflict => (
            target.into(),
            format!("no target path is available for identity {target}"),
            "Resolve the occupied target paths or choose an unused identity before retrying rename.",
        ),
        E::RecordedConfirmationRequired => {
            let recovery = match (domain, candidate) {
                (Domain::Decision, _) => {
                    "Review the recorded identity and retry with --rename-recorded-decision only after confirmation."
                }
                (Domain::Investigation, true) => {
                    "Review the recorded candidate and retry with --rename-recorded-candidate only after confirmation."
                }
                (Domain::Investigation, false) => {
                    "Review the recorded report and retry with --rename-recorded-report only after confirmation."
                }
            };
            (
                id.into(),
                format!("{id} is recorded in Git history; rename is not confirmed"),
                recovery,
            )
        }
        E::HistoryUnavailable => (
            id.into(),
            format!("Git history for {id} is unavailable"),
            "Restore access to a trustworthy Git history before retrying rename.",
        ),
    };
    explained_failure("rename", &diagnostic_target, reason, recovery)
}
