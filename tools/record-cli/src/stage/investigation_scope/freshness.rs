use super::*;

/// Bind an observed report to its selected validated index entry.
pub(super) fn verify_source(
    source: &source::SourceSnapshot,
    id: &str,
    state: &InvestigationState,
    workspace: &ValidatedIndex<InvestigationState>,
) -> Result<(), IndexStageError> {
    let parsed = parse_established(&source.bytes, id, &state.source_path).map_err(|reason| {
        IndexStageError::SelectedSource {
            id: id.to_owned(),
            path: source.path.as_path().to_owned(),
            issue: crate::stage::index_scope::SelectedSourceIssue::Invalid(reason),
        }
    })?;
    if parsed.state != *state
        || source_revision::fingerprint(
            source_revision::Domain::Investigation,
            id,
            &state.source_path,
            &parsed.markdown,
        ) != workspace.index().source_revision.entries[id]
    {
        return Err(IndexStageError::SelectedSource {
            id: id.to_owned(),
            path: source.path.as_path().to_owned(),
            issue: crate::stage::index_scope::SelectedSourceIssue::StaleIndex,
        });
    }
    Ok(())
}
