use super::*;

const CONTENT_POLICY: super::super::content::Policy = super::super::content::Policy {
    max_candidate_files: 10000,
    max_file_bytes: 2 * 1024 * 1024,
    max_total_bytes: 20 * 1024 * 1024,
    max_files: 20,
    max_matches: 3,
    max_characters: 12000,
};

#[derive(Serialize)]
pub struct ContentRecord {
    #[serde(flatten)]
    pub record: ListRecord,
    pub previews: Vec<super::super::preview::Preview>,
}
pub use super::super::search_info::Truncation;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchResult {
    pub command: &'static str,
    #[serde(rename = "in")]
    pub scope: &'static str,
    pub status: &'static str,
    pub records: Vec<ContentRecord>,
    pub warnings: Vec<String>,
    pub truncation: Truncation,
    pub search_info: super::super::search_info::SearchInfo<SearchFilters>,
}
pub fn project_content(
    root: &crate::source::Root,
    directory: &str,
    snapshot: &QuerySnapshot<DecisionState>,
    options: &SearchOptions,
    filters: DecisionFilters,
) -> Result<ContentSearchResult, String> {
    use super::super::{content, search_info};
    let context =
        super::search::SearchContext::new(snapshot, options, filters.status, filters.alignment)?;
    let selected = context.selected_sources(snapshot, options);
    let policy = CONTENT_POLICY;
    let scan = content::scan(
        root,
        content::SourceSelection {
            directory,
            entries: selected,
        },
        &context.matcher,
        policy,
        crate::domains::decision::id_from_markdown,
    )?;
    let filters = context.filters(options);
    let search_info::ContentPresentation {
        info,
        warnings,
        truncation,
    } = search_info::content_presentation(
        options.text.clone(),
        search_info::mode_name(options.mode),
        filters,
        &policy,
        &scan,
    );
    let records = project_hits(snapshot, scan.hits, &context.relations)?;
    Ok(ContentSearchResult {
        command: "search",
        scope: "content",
        status: "ok",
        records,
        warnings,
        truncation,
        search_info: info,
    })
}

// Map already selected current-text hits back to their validated index projections.
fn project_hits(
    snapshot: &QuerySnapshot<DecisionState>,
    hits: Vec<super::super::content::Hit>,
    relations: &super::super::relation_filter::SearchRelations,
) -> Result<Vec<ContentRecord>, String> {
    let records = hits
        .into_iter()
        .map(|hit| {
            let s = snapshot
                .get(&hit.id)
                .ok_or_else(|| format!("unmapped search hit: {}", hit.id))?;
            Ok(ContentRecord {
                record: ListRecord::project(
                    &hit.id,
                    s,
                    relations
                        .evidence
                        .as_ref()
                        .and_then(|map| map.get(&hit.id).cloned()),
                ),
                previews: hit.previews,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(records)
}
