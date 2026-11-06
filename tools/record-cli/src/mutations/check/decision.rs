use super::*;

mod sources;
use sources::{CollectionMembers, ScannedDecisions, collect_members, scan_sources};

/// Decision full check compares the first safely captured source set with the
/// full expected projection. It never reads an index as a substitute for source.
pub fn decision(root: &Root, directory: &str, ids: &[String]) -> Result<CheckResult, CheckError> {
    decision_stage(root, directory, ids, false).map(|stage| stage.result)
}
pub(crate) fn decision_stage(
    root: &Root,
    directory: &str,
    ids: &[String],
    rebuild: bool,
) -> Result<DecisionStage, CheckError> {
    if !ids.is_empty() {
        return Err(error(
            "invalid-selection",
            directory,
            "Decision check does not accept ID filters",
        ));
    }
    let dir = RelativePath::new(directory)
        .map_err(|e| error("path-invalid", directory, e.to_string()))?;
    let CollectionMembers {
        directories,
        members,
        index_identity,
    } = collect_members(root, &dir, directory)?;
    let scanned = scan_sources(root, &dir, members)?;
    let request = DecisionIndexRequest {
        root,
        dir: &dir,
        directory,
        index_identity,
        rebuild,
    };
    let (source, index) = request.prepare(scanned)?;
    Ok(source.finish(directories, index))
}

struct DecisionIndexRequest<'a> {
    root: &'a Root,
    dir: &'a RelativePath,
    directory: &'a str,
    index_identity: Option<source::FileIdentity>,
    rebuild: bool,
}
struct DecisionSources {
    source_proofs: Vec<FileProof>,
    candidate_count: usize,
    activation_paths: Vec<(String, String)>,
    warnings: Vec<String>,
    summary: DecisionSummary,
    checked_ids: Vec<String>,
    formal_count: usize,
}
impl DecisionIndexRequest<'_> {
    fn prepare(
        self,
        scanned: ScannedDecisions,
    ) -> Result<(DecisionSources, IndexCheck), CheckError> {
        let partial = partial_result(self.dir, &scanned);
        let (sources, states, revisions) = DecisionSources::split(scanned);
        let index = self.verify(states, revisions, sources.formal_count, partial)?;
        Ok((sources, index))
    }
    fn verify(
        self,
        states: BTreeMap<String, domains::decision::DecisionState>,
        revisions: BTreeMap<String, String>,
        formal_count: usize,
        partial: CheckResult,
    ) -> Result<IndexCheck, CheckError> {
        IndexInput {
            definition: &Definition,
            domain: Domain::Decision,
            policy: IndexPolicy {
                index_name: "decision-index.json",
                empty_message: "cannot synchronize an unpublished candidate-only collection",
                missing_message: "established Decisions require a published index",
                allow_first_candidate: true,
            },
            root: self.root,
            dir: self.dir,
            directory: self.directory,
            index_identity: self.index_identity,
            states,
            revisions,
            formal_count,
            partial,
            rebuild: self.rebuild,
        }
        .verify()
    }
}
impl DecisionSources {
    fn split(
        scanned: ScannedDecisions,
    ) -> (
        Self,
        BTreeMap<String, domains::decision::DecisionState>,
        BTreeMap<String, String>,
    ) {
        let ScannedDecisions {
            source_proofs,
            states,
            revisions,
            candidate_count,
            activation_paths,
            warnings,
            summary,
            checked_ids,
        } = scanned;
        let formal_count = states.len();
        (
            Self {
                source_proofs,
                candidate_count,
                activation_paths,
                warnings,
                summary,
                checked_ids,
                formal_count,
            },
            states,
            revisions,
        )
    }
    fn finish(self, directories: Vec<DirectoryProof>, index: IndexCheck) -> DecisionStage {
        let Self {
            source_proofs,
            candidate_count,
            mut activation_paths,
            mut warnings,
            summary,
            checked_ids,
            formal_count,
        } = self;
        let IndexCheck {
            index_path,
            index_proof,
            target,
            index_state,
            needs_write,
        } = index;
        warnings.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        activation_paths.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
        DecisionStage {
            activation_paths: activation_paths.into_iter().map(|(_, path)| path).collect(),
            proof: DecisionProof {
                directories,
                sources: source_proofs,
                index: index_proof,
            },
            target,
            needs_write,
            result: CheckResult {
                scope: "all",
                checked_ids,
                formal_count,
                candidate_count,
                index_state,
                warnings,
                index_path: index_path.as_path().to_string_lossy().replace('\\', "/"),
                errors: vec![],
                summary: Some(summary),
                available_report_count: None,
                selected_report_count: None,
                index_checked: None,
            },
        }
    }
}

fn partial_result(dir: &RelativePath, scanned: &ScannedDecisions) -> CheckResult {
    CheckResult {
        scope: "all",
        checked_ids: scanned.checked_ids.clone(),
        formal_count: scanned.states.len(),
        candidate_count: scanned.candidate_count,
        index_state: "not-checked",
        warnings: scanned.warnings.clone(),
        index_path: dir
            .as_path()
            .join("decision-index.json")
            .to_string_lossy()
            .replace('\\', "/"),
        errors: vec![],
        summary: Some(scanned.summary.clone()),
        available_report_count: None,
        selected_report_count: None,
        index_checked: Some(false),
    }
}
