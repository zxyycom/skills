use super::*;
use crate::git::publish::{FailureKind, ReplacementFailure};
use crate::stage::index_scope::IndexStageError;
use std::path::PathBuf;

#[test]
fn publication_outcomes_do_not_claim_no_change_after_commit_or_unknown_recovery() {
    for (kind, paths, changed) in [
        (FailureKind::Failed, None, false.into()),
        (FailureKind::PartialOrUnknown, None, serde_json::Value::Null),
        (
            FailureKind::CountUnavailable,
            Some(vec![PathBuf::from("selected.md")]),
            true.into(),
        ),
    ] {
        let error = IndexStageError::Publication(ReplacementFailure {
            kind,
            detail: "fixture".into(),
            committed_paths: paths,
        });
        let body = stage_failure_body("all", &error);
        assert_eq!(body["changed"], changed);
    }
}
