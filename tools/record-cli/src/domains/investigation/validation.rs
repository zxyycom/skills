//! Validation of a persisted investigation projection and its relation ordering.
use super::super::{name_from_id, path_name, single_line, sorted, valid_timestamp};
use super::{InvestigationState, Relation, is_kebab, valid_resource_id};

const RELATION_TYPES: [&str; 6] = ["补充", "复查", "修正", "推翻", "归并", "拆分"];

pub(super) fn valid_state(id: &str, state: &InvestigationState) -> bool {
    valid_identity(id, state)
        && valid_description(state)
        && valid_resources(state)
        && valid_relations(&state.relations)
}

fn valid_identity(id: &str, state: &InvestigationState) -> bool {
    is_kebab(id)
        && state.name == name_from_id(id)
        && path_name(&state.source_path)
        && valid_timestamp(&state.formed_at)
}

fn valid_description(state: &InvestigationState) -> bool {
    single_line(&state.title)
        && single_line(&state.question)
        && !state.tags.is_empty()
        && state.tags.iter().all(|tag| is_kebab(tag))
        && sorted(&state.tags)
}

fn valid_resources(state: &InvestigationState) -> bool {
    sorted(&state.resource_ids) && state.resource_ids.iter().all(|id| valid_resource_id(id))
}

fn rank(relation: &Relation) -> Option<usize> {
    RELATION_TYPES
        .iter()
        .position(|kind| *kind == relation.relation_type)
}

fn valid_relations(relations: &[Relation]) -> bool {
    let sorted_relations =
        relations
            .windows(2)
            .all(|pair| match (rank(&pair[0]), rank(&pair[1])) {
                (Some(a), Some(b)) => {
                    a < b
                        || (a == b
                            && pair[0]
                                .target
                                .encode_utf16()
                                .cmp(pair[1].target.encode_utf16())
                                .is_lt())
                }
                _ => false,
            });
    sorted_relations
        && relations.iter().all(|relation| {
            rank(relation).is_some()
                && is_kebab(&relation.target)
                && relation.summary.as_ref().is_none_or(|summary| {
                    single_line(summary) && !summary.contains('\r') && summary.chars().count() <= 40
                })
        })
}
