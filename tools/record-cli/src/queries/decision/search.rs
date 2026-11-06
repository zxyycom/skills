//! Shared decision metadata/content search selection and filter projection.
use super::super::{matcher::Matcher, relation_filter};
use super::*;

pub(super) struct SearchContext {
    pub matcher: Matcher,
    pub relations: relation_filter::SearchRelations,
    status: &'static str,
    alignment: &'static str,
}
impl SearchContext {
    pub fn new(
        snapshot: &QuerySnapshot<DecisionState>,
        options: &SearchOptions,
        status: StatusFilter,
        alignment: AlignmentFilter,
    ) -> Result<Self, String> {
        if options.relation.direction.is_some() && options.relation.related_to.is_none() {
            return Err("direction requires relatedTo".into());
        }
        let matcher = Matcher::new(&options.text, options.mode).map_err(str::to_owned)?;
        let status = status.as_str();
        let alignment = alignment.as_str();
        let relations = relation_filter::for_search(
            snapshot,
            &crate::domains::decision::Definition,
            &options.relation,
            |s| &s.name,
        )?;
        Ok(Self {
            matcher,
            relations,
            status,
            alignment,
        })
    }
    pub fn matches(&self, id: &str, state: &DecisionState, options: &SearchOptions) -> bool {
        !self
            .relations
            .evidence
            .as_ref()
            .is_some_and(|r| !r.contains_key(id))
            && (self.status == "all" || state.status == self.status)
            && (self.alignment == "all" || state.alignment == self.alignment)
            && options.tags.iter().all(|tag| state.tags.contains(tag))
    }
    // Select only indexed source paths; scanning is a separate bounded IO phase.
    pub fn selected_sources<'b>(
        &self,
        snapshot: &'b QuerySnapshot<DecisionState>,
        options: &SearchOptions,
    ) -> Vec<(&'b str, &'b str)> {
        snapshot
            .all()
            .filter(|(id, state)| self.matches(id, state, options))
            .map(|(id, state)| (id, state.source_path.as_str()))
            .collect()
    }
    pub fn filters(&self, options: &SearchOptions) -> SearchFilters {
        let direction = options.relation.direction_name();
        SearchFilters {
            alignment: self.alignment,
            status: self.status,
            tags: options.tags.clone(),
            related_to: self.relations.anchor.clone(),
            direction,
            relation_type: options.relation.relation_type.clone(),
        }
    }
}
