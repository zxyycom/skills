//! Compose resource diagnostics with the original typed query DTO.
use super::{ExecutionContext, emit_success};
use crate::resource_review::{
    self, ReportResources,
    policy::{Level, Policy},
};

const CONSOLE_FINDING_LIMIT: usize = 12;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Reviewed<'a> {
    resource_review: resource_review::Review,
    #[serde(flatten)]
    result: &'a crate::queries::investigation::QueryResult,
}

pub(super) fn emit(
    context: ExecutionContext<'_>,
    directory: &str,
    value: crate::queries::investigation::QueryResult,
    policy: &Policy,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
    } = context;
    use crate::queries::investigation::QueryResult;
    let Some(Selection { reports, blocked }) = selection(&value) else {
        return emit_success(
            command,
            json,
            matches!(&value, QueryResult::Trace(_)),
            &value,
            value.warnings(),
        );
    };
    let review = resource_review::review(root, directory, &reports, policy, &blocked);
    print_review(&review);
    emit_success(
        command,
        json,
        false,
        &Reviewed {
            result: &value,
            resource_review: review,
        },
        value.warnings(),
    )
}

struct Selection {
    reports: ReportResources,
    blocked: std::collections::BTreeSet<String>,
}

fn selection(value: &crate::queries::investigation::QueryResult) -> Option<Selection> {
    use crate::queries::investigation::QueryResult;
    match value {
        QueryResult::ShowCandidate(result) => {
            Some(candidate_selection(std::slice::from_ref(&result.candidate)))
        }
        QueryResult::Candidates(result) => Some(candidate_selection(&result.candidates)),
        QueryResult::Check(result) => Some(Selection {
            reports: result.resource_refs.clone(),
            blocked: Default::default(),
        }),
        _ => None,
    }
}

fn candidate_selection(candidates: &[crate::queries::investigation::Candidate]) -> Selection {
    let mut selected = Selection {
        reports: Default::default(),
        blocked: Default::default(),
    };
    for candidate in candidates {
        selected
            .reports
            .insert(candidate.id.clone(), candidate.resource_ids.clone());
        selected
            .blocked
            .extend(candidate.blocked_resource_ids.iter().cloned());
    }
    selected
}

fn format_summary(review: &resource_review::Review) -> String {
    let state = if !review.enabled {
        "disabled"
    } else if review.complete {
        "complete"
    } else {
        "incomplete"
    };
    let counts = review
        .summary
        .by_code
        .iter()
        .map(|(code, count)| format!("{code}={count}"))
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "resource-review: {state}; {} resources; {} warnings, {} info; {} omitted; {} bytes reserved{}",
        review.resource_count,
        review.summary.warnings,
        review.summary.info,
        review.omitted_findings,
        review.read_budget_used_bytes,
        if counts.is_empty() {
            String::new()
        } else {
            format!("; {counts}")
        }
    )
}

pub(super) fn print_review(review: &resource_review::Review) {
    eprintln!("{}", format_summary(review));
    for message in review.coverage_warnings() {
        eprintln!("warning: {message}");
    }
    for finding in review.findings.iter().take(CONSOLE_FINDING_LIMIT) {
        let level = match finding.level {
            Level::Info => "info",
            Level::Warn => "warning",
            Level::Off => continue,
        };
        eprintln!(
            "{level}: {}: {}: {}",
            finding.code, finding.target, finding.message
        );
    }
    if review.findings.len() > CONSOLE_FINDING_LIMIT {
        eprintln!(
            "info: resource-review-details: {} retained findings not printed; inspect resourceReview.findings",
            review.findings.len() - CONSOLE_FINDING_LIMIT
        );
    }
}
