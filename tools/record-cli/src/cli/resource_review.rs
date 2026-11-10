//! Compose resource diagnostics with the original typed query DTO.
use super::{ExecutionContext, emit_success};
use crate::resource_review::{
    self, ReportResources,
    policy::{Level, Policy},
};

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
    print_info(&review);
    let mut warnings = value.warnings().to_vec();
    warnings.extend(review.warnings());
    emit_success(
        command,
        json,
        false,
        &Reviewed {
            result: &value,
            resource_review: review,
        },
        &warnings,
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

pub(super) fn print_info(review: &resource_review::Review) {
    for finding in review.findings.iter().filter(|f| f.level == Level::Info) {
        eprintln!(
            "info: {}: {}: {}",
            finding.code, finding.target, finding.message
        );
    }
}
