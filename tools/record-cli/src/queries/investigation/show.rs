use super::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShowResult {
    pub status: &'static str,
    pub id: String,
    pub index_path: String,
    pub markdown: String,
    pub state: InvestigationState,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}
pub fn show(
    root: &crate::source::Root,
    directory: &str,
    snapshot: &QuerySnapshot<InvestigationState>,
    selector: &str,
) -> Result<ShowResult, crate::protocol::CommandError> {
    let (id, state) =
        crate::domains::resolve_selector(&snapshot.index().index().entries, selector, |s| &s.name)
            .map_err(|e| super::super::selector_error(selector, e))?;
    let markdown =
        super::super::load::selected_text(root, directory, &state.source_path, id, |text| {
            crate::domains::investigation::id_from_markdown(
                text.strip_prefix('\u{feff}').unwrap_or(text),
            )
        })?;
    let stale = super::super::load::selected_is_stale(
        snapshot,
        id,
        &state.source_path,
        &markdown,
        crate::source_revision::Domain::Investigation,
    )?;
    let warnings = if stale {
        vec!["The persisted Investigation index is stale; the metadata reflects the last published index snapshot while the body is read from the current investigation Markdown. Run sync-index to publish the current projection.".into()]
    } else {
        vec![]
    };
    Ok(ShowResult {
        status: "ok",
        id: id.to_owned(),
        index_path: super::super::load::display_index_path(
            root,
            directory,
            "investigation-index.json",
        ),
        markdown,
        state: state.clone(),
        errors: vec![],
        warnings,
    })
}
