//! Shared selection and applied-filter contract for investigation searches.
use super::super::{matcher::Matcher, relation_filter};
use super::*;

pub(super) struct SearchContext {
    pub text: String,
    pub matcher: Matcher,
    pub relations: relation_filter::SearchRelations,
    from: Option<i128>,
    to: Option<i128>,
}
impl SearchContext {
    pub fn new(
        snapshot: &QuerySnapshot<InvestigationState>,
        options: &SearchOptions,
        formed_from: Option<&str>,
        formed_to: Option<&str>,
    ) -> Result<Self, String> {
        if !(1..=1000).contains(&options.limit) {
            return Err("invalid search limit".into());
        }
        if options.relation.direction.is_some() && options.relation.related_to.is_none() {
            return Err("direction requires relatedTo".into());
        }
        let text = options.text.trim().to_owned();
        let matcher = Matcher::new(&text, options.mode).map_err(str::to_owned)?;
        let from = formed_from.map(parse_time).transpose()?;
        let to = formed_to.map(parse_time).transpose()?;
        if from.zip(to).is_some_and(|(a, b)| a > b) {
            return Err("formedAt lower bound must not be after upper bound".into());
        }
        let relations = relation_filter::for_search(
            snapshot,
            &crate::domains::investigation::Definition,
            &options.relation,
            |s| &s.name,
        )?;
        Ok(Self {
            text,
            matcher,
            relations,
            from,
            to,
        })
    }

    pub fn matches(
        &self,
        id: &str,
        state: &InvestigationState,
        options: &SearchOptions,
    ) -> Result<bool, String> {
        if self
            .relations
            .evidence
            .as_ref()
            .is_some_and(|map| !map.contains_key(id))
            || !options.tags.iter().all(|tag| state.tags.contains(tag))
        {
            return Ok(false);
        }
        let time = parse_time(&state.formed_at)?;
        Ok(!self.from.is_some_and(|v| time < v) && !self.to.is_some_and(|v| time > v))
    }

    // Select only indexed source paths; scanning is a separate bounded IO phase.
    pub fn selected_sources<'b>(
        &self,
        snapshot: &'b QuerySnapshot<InvestigationState>,
        options: &SearchOptions,
    ) -> Result<Vec<(&'b str, &'b str)>, String> {
        let mut selected = Vec::new();
        for (id, state) in snapshot.all() {
            if self.matches(id, state, options)? {
                selected.push((id, state.source_path.as_str()));
            }
        }
        Ok(selected)
    }
    pub fn filters(&self, options: &SearchOptions) -> Result<AppliedListFilters, String> {
        let direction = options.relation.direction_name();
        Ok(AppliedListFilters {
            tags: options.tags.clone(),
            direction,
            related_to: self.relations.anchor.clone(),
            relation_type: options.relation.relation_type.clone(),
            formed_at_from: self.from.map(canonical_time).transpose()?,
            formed_at_to: self.to.map(canonical_time).transpose()?,
        })
    }
}
fn parse_time(value: &str) -> Result<i128, String> {
    OffsetDateTime::parse(value, &Rfc3339)
        .map(|v| v.unix_timestamp_nanos().div_euclid(1_000_000))
        .map_err(|e| e.to_string())
}
fn canonical_time(value: i128) -> Result<String, String> {
    let v =
        OffsetDateTime::from_unix_timestamp_nanos(value * 1_000_000).map_err(|e| e.to_string())?;
    Ok(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        v.year(),
        v.month() as u8,
        v.day(),
        v.hour(),
        v.minute(),
        v.second(),
        v.millisecond()
    ))
}
