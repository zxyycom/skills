use super::*;

pub(super) struct Initial {
    pub states: BTreeMap<String, domains::investigation::InvestigationState>,
    pub revisions: BTreeMap<String, String>,
    pub candidate_count: usize,
    pub checked_ids: Vec<String>,
    pub formal_count: usize,
    pub warnings: Vec<String>,
}
pub(super) fn collect(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
    rebuild: bool,
) -> Result<Initial, CheckError> {
    let mut collected = super::collection::collect_members(root, dir, directory)?;
    let members = std::mem::take(&mut collected.members);
    let mut scanned = super::sources::scan(root, dir, members)?;
    review_resources(root, directory, &collected, &mut scanned)?;
    if !scanned.diagnostics.is_empty() {
        return Err(partial_error(dir, scanned));
    }
    if !rebuild {
        scanned
            .warnings
            .extend(super::investigation_history_warnings(
                root,
                dir,
                &scanned.states,
            ));
    }
    Ok(assemble_initial(scanned))
}

fn assemble_initial(scanned: super::sources::ScannedSources) -> Initial {
    let super::sources::ScannedSources {
        states,
        revisions,
        all_ids,
        candidate_count,
        mut warnings,
        ..
    } = scanned;
    let formal_count = states.len();
    let mut checked_ids: Vec<_> = all_ids.into_iter().collect();
    checked_ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    warnings.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    Initial {
        states,
        revisions,
        candidate_count,
        checked_ids,
        formal_count,
        warnings,
    }
}

fn review_resources(
    root: &Root,
    directory: &str,
    collected: &super::collection::CollectionMembers,
    scanned: &mut super::sources::ScannedSources,
) -> Result<(), CheckError> {
    super::resources::ResourceReview {
        root,
        directory,
        states: &scanned.states,
        candidate_refs: &scanned.candidate_refs,
        candidate_owners: &scanned.candidate_owners,
        resource_root_unsafe: collected.resource_root_unsafe,
        resources_exist: collected.resources_exist,
    }
    .verify(&mut scanned.diagnostics, &mut scanned.warnings)
}

fn partial_error(dir: &RelativePath, scanned: super::sources::ScannedSources) -> CheckError {
    let super::sources::ScannedSources {
        diagnostics,
        all_ids,
        available_formal_count,
        candidate_count,
        warnings,
        ..
    } = scanned;
    let errors = diagnostics
        .iter()
        .map(|e| format!("{}: {}", e.path, e.message))
        .collect();
    let mut checked_ids: Vec<_> = all_ids.into_iter().collect();
    checked_ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    let partial = CheckResult {
        resource_refs: BTreeMap::new(),
        scope: "partial",
        checked_ids,
        formal_count: available_formal_count,
        candidate_count,
        index_state: "not-checked",
        warnings,
        index_path: dir
            .as_path()
            .join("investigation-index.json")
            .to_string_lossy()
            .replace('\\', "/"),
        errors,
        summary: None,
        available_report_count: Some(available_formal_count),
        selected_report_count: Some(available_formal_count),
        index_checked: Some(false),
    };
    aggregate(diagnostics, partial)
}
