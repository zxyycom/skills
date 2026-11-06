use super::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub alignment: &'static str,
    pub status: &'static str,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relation_type: Option<String>,
}
pub use super::super::metadata_match::RelationMatch;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataRecord {
    #[serde(flatten)]
    pub record: ListRecord,
    pub matched_fields: Vec<&'static str>,
    pub matched_relations: Vec<RelationMatch>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSearchResult {
    pub command: &'static str,
    #[serde(rename = "in")]
    pub scope: &'static str,
    pub status: &'static str,
    pub records: Vec<MetadataRecord>,
    pub warnings: Vec<String>,
    pub search_info: super::super::search_info::SearchInfo<SearchFilters>,
}
pub fn project_metadata(
    snapshot: &QuerySnapshot<DecisionState>,
    options: &SearchOptions,
    status: StatusFilter,
    alignment: AlignmentFilter,
) -> Result<MetadataSearchResult, String> {
    use super::super::search_info;
    if !(1..=1000).contains(&options.limit) {
        return Err("invalid search limit".into());
    }
    let context = super::search::SearchContext::new(snapshot, options, status, alignment)?;
    let MetadataMatches { records, matched } = collect_matches(snapshot, options, &context);
    let returned = records.len();
    let filters = context.filters(options);
    Ok(MetadataSearchResult {
        command: "search",
        scope: "metadata",
        status: "ok",
        records,
        warnings: if matched > returned {
            vec!["search results limited: max-records".into()]
        } else {
            vec![]
        },
        search_info: search_info::metadata(
            options.text.clone(),
            search_info::mode_name(options.mode),
            filters,
            options.limit,
            search_info::MetadataCounts { matched, returned },
        ),
    })
}

struct MetadataMatches {
    records: Vec<MetadataRecord>,
    matched: usize,
}
fn collect_matches(
    snapshot: &QuerySnapshot<DecisionState>,
    options: &SearchOptions,
    context: &super::search::SearchContext,
) -> MetadataMatches {
    let mut selected = snapshot.all().collect::<Vec<_>>();
    selected.sort_by(|(_, a), (_, b)| compare_text(&a.source_path, &b.source_path));
    let mut records = Vec::new();
    let mut matched = 0;
    for (id, s) in selected {
        if !context.matches(id, s, options) {
            continue;
        }
        let Some(matched_metadata) = match_record(id, s, &context.matcher) else {
            continue;
        };
        matched += 1;
        if records.len() >= options.limit as usize {
            continue;
        }
        records.push(project_match(id, s, context, matched_metadata));
    }
    MetadataMatches { records, matched }
}

fn project_match(
    id: &str,
    s: &DecisionState,
    context: &super::search::SearchContext,
    matched_metadata: super::super::metadata_match::MatchedMetadata<'_>,
) -> MetadataRecord {
    let evidence = matched_metadata.evidence(&[
        "id",
        "name",
        "title",
        "purpose",
        "background",
        "decision",
        "tags",
    ]);
    MetadataRecord {
        record: ListRecord::project(
            id,
            s,
            context
                .relations
                .evidence
                .as_ref()
                .and_then(|map| map.get(id).cloned()),
        ),
        matched_fields: evidence.fields,
        matched_relations: evidence.relations,
    }
}

fn match_record<'a>(
    id: &'a str,
    s: &'a DecisionState,
    matcher: &super::super::matcher::Matcher,
) -> Option<super::super::metadata_match::MatchedMetadata<'a>> {
    let segments = super::super::metadata_match::MetadataSegments::new(
        &[
            ("id", id),
            ("name", &s.name),
            ("title", &s.title),
            ("purpose", &s.purpose),
            ("background", &s.background),
            ("decision", &s.decision),
        ],
        &s.tags,
        &s.relations,
    );
    segments.find(matcher)
}
