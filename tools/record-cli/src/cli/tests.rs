use super::*;
use crate::{
    protocol::Diagnostic,
    source::RelativePath,
    transaction::{
        RecoveryBackup, RecoveryDirectory, RecoveryStatus, TransactionOutcome, TxStatus,
        VerificationStatus,
    },
};
#[test]
fn query_accepts_inline_values_but_not_values_for_flags() {
    let args = |values: &[&str]| values.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>();
    let parsed = parse_query(
        Domain::Decision,
        &args(&["list", "--root=/tmp", "--limit=3"]),
    )
    .unwrap();
    assert_eq!(parsed.root, "/tmp");
    assert!(parse_query(Domain::Decision, &args(&["list", "--json=true"])).is_err());
}
#[test]
fn new_lock_parent_bootstrap_reports_partial_and_preserves_foreign_entry() {
    let workspace = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(workspace.path()).unwrap();
    let competitor = workspace.path().join("docs/occupied");
    let rival = competitor.clone();
    crate::source::set_mkdir_test_hook(move || std::fs::write(rival, b"other").unwrap());
    let lock = RelativePath::new("docs/occupied/.index.lock").unwrap();
    let (written, unknown, _) = bootstrap_lock_parent(&root, &lock).unwrap_err();
    assert_eq!(written, ["docs"]);
    assert!(unknown.is_empty());
    assert_eq!(std::fs::read(competitor).unwrap(), b"other");
}
#[test]
fn new_bootstrap_does_not_remove_a_competing_lock() {
    let workspace = tempfile::tempdir().unwrap();
    let root = crate::source::open_root(workspace.path()).unwrap();
    let rival = workspace
        .path()
        .join("docs/.decision-index.json.mutation.lock");
    let competitor = rival.clone();
    crate::source::set_mkdir_test_hook(move || std::fs::write(competitor, b"rival").unwrap());
    let input = crate::mutations::authoring::NewInput::Decision {
        title: "Example title".into(),
        purpose: "Purpose".into(),
        background: "Background".into(),
        decision: "Decision".into(),
        tags: vec!["test".into()],
        relations: vec![],
        preflight_alignment: None,
    };
    let result = output_new(
        ExecutionContext {
            command: "new",
            json: true,
            root: &root,
            lock: &RelativePath::new("docs/.decision-index.json.mutation.lock").unwrap(),
        },
        RelativePath::new("docs/decisions").unwrap(),
        "example".into(),
        input,
        None,
    );
    assert_eq!(result, 1);
    assert_eq!(std::fs::read(rival).unwrap(), b"rival");
    assert!(!workspace.path().join("docs/decisions").exists());
}
#[test]
fn transaction_failure_keeps_backups_unknown_paths_and_withholds_review() {
    let diagnostic = Diagnostic {
        code: "restore-failed".into(),
        message: "changed".into(),
        path: None,
        target: None,
        cause_category: None,
        operation: None,
        detail: None,
        reason: None,
        recovery: None,
    };
    let mut outcome = TransactionOutcome {
        status: TxStatus::Error,
        value: Some(()),
        planned_value: None,
        changed: true,
        committed: false,
        verification: VerificationStatus::FailedOrUnknown,
        outcome: RecoveryStatus::PartialOrUnknown,
        written_paths: vec![],
        unknown_paths: vec![RelativePath::new("resources/owner/item").unwrap()],
        recovery_backups: vec![RecoveryBackup {
            source: RelativePath::new("resources/owner/item").unwrap(),
            backup: RelativePath::new(".recovery/item").unwrap(),
            mode: 0o640,
        }],
        recovery_directories: vec![RecoveryDirectory {
            path: RelativePath::new("resources/owner/empty").unwrap(),
            mode: 0o750,
        }],
        errors: vec![diagnostic],
        cleanup_errors: vec![],
    };
    let (verified, body) = transaction_body(&mut outcome, |_| {
        panic!("failed transaction cannot emit review")
    });
    assert!(!verified);
    assert_eq!(body["outcome"], "partial-or-unknown");
    assert_eq!(body["unknownPaths"][0], "resources/owner/item");
    assert_eq!(body["recoveryBackups"][0]["source"], "resources/owner/item");
    assert_eq!(body["recoveryBackups"][0]["backup"], ".recovery/item");
    assert_eq!(body["recoveryBackups"][0]["mode"], 0o640);
    assert_eq!(
        body["recoveryDirectories"][0]["path"],
        "resources/owner/empty"
    );
    assert_eq!(body["recoveryDirectories"][0]["mode"], 0o750);
    assert!(body.get("relationReview").is_none());
    let envelope = transaction_failure_envelope("set-relations", &outcome, body);
    assert_eq!(envelope["ok"], false);
    assert_eq!(envelope["diagnostics"][0]["code"], "restore-failed");
    assert_eq!(
        envelope["result"]["recoveryBackups"][0]["backup"],
        ".recovery/item"
    );
    assert!(
        envelope["error"]["recovery"]
            .as_str()
            .unwrap()
            .contains("do not blindly retry")
    );
}

#[test]
fn transaction_error_mapping_preserves_diagnostics_and_message() {
    let diagnostic = Diagnostic {
        code: "candidate-invalid".into(),
        message: "candidate is incomplete".into(),
        path: Some("docs/decisions/draft.md".into()),
        target: Some("draft".into()),
        cause_category: Some("validation".into()),
        operation: Some("publish".into()),
        detail: Some("missing section".into()),
        reason: Some("body is not ready".into()),
        recovery: Some("complete the section".into()),
    };
    let source = crate::transaction::TxError::new("preflight-failed", "cannot prepare")
        .with_diagnostics(vec![diagnostic]);
    let mapped = transaction_error(source);
    assert_eq!(&*mapped.code, "preflight-failed");
    assert_eq!(mapped.message, "cannot prepare");
    let diagnostic = serde_json::to_value(&mapped.diagnostics).unwrap();
    assert_eq!(
        diagnostic,
        serde_json::json!([{
            "code": "candidate-invalid", "message": "candidate is incomplete",
            "path": "docs/decisions/draft.md", "target": "draft",
            "causeCategory": "validation", "operation": "publish", "detail": "missing section",
            "reason": "body is not ready", "recovery": "complete the section"
        }])
    );
    assert!(mapped.partial.is_none());
}
