use super::history::investigation_history_warnings;
use super::selected::selected_investigations;
use super::*;

mod collection;
mod initial;
mod resources;
mod sources;

/// IR full check validates the first safely acquired sources, relation graph,
/// resource evidence and index. Selected checks use their narrower path.
pub fn investigation(
    root: &Root,
    directory: &str,
    ids: &[String],
) -> Result<CheckResult, CheckError> {
    if !ids.is_empty() {
        return selected_investigations(root, directory, ids);
    }
    investigation_stage(root, directory, false).map(|stage| stage.result)
}
pub(crate) fn investigation_stage(
    root: &Root,
    directory: &str,
    rebuild: bool,
) -> Result<InvestigationStage, CheckError> {
    let dir = RelativePath::new(directory)
        .map_err(|e| error("path-invalid", directory, e.to_string()))?;
    let initial = initial::collect(root, &dir, directory, rebuild)?;
    let partial = partial_result(&dir, &initial);
    let mut result = partial.clone();
    let initial::Initial {
        directories,
        index_identity,
        source_proofs,
        states,
        revisions,
        formal_count,
        resource_evidence,
        ..
    } = initial;
    let IndexCheck {
        index_path,
        index_proof,
        target,
        index_state,
        needs_write,
    } = IndexInput {
        definition: &domains::investigation::Definition,
        domain: Domain::Investigation,
        policy: IndexPolicy {
            index_name: "investigation-index.json",
            empty_message: "investigation collection must contain at least one report",
            missing_message: "established Investigations require a published index",
            allow_first_candidate: false,
        },
        root,
        dir: &dir,
        directory,
        index_identity,
        states,
        revisions,
        formal_count,
        partial,
        rebuild,
    }
    .verify()?;
    result.index_state = index_state;
    result.index_path = index_path.as_path().to_string_lossy().replace('\\', "/");
    result.index_checked = Some(true);
    Ok(InvestigationStage {
        proof: Some(InvestigationProof {
            directories,
            sources: source_proofs,
            index: index_proof,
            resources: resource_evidence,
        }),
        target,
        needs_write,
        result,
    })
}

fn partial_result(dir: &RelativePath, initial: &initial::Initial) -> CheckResult {
    CheckResult {
        scope: "all",
        checked_ids: initial.checked_ids.clone(),
        formal_count: initial.formal_count,
        candidate_count: initial.candidate_count,
        index_state: "not-checked",
        warnings: initial.warnings.clone(),
        index_path: dir
            .as_path()
            .join("investigation-index.json")
            .to_string_lossy()
            .replace('\\', "/"),
        errors: vec![],
        summary: None,
        available_report_count: Some(initial.formal_count),
        selected_report_count: Some(initial.formal_count),
        index_checked: Some(false),
    }
}
