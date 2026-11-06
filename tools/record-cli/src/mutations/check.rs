//! Full source collection checks. These are read-only first-observation checks;
//! they do not promise end-of-command freshness or an atomic snapshot.
use crate::{
    domains::{
        self,
        decision::{DecisionState, Definition},
    },
    index::{IndexV4, Revision},
    source::{self, DirectoryMember, ExpectedFile, MemberKind, RelativePath, Root},
    source_revision::{self, Domain},
};
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub scope: &'static str,
    pub checked_ids: Vec<String>,
    pub formal_count: usize,
    pub candidate_count: usize,
    pub index_state: &'static str,
    pub warnings: Vec<String>,
    pub index_path: String,
    pub errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<DecisionSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_report_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_report_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_checked: Option<bool>,
}
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionSummary {
    pub active_count: usize,
    pub activation_candidate_count: usize,
    pub body_ready_candidate_count: usize,
    pub aligned_count: usize,
    pub archived_count: usize,
    pub decision_count: usize,
    pub scaffold_candidate_count: usize,
    pub unaligned_count: usize,
}
#[derive(Clone, Debug, serde::Serialize)]
pub struct CheckDiagnostic {
    pub code: &'static str,
    pub path: String,
    pub message: String,
}
#[derive(Debug, serde::Serialize)]
pub struct CheckError {
    pub code: &'static str,
    pub path: String,
    pub message: String,
    pub diagnostics: Vec<CheckDiagnostic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partial: Option<Box<CheckResult>>,
}
fn error(code: &'static str, path: impl Into<String>, message: impl Into<String>) -> CheckError {
    let path = path.into();
    let message = message.into();
    CheckError {
        code,
        diagnostics: vec![CheckDiagnostic {
            code,
            path: path.clone(),
            message: message.clone(),
        }],
        path,
        message,
        partial: None,
    }
}
fn attach_partial(mut failure: CheckError, mut partial: CheckResult) -> CheckError {
    partial
        .errors
        .push(format!("{}: {}", failure.path, failure.message));
    if failure.diagnostics.is_empty() {
        failure.diagnostics.push(CheckDiagnostic {
            code: failure.code,
            path: failure.path.clone(),
            message: failure.message.clone(),
        });
    }
    failure.partial = Some(Box::new(partial));
    failure
}
fn aggregate(mut errors: Vec<CheckError>, mut partial: CheckResult) -> CheckError {
    errors.sort_by(|a, b| {
        a.path
            .encode_utf16()
            .cmp(b.path.encode_utf16())
            .then(a.code.cmp(b.code))
    });
    let diagnostics = errors
        .into_iter()
        .map(|e| CheckDiagnostic {
            code: e.code,
            path: e.path,
            message: e.message,
        })
        .collect::<Vec<_>>();
    partial.errors = diagnostics
        .iter()
        .map(|item| format!("{}: {}", item.path, item.message))
        .collect();
    let first = &diagnostics[0];
    CheckError {
        code: first.code,
        path: first.path.clone(),
        message: format!("{} check errors", diagnostics.len()),
        diagnostics,
        partial: Some(Box::new(partial)),
    }
}

struct SourceMember {
    path: String,
    member: DirectoryMember,
}

fn capture_member(
    root: &Root,
    dir: &RelativePath,
    name: &str,
    member: &DirectoryMember,
) -> Result<source::SourceSnapshot, CheckError> {
    let path = RelativePath::new(dir.as_path().join(name))
        .map_err(|e| error("path-invalid", name, e.to_string()))?;
    let observed =
        source::capture(root, &path).map_err(|e| error("source-read", name, e.to_string()))?;
    let ExpectedFile::Present(file) = observed else {
        return Err(error("source-changed", name, "source disappeared"));
    };
    if file.identity != member.identity {
        return Err(error("source-changed", name, "source identity changed"));
    }
    Ok(file)
}

mod proof;
pub(crate) use proof::{
    DecisionProof, DecisionStage, DirectoryProof, FileProof, InvestigationProof, InvestigationStage,
};
mod index;
use index::{IndexCheck, IndexInput, IndexPolicy};

mod decision;
mod history;
mod investigation;
mod selected;
#[cfg(test)]
mod tests;

pub use decision::decision;
pub(crate) use decision::decision_stage;
pub use investigation::investigation;
pub(crate) use investigation::investigation_stage;
