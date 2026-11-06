//! Validation of the persisted decision projection before graph construction.
use super::super::{name_from_id, path_name, sorted, valid_timestamp};
use super::{DecisionState, JsTrim, is_kebab};
use std::collections::HashSet;

pub(super) fn valid_state(id: &str, state: &DecisionState) -> bool {
    valid_identity(id, state)
        && valid_path_and_status(state)
        && valid_lifecycle(state)
        && valid_projection(state)
        && valid_relations(state)
}

fn valid_identity(id: &str, state: &DecisionState) -> bool {
    is_kebab(id) && state.name == name_from_id(id)
}

fn valid_path_and_status(state: &DecisionState) -> bool {
    let archived = state.source_path.starts_with("archive/");
    let path = state
        .source_path
        .strip_prefix("archive/")
        .unwrap_or(&state.source_path);
    path_name(path)
        && matches!(
            (state.status.as_str(), archived),
            ("active", false) | ("archived", true)
        )
}

fn valid_lifecycle(state: &DecisionState) -> bool {
    matches!(state.alignment.as_str(), "aligned" | "unaligned")
        && valid_timestamp(&state.created_at)
}

fn valid_projection(state: &DecisionState) -> bool {
    let valid_text = |value: &str| {
        let length = value.js_trim().chars().count();
        (4..=100).contains(&length) && !value.contains(['\r', '\n'])
    };
    [
        &state.title,
        &state.purpose,
        &state.background,
        &state.decision,
    ]
    .into_iter()
    .all(|value| valid_text(value))
        && !state.tags.is_empty()
        && state.tags.iter().all(|tag| is_kebab(tag))
        && sorted(&state.tags)
}

fn valid_relations(state: &DecisionState) -> bool {
    let mut targets = HashSet::new();
    state.relations.iter().all(|relation| {
        matches!(
            relation.relation_type.as_str(),
            "修订" | "替代" | "判定无效" | "归并" | "拆分" | "重划"
        ) && is_kebab(&relation.target)
            && targets.insert(&relation.target)
            && relation.summary.as_ref().is_none_or(|summary| {
                let summary = summary.js_trim();
                summary.chars().count() <= 40 && !summary.contains(['\r', '\n'])
            })
    })
}
