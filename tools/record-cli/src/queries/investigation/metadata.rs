use super::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataEntry {
    pub formed_at: String,
    pub id: String,
    pub matched_fields: Vec<&'static str>,
    pub matched_relations: Vec<RelationMatch>,
    pub question: String,
    pub source_path: String,
    pub tags: Vec<String>,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_relations: Option<Vec<FilterRelation>>,
}
pub use super::super::metadata_match::RelationMatch;
pub use super::super::search_info::Truncation;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSearchResult {
    pub status: &'static str,
    pub index_path: String,
    pub entries: Vec<MetadataEntry>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub truncation: Truncation,
    pub search_info: super::super::search_info::SearchInfo<AppliedListFilters>,
}
/// Metadata is read only from the published snapshot; counts precede pagination.
pub fn project_metadata(
    snapshot: &QuerySnapshot<InvestigationState>,
    options: &SearchOptions,
    formed_from: Option<&str>,
    formed_to: Option<&str>,
    index_path: String,
) -> Result<MetadataSearchResult, String> {
    use super::super::search_info;
    let context = super::search::SearchContext::new(snapshot, options, formed_from, formed_to)?;
    let MetadataMatches { entries, matched } = collect_matches(snapshot, options, &context)?;
    let returned = entries.len();
    let filters = context.filters(options)?;
    Ok(MetadataSearchResult {
        status: "ok",
        index_path,
        entries,
        errors: vec![],
        warnings: if matched > returned {
            vec!["search results limited: max-records".into()]
        } else {
            vec![]
        },
        truncation: Truncation {
            files: matched > returned,
            matches: false,
            preview_characters: false,
        },
        search_info: search_info::metadata(
            context.text.clone(),
            search_info::mode_name(options.mode),
            filters,
            options.limit,
            search_info::MetadataCounts { matched, returned },
        ),
    })
}

struct MetadataMatches {
    entries: Vec<MetadataEntry>,
    matched: usize,
}
fn collect_matches(
    snapshot: &QuerySnapshot<InvestigationState>,
    options: &SearchOptions,
    context: &super::search::SearchContext,
) -> Result<MetadataMatches, String> {
    let mut selected = snapshot.all().collect::<Vec<_>>();
    selected.sort_by(|(_, a), (_, b)| compare_text(&a.source_path, &b.source_path));
    let mut entries = Vec::new();
    let mut matched = 0;
    for (id, s) in selected {
        if !context.matches(id, s, options)? {
            continue;
        }
        let Some(matched_metadata) = match_record(id, s, &context.matcher) else {
            continue;
        };
        matched += 1;
        if entries.len() >= options.limit as usize {
            continue;
        }
        entries.push(project_match(id, s, context, matched_metadata));
    }
    Ok(MetadataMatches { entries, matched })
}

fn project_match(
    id: &str,
    s: &InvestigationState,
    context: &super::search::SearchContext,
    matched_metadata: super::super::metadata_match::MatchedMetadata<'_>,
) -> MetadataEntry {
    let evidence = matched_metadata.evidence(&["id", "name", "title", "question", "tags"]);
    MetadataEntry {
        formed_at: s.formed_at.clone(),
        id: id.to_owned(),
        matched_fields: evidence.fields,
        matched_relations: evidence.relations,
        question: s.question.clone(),
        source_path: s.source_path.clone(),
        tags: s.tags.clone(),
        title: s.title.clone(),
        filter_relations: context
            .relations
            .evidence
            .as_ref()
            .and_then(|map| map.get(id).cloned()),
    }
}

fn match_record<'a>(
    id: &'a str,
    s: &'a InvestigationState,
    matcher: &super::super::matcher::Matcher,
) -> Option<super::super::metadata_match::MatchedMetadata<'a>> {
    let segments = super::super::metadata_match::MetadataSegments::new(
        &[
            ("id", id),
            ("name", &s.name),
            ("title", &s.title),
            ("question", &s.question),
        ],
        &s.tags,
        &s.relations,
    );
    segments.find(matcher)
}
