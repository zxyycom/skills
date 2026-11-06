use super::*;

#[derive(Serialize)]
pub struct Projection {
    pub title: String,
    pub purpose: String,
    pub background: String,
    pub decision: String,
    pub relations: Vec<Relation>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRecord {
    pub decision_id: String,
    pub source_path: String,
    pub projection: Projection,
    pub tags: Vec<String>,
    pub status: String,
    pub alignment: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_relations: Option<Vec<FilterRelation>>,
}
impl ListRecord {
    pub(super) fn project(
        id: &str,
        state: &DecisionState,
        filter_relations: Option<Vec<FilterRelation>>,
    ) -> Self {
        Self {
            decision_id: id.to_owned(),
            source_path: state.source_path.clone(),
            projection: Projection {
                title: state.title.clone(),
                purpose: state.purpose.clone(),
                background: state.background.clone(),
                decision: state.decision.clone(),
                relations: state.relations.clone(),
            },
            tags: state.tags.clone(),
            status: state.status.clone(),
            alignment: state.alignment.clone(),
            created_at: state.created_at.clone(),
            filter_relations,
        }
    }
}
#[derive(Serialize)]
pub struct StatusCounts {
    pub active: usize,
    pub archived: usize,
}
#[derive(Serialize)]
pub struct AlignmentCounts {
    pub aligned: usize,
    pub unaligned: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFacets {
    pub alignments: AlignmentCounts,
    pub created_at: TimeFacets,
    pub record_count: usize,
    pub statuses: StatusCounts,
    pub tags: Vec<TagFacet>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedListFilters {
    pub alignment: &'static str,
    pub status: &'static str,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at_from: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relation_type: Option<String>,
}
#[derive(Serialize)]
pub struct Source {
    pub kind: &'static str,
    pub currentness: &'static str,
    pub fallback: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResult {
    pub applied_filters: AppliedListFilters,
    pub command: &'static str,
    pub source: Source,
    pub facets: ListFacets,
    pub limit: u64,
    pub offset: u64,
    pub records: Vec<ListRecord>,
    pub status: &'static str,
    pub total: usize,
    pub warnings: Vec<String>,
}
/// Relationship filters use the lazy validated graph of this snapshot.
pub struct ListProjection<'a> {
    pub options: &'a ListOptions,
    pub status: StatusFilter,
    pub alignment: AlignmentFilter,
    pub created_from: Option<&'a str>,
    pub created_to: Option<&'a str>,
}
pub fn project_list(
    snapshot: &QuerySnapshot<DecisionState>,
    request: ListProjection<'_>,
) -> Result<ListResult, String> {
    let context = ListContext::new(snapshot, &request)?;
    let facets = facets::build(
        snapshot
            .all()
            .map(|(_, state)| (state.created_at.as_str(), state.tags.as_slice())),
    )?;
    let selection = context.select(snapshot)?;
    let total = selection.matches.len();
    let records = selection
        .matches
        .into_iter()
        .skip(usize::try_from(request.options.offset).unwrap_or(usize::MAX))
        .take(request.options.limit as usize)
        .map(|entry| {
            ListRecord::project(
                entry.id,
                entry.state,
                context
                    .relations
                    .as_ref()
                    .and_then(|map| map.get(entry.id).cloned()),
            )
        })
        .collect();
    Ok(ListResult {
        applied_filters: AppliedListFilters {
            alignment: context.alignment,
            status: context.status,
            tags: request.options.tags.clone(),
            created_at_from: request.created_from.map(str::to_owned),
            created_at_to: request.created_to.map(str::to_owned),
            related_to: request.options.relation.related_to.clone(),
            direction: request.options.relation.direction_name(),
            relation_type: request.options.relation.relation_type.clone(),
        },
        command: "list",
        source: Source {
            kind: "published-index",
            currentness: "unchecked",
            fallback: false,
        },
        facets: ListFacets {
            alignments: selection.alignments,
            created_at: facets.time,
            record_count: facets.record_count,
            statuses: selection.statuses,
            tags: facets.tags,
        },
        limit: request.options.limit,
        offset: request.options.offset,
        records,
        status: "ok",
        total,
        warnings: vec![],
    })
}

struct ListContext<'a> {
    options: &'a ListOptions,
    status: &'static str,
    alignment: &'static str,
    range: super::super::options::ListDateRange,
    relations: Option<std::collections::HashMap<String, Vec<FilterRelation>>>,
}
impl<'a> ListContext<'a> {
    fn new(
        snapshot: &QuerySnapshot<DecisionState>,
        request: &ListProjection<'a>,
    ) -> Result<Self, String> {
        let options = request.options;
        if !(1..=1000).contains(&options.limit) || options.offset > 9_007_199_254_740_991 {
            return Err("invalid list pagination".into());
        }
        if options.relation.direction.is_some() && options.relation.related_to.is_none() {
            return Err("direction requires relatedTo".into());
        }
        let range = super::super::options::ListDateRange::parse(
            request.created_from,
            request.created_to,
            "createdAt",
        )?;
        let status = request.status.as_str();
        let alignment = request.alignment.as_str();
        let relations = super::super::relation_filter::from_snapshot(
            snapshot,
            &crate::domains::decision::Definition,
            &options.relation,
            |state| &state.name,
        )?;
        Ok(Self {
            options,
            status,
            alignment,
            range,
            relations,
        })
    }
    fn select<'b>(
        &self,
        snapshot: &'b QuerySnapshot<DecisionState>,
    ) -> Result<ListSelection<'b>, String> {
        let mut selection = ListSelection {
            matches: Vec::new(),
            statuses: StatusCounts {
                active: 0,
                archived: 0,
            },
            alignments: AlignmentCounts {
                aligned: 0,
                unaligned: 0,
            },
        };
        for (id, state) in snapshot.all() {
            selection.observe_counts(state)?;
            if let Some(time) = self.match_time(id, state)? {
                selection.matches.push(ListMatch { id, state, time });
            }
        }
        selection
            .matches
            .sort_by(|a, b| b.time.cmp(&a.time).then_with(|| compare_text(a.id, b.id)));
        Ok(selection)
    }
    fn match_time(&self, id: &str, state: &DecisionState) -> Result<Option<i128>, String> {
        if self
            .relations
            .as_ref()
            .is_some_and(|map| !map.contains_key(id))
            || (self.status != "all" && state.status != self.status)
            || (self.alignment != "all" && state.alignment != self.alignment)
            || !self.options.tags.iter().all(|tag| state.tags.contains(tag))
        {
            return Ok(None);
        }
        let instant = super::super::options::parse_list_time(&state.created_at)?;
        if !self.range.contains(instant) {
            return Ok(None);
        }
        Ok(Some(instant))
    }
}
struct ListMatch<'a> {
    id: &'a str,
    state: &'a DecisionState,
    time: i128,
}
struct ListSelection<'a> {
    matches: Vec<ListMatch<'a>>,
    statuses: StatusCounts,
    alignments: AlignmentCounts,
}
impl ListSelection<'_> {
    fn observe_counts(&mut self, state: &DecisionState) -> Result<(), String> {
        match state.status.as_str() {
            "active" => self.statuses.active += 1,
            "archived" => self.statuses.archived += 1,
            _ => return Err("invalid published status".into()),
        }
        match state.alignment.as_str() {
            "aligned" => self.alignments.aligned += 1,
            "unaligned" => self.alignments.unaligned += 1,
            _ => return Err("invalid published alignment".into()),
        }
        Ok(())
    }
}
