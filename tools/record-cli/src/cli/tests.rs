use super::*;
use crate::{
    protocol::Diagnostic,
    source::RelativePath,
    transaction::{TransactionOutcome, TxStatus},
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
fn transaction_failure_keeps_unknown_paths_and_withholds_review() {
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
        written_paths: vec![],
        unknown_paths: vec![RelativePath::new("resources/owner/item").unwrap()],
        errors: vec![diagnostic],
    };
    let (verified, body) = transaction_body(&mut outcome, |_| {
        panic!("failed transaction cannot emit review")
    });
    assert!(!verified);
    assert_eq!(body["unknownPaths"][0], "resources/owner/item");
    assert!(body.get("relationReview").is_none());
    let envelope = transaction_failure_envelope("set-relations", &outcome, body);
    assert_eq!(envelope["ok"], false);
    assert_eq!(envelope["diagnostics"][0]["code"], "restore-failed");
    assert_eq!(envelope["version"], 2);
    assert!(
        envelope["error"]["recovery"]
            .as_str()
            .unwrap()
            .contains("Inspect")
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

#[test]
fn transaction_success_uses_status_without_inventing_verification() {
    let mut outcome = TransactionOutcome {
        status: TxStatus::Ok,
        value: Some("done"),
        planned_value: None,
        changed: true,
        committed: true,
        written_paths: vec![RelativePath::new("records/item.md").unwrap()],
        unknown_paths: vec![],
        errors: vec![],
    };
    let (success, body) =
        transaction_body(&mut outcome, |value| serde_json::json!({"value": value}));
    assert!(success);
    assert_eq!(body["value"], "done");
    assert_eq!(body["writtenPaths"][0], "records/item.md");
    assert!(body.get("verification").is_none());
    assert!(body.get("outcome").is_none());
}
