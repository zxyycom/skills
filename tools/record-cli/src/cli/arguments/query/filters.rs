use super::arguments::validate_filters;
use super::*;

pub(super) struct QueryFilters {
    pub tags: Vec<String>,
    pub relation: RelationFilter,
    pub direction: Option<RequestedDirection>,
    pub status: StatusFilter,
    pub alignment: AlignmentFilter,
}

pub(super) fn parse_filters(
    domain: Domain,
    command: &str,
    values: &HashMap<String, Vec<String>>,
) -> Result<QueryFilters, ArgumentError> {
    let get = |key: &str| values.get(key).and_then(|v| v.first()).cloned();
    let tags = validate_filters(domain, values)?;
    let related_to = get("related-to");
    let direction = get("direction").map(|v| get_direction(&v)).transpose()?;
    if command != "trace" && direction.is_some() && related_to.is_none() {
        return Err(ArgumentError("--direction requires --related-to".into()));
    }
    let relation = RelationFilter {
        related_to,
        direction,
        relation_type: get("relation-type"),
    };
    let status = parse_status(get("status").as_deref().unwrap_or("active"))?;
    let alignment = parse_alignment(get("alignment").as_deref().unwrap_or("all"))?;
    Ok(QueryFilters {
        tags,
        relation,
        direction,
        status,
        alignment,
    })
}

fn get_direction(value: &str) -> Result<RequestedDirection, ArgumentError> {
    match value {
        "both" => Ok(RequestedDirection::Both),
        "predecessors" => Ok(RequestedDirection::Predecessors),
        "successors" => Ok(RequestedDirection::Successors),
        _ => Err(ArgumentError("invalid direction".into())),
    }
}

fn parse_status(value: &str) -> Result<StatusFilter, ArgumentError> {
    match value {
        "active" => Ok(StatusFilter::Active),
        "archived" => Ok(StatusFilter::Archived),
        "all" => Ok(StatusFilter::All),
        _ => Err(ArgumentError("invalid --status".into())),
    }
}

fn parse_alignment(value: &str) -> Result<AlignmentFilter, ArgumentError> {
    match value {
        "aligned" => Ok(AlignmentFilter::Aligned),
        "unaligned" => Ok(AlignmentFilter::Unaligned),
        "all" => Ok(AlignmentFilter::All),
        _ => Err(ArgumentError("invalid --alignment".into())),
    }
}
