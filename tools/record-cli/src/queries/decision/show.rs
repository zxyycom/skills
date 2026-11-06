use super::*;

#[derive(Serialize)]
pub struct ShowResult {
    pub status: &'static str,
    pub command: &'static str,
    pub body: String,
    pub record: ListRecord,
    pub warnings: Vec<String>,
}
pub fn show(
    root: &crate::source::Root,
    directory: &str,
    snapshot: &QuerySnapshot<DecisionState>,
    selector: &str,
) -> Result<ShowResult, crate::protocol::CommandError> {
    let (id, s) =
        crate::domains::resolve_selector(&snapshot.index().index().entries, selector, |s| &s.name)
            .map_err(|e| super::super::selector_error(selector, e))?;
    let body = super::super::load::selected_text(
        root,
        directory,
        &s.source_path,
        id,
        crate::domains::decision::id_from_markdown,
    )?;
    let stale = super::super::load::selected_is_stale(
        snapshot,
        id,
        &s.source_path,
        &body,
        crate::source_revision::Domain::Decision,
    )?;
    let warnings = if stale {
        vec!["The selected Decision metadata differs from its current source; the metadata reflects the last published index snapshot while the body is read from the current decision Markdown. Run sync-index to publish the current projection.".into()]
    } else {
        vec![]
    };
    Ok(ShowResult {
        status: "ok",
        command: "show",
        body,
        record: ListRecord::project(id, s, None),
        warnings,
    })
}
