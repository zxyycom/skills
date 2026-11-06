use super::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFacets {
    pub formed_at: TimeFacets,
    pub record_count: usize,
    pub tags: Vec<TagFacet>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntry {
    pub id: String,
    pub state: InvestigationState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_relations: Option<Vec<FilterRelation>>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedListFilters {
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relation_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formed_at_from: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formed_at_to: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResult {
    pub applied_filters: AppliedListFilters,
    pub entries: Vec<ListEntry>,
    pub facets: ListFacets,
    pub index_path: String,
    pub limit: u64,
    pub offset: u64,
    pub total: usize,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}
/// Project one verified published snapshot; relationship filters use its lazy validated graph.
pub fn project_list(
    snapshot: &QuerySnapshot<InvestigationState>,
    options: &ListOptions,
    formed_from: Option<&str>,
    formed_to: Option<&str>,
    index_path: String,
) -> Result<ListResult, String> {
    let context = ListContext::new(snapshot, options, formed_from, formed_to)?;
    let facets = facets::build(
        snapshot
            .all()
            .map(|(_, state)| (state.formed_at.as_str(), state.tags.as_slice())),
    )?;
    let Page { entries, total } = context.page(snapshot)?;
    Ok(ListResult {
        applied_filters: AppliedListFilters {
            tags: options.tags.clone(),
            direction: options.relation.direction_name(),
            related_to: options.relation.related_to.clone(),
            relation_type: options.relation.relation_type.clone(),
            formed_at_from: formed_from.map(str::to_owned),
            formed_at_to: formed_to.map(str::to_owned),
        },
        entries,
        facets: ListFacets {
            formed_at: facets.time,
            record_count: facets.record_count,
            tags: facets.tags,
        },
        index_path,
        limit: options.limit,
        offset: options.offset,
        total,
        errors: vec![],
        warnings: vec![],
    })
}

struct Page {
    entries: Vec<ListEntry>,
    total: usize,
}
struct ListContext<'a> {
    options: &'a ListOptions,
    range: super::super::options::ListDateRange,
    relations: Option<std::collections::HashMap<String, Vec<FilterRelation>>>,
}
impl<'a> ListContext<'a> {
    fn new(
        snapshot: &QuerySnapshot<InvestigationState>,
        options: &'a ListOptions,
        formed_from: Option<&str>,
        formed_to: Option<&str>,
    ) -> Result<Self, String> {
        if !(1..=1000).contains(&options.limit) || options.offset > 9_007_199_254_740_991 {
            return Err("invalid list pagination".into());
        }
        if options.relation.direction.is_some() && options.relation.related_to.is_none() {
            return Err("direction requires relatedTo".into());
        }
        let range =
            super::super::options::ListDateRange::parse(formed_from, formed_to, "formedAt")?;
        let relations = super::super::relation_filter::from_snapshot(
            snapshot,
            &crate::domains::investigation::Definition,
            &options.relation,
            |state| &state.name,
        )?;
        Ok(Self {
            options,
            range,
            relations,
        })
    }
    // Ordering and pagination happen after the full filtered count is known.
    fn page(&self, snapshot: &QuerySnapshot<InvestigationState>) -> Result<Page, String> {
        let mut matching = self.select(snapshot)?;
        matching.sort_by(|a, b| b.time.cmp(&a.time).then_with(|| compare_text(a.id, b.id)));
        let total = matching.len();
        let entries = matching
            .into_iter()
            .skip(usize::try_from(self.options.offset).unwrap_or(usize::MAX))
            .take(self.options.limit as usize)
            .map(|entry| ListEntry {
                id: entry.id.to_owned(),
                state: entry.state.clone(),
                filter_relations: self
                    .relations
                    .as_ref()
                    .and_then(|map| map.get(entry.id).cloned()),
            })
            .collect();
        Ok(Page { entries, total })
    }
    fn select<'b>(
        &self,
        snapshot: &'b QuerySnapshot<InvestigationState>,
    ) -> Result<Vec<ListMatch<'b>>, String> {
        let mut matches = Vec::new();
        for (id, state) in snapshot.all() {
            if self
                .relations
                .as_ref()
                .is_some_and(|map| !map.contains_key(id))
                || !self.options.tags.iter().all(|tag| state.tags.contains(tag))
            {
                continue;
            }
            let time = super::super::options::parse_list_time(&state.formed_at)?;
            if !self.range.contains(time) {
                continue;
            }
            matches.push(ListMatch { id, state, time });
        }
        Ok(matches)
    }
}
struct ListMatch<'a> {
    id: &'a str,
    state: &'a InvestigationState,
    time: i128,
}
