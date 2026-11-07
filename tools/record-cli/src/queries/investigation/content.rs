use super::*;

fn content_policy(max_files: usize) -> super::super::content::Policy {
    super::super::content::Policy {
        max_candidate_files: 2000,
        max_file_bytes: 2 * 1024 * 1024,
        max_total_bytes: 20 * 1024 * 1024,
        max_files,
        max_matches: 3,
        max_characters: 24000,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentEntry {
    pub formed_at: String,
    pub id: String,
    pub previews: Vec<super::super::preview::Preview>,
    pub question: String,
    pub source_path: String,
    pub tags: Vec<String>,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_relations: Option<Vec<FilterRelation>>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchResult {
    pub status: &'static str,
    pub index_path: String,
    pub entries: Vec<ContentEntry>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub truncation: Truncation,
    pub search_info: super::super::search_info::SearchInfo<AppliedListFilters>,
}
pub fn project_content(
    root: &crate::source::Root,
    directory: &str,
    snapshot: &QuerySnapshot<InvestigationState>,
    options: &SearchOptions,
    range: FormationRange<'_>,
) -> Result<ContentSearchResult, String> {
    use super::super::{content, search_info};
    let context = super::search::SearchContext::new(snapshot, options, range.from, range.to)?;
    let selected = context.selected_sources(snapshot, options)?;
    let policy = content_policy(options.limit as usize);
    let scan = content::scan(
        root,
        content::SourceSelection {
            directory,
            entries: selected,
        },
        &context.matcher,
        policy,
        |text| {
            crate::domains::investigation::id_from_markdown(
                text.strip_prefix('\u{feff}').unwrap_or(text),
            )
        },
    )?;
    let filters = context.filters(options)?;
    let presentation = search_info::content_presentation(
        context.text.clone(),
        search_info::mode_name(options.mode),
        filters,
        &policy,
        &scan,
    );
    let entries = project_hits(snapshot, scan.hits, &context.relations)?;
    let index_path =
        super::super::load::display_index_path(root, directory, "investigation-index.json");
    Ok(ContentSearchResult::from_parts(
        index_path,
        entries,
        presentation,
    ))
}

impl ContentSearchResult {
    fn from_parts(
        index_path: String,
        entries: Vec<ContentEntry>,
        presentation: super::super::search_info::ContentPresentation<AppliedListFilters>,
    ) -> Self {
        Self {
            status: "ok",
            index_path,
            entries,
            errors: vec![],
            warnings: presentation.warnings,
            truncation: presentation.truncation,
            search_info: presentation.info,
        }
    }
}

// Map already selected current-text hits back to their validated index projections.
fn project_hits(
    snapshot: &QuerySnapshot<InvestigationState>,
    hits: Vec<super::super::content::Hit>,
    relations: &super::super::relation_filter::SearchRelations,
) -> Result<Vec<ContentEntry>, String> {
    let entries = hits
        .into_iter()
        .map(|hit| {
            let state = snapshot
                .get(&hit.id)
                .ok_or_else(|| format!("unmapped search hit: {}", hit.id))?;
            Ok(ContentEntry {
                formed_at: state.formed_at.clone(),
                id: hit.id.clone(),
                previews: hit.previews,
                question: state.question.clone(),
                source_path: state.source_path.clone(),
                tags: state.tags.clone(),
                title: state.title.clone(),
                filter_relations: relations
                    .evidence
                    .as_ref()
                    .and_then(|m| m.get(&hit.id).cloned()),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(entries)
}
