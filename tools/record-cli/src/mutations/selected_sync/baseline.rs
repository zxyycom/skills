use crate::{
    domains,
    index::{self, DomainDefinition, ValidatedIndex},
    protocol::Diagnostic,
    source::{self, ExpectedFile, RelativePath, Root, SourceSnapshot},
    source_revision::Domain,
    transaction::TxError,
};
use std::collections::{BTreeMap, BTreeSet};

fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}

pub(in crate::mutations) fn acquire<D: DomainDefinition>(
    root: &Root,
    directory: &str,
    index_name: &str,
    domain: &D,
    record_domain: Domain,
) -> Result<(RelativePath, SourceSnapshot, ValidatedIndex<D::State>), TxError>
where
    D::State: Clone,
{
    let dir = RelativePath::new(directory).map_err(|e| fail("path-invalid", e.to_string()))?;
    let index_path = RelativePath::new(dir.as_path().join(index_name))
        .map_err(|e| fail("path-invalid", e.to_string()))?;
    let ExpectedFile::Present(index_file) = source::capture(root, &index_path)
        .map_err(|e| baseline_read_failure(e, record_domain, index_name))?
    else {
        return Err(missing_baseline(record_domain, index_name));
    };
    let baseline = validate_baseline(&index_file, domain, record_domain, index_name)?;
    Ok((dir, index_file, baseline))
}

fn missing_baseline(record_domain: Domain, index_name: &str) -> TxError {
    let (code, reason, recovery) = match record_domain {
        Domain::Decision => (
            "decision-records.sync-index-failed",
            "The derived Decision index filesystem operation could not complete.",
            "Restore the required Decision source or derived index, then retry the command.",
        ),
        Domain::Investigation => (
            "state-index.selected-baseline-invalid",
            "selected sync requires a valid baseline; the state-index file does not exist",
            "correct the reported derived-index problem, then retry the synchronization",
        ),
    };
    fail(
        "index-missing",
        "selected sync requires a published baseline",
    )
    .with_diagnostics(vec![Diagnostic {
        code: code.into(),
        message: reason.into(),
        path: None,
        target: Some(index_name.into()),
        cause_category: Some("not-found".into()),
        operation: Some("read a state-index file".into()),
        detail: None,
        reason: Some(reason.into()),
        recovery: Some(recovery.into()),
    }])
}

fn validate_baseline<D: DomainDefinition>(
    file: &SourceSnapshot,
    domain: &D,
    record_domain: Domain,
    index_name: &str,
) -> Result<ValidatedIndex<D::State>, TxError>
where
    D::State: Clone,
{
    let baseline = index::parse_index(&file.bytes, domain).map_err(|e| {
        baseline_failure(
            fail("index-invalid", e.to_string()),
            record_domain,
            index_name,
        )
    })?;
    if index::serialize_index(&baseline, domain).map_err(|e| {
        baseline_failure(
            fail("index-invalid", e.to_string()),
            record_domain,
            index_name,
        )
    })? != file.bytes
    {
        return Err(baseline_failure(
            fail(
                "index-noncanonical",
                "selected sync requires a canonical baseline",
            ),
            record_domain,
            index_name,
        ));
    }
    index::QuerySnapshot::new(baseline.clone())
        .graph(domain)
        .map_err(|e| {
            baseline_failure(
                fail("index-invalid", e.to_string()),
                record_domain,
                index_name,
            )
        })?;
    Ok(baseline)
}

fn baseline_read_failure(error: source::SourceError, domain: Domain, target: &str) -> TxError {
    let io_facts = match &error {
        source::SourceError::Io(io) => Some((
            match io.kind() {
                std::io::ErrorKind::NotFound => "not-found",
                std::io::ErrorKind::PermissionDenied => "access-denied",
                _ => "unknown",
            },
            io.to_string(),
        )),
        _ => None,
    };
    let mut failure = baseline_failure(fail("index-read", error.to_string()), domain, target);
    if let Some(diagnostic) = failure.diagnostics.first_mut() {
        diagnostic.operation = Some("read a state-index file".into());
        if let Some((category, detail)) = io_facts {
            diagnostic.cause_category = Some(category.into());
            diagnostic.detail = Some(detail);
        }
    }
    failure
}

fn baseline_failure(error: TxError, domain: Domain, target: &str) -> TxError {
    let (code, recovery) = match domain {
        Domain::Decision => (
            "decision-records.sync-index-failed",
            "Inspect the decision collection and derived index, then retry the command.",
        ),
        Domain::Investigation => (
            "state-index.selected-baseline-invalid",
            "correct the reported derived-index problem, then retry the synchronization",
        ),
    };
    let reason = format!("selected sync requires a valid baseline; {}", error.message);
    error.with_diagnostics(vec![Diagnostic {
        code: code.into(),
        message: reason.clone(),
        path: None,
        target: Some(target.into()),
        cause_category: None,
        operation: None,
        detail: None,
        reason: Some(reason),
        recovery: Some(recovery.into()),
    }])
}

fn policy(domain: Domain) -> (&'static str, &'static str, &'static str) {
    match domain {
        Domain::Decision => (
            "Decision",
            "decision-records",
            "Use an existing Decision ID or a unique name, selecting each ID at most once.",
        ),
        Domain::Investigation => (
            "Investigation",
            "investigation-report",
            "correct the reported derived-index problem, then retry the synchronization",
        ),
    }
}

pub(in crate::mutations) fn require_selection(
    selectors: &[String],
    domain: Domain,
) -> Result<(), TxError> {
    if selectors.is_empty() {
        return Err(fail(
            "invalid-selection",
            "selected sync requires selectors",
        ));
    }
    let (label, prefix, recovery) = policy(domain);
    let mut seen = BTreeSet::new();
    let mut diagnostics = Vec::new();
    for selector in selectors {
        let issue = if selector.is_empty()
            || selector.trim() != selector
            || selector.chars().any(char::is_control)
        {
            Some((
                "invalid",
                format!(
                    "Selected {label} selectors must be non-empty text without surrounding whitespace or control characters."
                ),
            ))
        } else if !seen.insert(selector) {
            Some((
                "duplicate",
                format!("Selected {label} selector appears more than once: {selector}"),
            ))
        } else {
            None
        };
        if let Some((kind, reason)) = issue {
            diagnostics.push(selector_diagnostic(
                prefix, kind, selector, reason, recovery,
            ));
        }
    }
    if diagnostics.is_empty() {
        Ok(())
    } else {
        Err(fail("selector", "selected selectors are invalid").with_diagnostics(diagnostics))
    }
}

pub(in crate::mutations) fn resolve<S>(
    entries: &BTreeMap<String, S>,
    selectors: &[String],
    name: fn(&S) -> &str,
    domain: Domain,
    index_path: &str,
) -> Result<BTreeSet<String>, TxError> {
    let (label, prefix, recovery) = policy(domain);
    let mut selected = BTreeSet::new();
    let mut diagnostics = Vec::new();
    let mut duplicate = false;
    for selector in selectors {
        let resolved = match resolve_one(entries, selector, name, domain) {
            Ok(id) => Some(id),
            Err(diagnostic) => {
                diagnostics.push(*diagnostic);
                None
            }
        };
        if let Some(resolved) = resolved
            && !selected.insert(resolved)
        {
            duplicate = true;
        }
    }
    if duplicate {
        diagnostics.push(selector_diagnostic(
            prefix,
            "duplicate",
            index_path,
            format!("Selected {label} selectors resolve to the same {label} ID."),
            recovery,
        ));
    }
    if diagnostics.is_empty() {
        Ok(selected)
    } else {
        Err(fail("selector", "selected selectors are invalid").with_diagnostics(diagnostics))
    }
}

fn resolve_one<S>(
    entries: &BTreeMap<String, S>,
    selector: &str,
    name: fn(&S) -> &str,
    domain: Domain,
) -> Result<String, Box<Diagnostic>> {
    let (label, prefix, recovery) = policy(domain);
    let normalized = selector
        .get(selector.len().saturating_sub(3)..)
        .filter(|suffix| suffix.eq_ignore_ascii_case(".md"))
        .map(|_| &selector[..selector.len() - 3])
        .unwrap_or(selector);
    match domains::resolve_selector(entries, selector, name) {
        Ok((id, _)) => Ok(id.to_owned()),
        Err(domains::SelectorError::NotFound)
            if domains::is_kebab(normalized) && domains::name_from_id(normalized) != normalized =>
        {
            Ok(normalized.to_owned())
        }
        Err(error) => {
            let (kind, reason) = match error {
                domains::SelectorError::NotFound => (
                    "not-found",
                    format!(
                        "{label} selector does not resolve in the baseline or current collection: {normalized}"
                    ),
                ),
                domains::SelectorError::Ambiguous(matches) => (
                    "ambiguous",
                    format!(
                        "{label} name is ambiguous: {normalized}; choose one standard ID: {}",
                        matches.join(", ")
                    ),
                ),
            };
            Err(Box::new(selector_diagnostic(
                prefix, kind, normalized, reason, recovery,
            )))
        }
    }
}

fn selector_diagnostic(
    prefix: &str,
    kind: &str,
    target: &str,
    reason: String,
    recovery: &str,
) -> Diagnostic {
    Diagnostic {
        code: format!("{prefix}.selector-{kind}"),
        message: reason.clone(),
        path: None,
        target: Some(target.to_owned()),
        cause_category: None,
        operation: None,
        detail: None,
        reason: Some(reason),
        recovery: Some(recovery.to_owned()),
    }
}
