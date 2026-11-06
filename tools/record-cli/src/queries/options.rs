//! Typed query requests produced by each domain's CLI boundary.
use super::matcher::MatchMode;
use super::trace::RequestedDirection;

#[derive(Clone, Debug)]
pub struct RelationFilter {
    pub related_to: Option<String>,
    /// `None` distinguishes an omitted direction from an explicit value.
    pub direction: Option<RequestedDirection>,
    pub relation_type: Option<String>,
}
impl RelationFilter {
    /// Direction is only present in output when a related-to anchor was supplied.
    pub(crate) fn direction_name(&self) -> Option<&'static str> {
        self.related_to.as_ref().map(
            |_| match self.direction.unwrap_or(RequestedDirection::Both) {
                RequestedDirection::Both => "both",
                RequestedDirection::Predecessors => "predecessors",
                RequestedDirection::Successors => "successors",
            },
        )
    }
}
#[derive(Clone, Debug)]
pub struct TraceOptions {
    pub selector: String,
    pub direction: RequestedDirection,
    /// None represents `all`.
    pub depth: Option<u64>,
    pub max_records: u64,
}
impl TraceOptions {
    pub(crate) fn selection_limits(&self) -> Result<super::trace::SelectionLimits, String> {
        if self.max_records == 0
            || self.max_records > 9_007_199_254_740_991
            || self.depth.is_some_and(|n| n > 9_007_199_254_740_991)
        {
            return Err("invalid trace budget".into());
        }
        Ok(super::trace::SelectionLimits {
            depth: self.depth.map(|n| usize::try_from(n).unwrap_or(usize::MAX)),
            max_records: usize::try_from(self.max_records).unwrap_or(usize::MAX),
        })
    }
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SearchScope {
    Content,
    Metadata,
}
#[derive(Clone, Debug)]
pub struct SearchOptions {
    pub text: String,
    pub scope: SearchScope,
    pub mode: MatchMode,
    pub tags: Vec<String>,
    pub relation: RelationFilter,
    pub limit: u64,
}
#[derive(Clone, Debug)]
pub struct ListOptions {
    pub tags: Vec<String>,
    pub relation: RelationFilter,
    pub limit: u64,
    pub offset: u64,
    pub detail: bool,
}

/// List range timestamps use the same millisecond precision and diagnostics in both domains.
pub(crate) fn parse_list_time(value: &str) -> Result<i128, String> {
    time::OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339)
        .map(|v| v.unix_timestamp_nanos().div_euclid(1_000_000))
        .map_err(|e| format!("invalid timestamp {value}: {e}"))
}

/// Parsed inclusive bounds; the constructor rejects inverted list intervals.
pub(crate) struct ListDateRange {
    from: Option<i128>,
    to: Option<i128>,
}
impl ListDateRange {
    pub fn parse(from: Option<&str>, to: Option<&str>, field: &str) -> Result<Self, String> {
        let from = from.map(parse_list_time).transpose()?;
        let to = to.map(parse_list_time).transpose()?;
        if from.zip(to).is_some_and(|(a, b)| a > b) {
            return Err(format!("{field} lower bound must not be after upper bound"));
        }
        Ok(Self { from, to })
    }
    pub fn contains(&self, value: i128) -> bool {
        !self.from.is_some_and(|bound| value < bound) && !self.to.is_some_and(|bound| value > bound)
    }
}
