//! Read-only projections of validated record snapshots.
pub(crate) mod candidate_discovery;
mod content;
pub mod decision;
mod decision_events;
pub mod facets;
pub mod investigation;
mod investigation_events;
mod load;
pub mod matcher;
mod metadata_match;
pub mod options;
mod preview;
pub mod relation_filter;
mod search_info;
pub mod trace;

fn check_error(error: crate::mutations::check::CheckError) -> crate::protocol::CommandError {
    let mut result = crate::protocol::CommandError::new(error.code, error.message);
    result.path = Some(error.path.into_boxed_str());
    if result.code.as_ref() == "unsupported-unpaired-surrogate" {
        result.recovery =
            Some("Replace the unpaired surrogate with valid Unicode, then retry.".into());
    }
    result.diagnostics = error
        .diagnostics
        .into_iter()
        .map(|item| crate::protocol::Diagnostic {
            code: item.code.into(),
            message: item.message,
            path: Some(item.path),
            target: None,
            cause_category: None,
            operation: None,
            detail: None,
            reason: None,
            recovery: (item.code == "unsupported-unpaired-surrogate").then(|| {
                "Replace the unpaired surrogate with valid Unicode, then retry.".to_owned()
            }),
        })
        .collect();
    if let Some(partial) = error.partial {
        match serde_json::to_string(&partial) {
            Ok(serialized) => result.partial = Some(Box::new(serialized)),
            Err(error) => result.diagnostics.push(crate::protocol::Diagnostic {
                code: "partial-serialization-failed".into(),
                message: error.to_string(),
                path: None,
                target: None,
                cause_category: None,
                operation: None,
                detail: None,
                reason: None,
                recovery: None,
            }),
        }
    }
    result
}

fn selector_message(selector: &str, error: crate::domains::SelectorError) -> String {
    match error {
        crate::domains::SelectorError::NotFound => format!(
            "selector does not exist: {selector}; use list or candidates to choose a valid ID"
        ),
        crate::domains::SelectorError::Ambiguous(ids) => format!(
            "selector is ambiguous: {selector}; choose a full ID: {}",
            ids.join(", ")
        ),
    }
}
fn selector_error(
    selector: &str,
    error: crate::domains::SelectorError,
) -> crate::protocol::CommandError {
    let code = match error {
        crate::domains::SelectorError::NotFound => "selector-not-found",
        crate::domains::SelectorError::Ambiguous(_) => "selector-ambiguous",
    };
    let mut result = crate::protocol::CommandError::new(code, selector_message(selector, error));
    result.field = Some("selector".into());
    result.recovery = Some("Use list or candidates and retry with an exact ID.".into());
    result
}

fn verify_selector<S>(
    snapshot: &crate::index::QuerySnapshot<S>,
    selector: Option<&str>,
    name: impl Fn(&S) -> &str,
) -> Result<(), crate::protocol::CommandError> {
    if let Some(selector) = selector {
        crate::domains::resolve_selector(&snapshot.index().index().entries, selector, name)
            .map_err(|error| selector_error(selector, error))?;
    }
    Ok(())
}
fn projection_error(message: String) -> crate::protocol::CommandError {
    let mut error = crate::protocol::CommandError::new("query-failed", message);
    error.recovery = Some("Check the selected record and published index, then retry.".into());
    error
}
