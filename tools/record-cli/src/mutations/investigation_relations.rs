//! Rendering the source portion of an IR relation replacement. The caller
//! validates the complete proposed index and supplies selected source snapshots.
use super::contract::{InvestigationRelationKind, Relation, ReviewAction, SourceReview};
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceEdit {
    pub id: String,
    pub before: Vec<u8>,
    pub after: Vec<u8>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RenderError {
    MissingSource(String),
    CandidateNotAllowed(String),
    SourceInvalid { id: String, reason: String },
    SourceRelationsChanged(String),
    InconsistentReview(String),
}

fn domain_relation(relation: &Relation<InvestigationRelationKind>) -> crate::domains::Relation {
    let kind = match relation.kind {
        InvestigationRelationKind::Supplement => "补充",
        InvestigationRelationKind::Reexamination => "复查",
        InvestigationRelationKind::Correction => "修正",
        InvestigationRelationKind::Reversal => "推翻",
        InvestigationRelationKind::Merge => "归并",
        InvestigationRelationKind::Split => "拆分",
    };
    crate::domains::Relation {
        relation_type: kind.into(),
        target: relation.target.clone(),
        summary: relation.summary.clone(),
    }
}

/// A no-op is validated but never rendered, so it preserves exact source bytes.
/// No index change or transaction is implied by this intermediate result.
pub fn render_replacements(
    review: &[SourceReview<InvestigationRelationKind>],
    source_bytes: &HashMap<String, Vec<u8>>,
) -> Result<Vec<SourceEdit>, RenderError> {
    let mut edits = Vec::new();
    for item in review {
        if item.action == ReviewAction::Establish {
            return Err(RenderError::CandidateNotAllowed(item.source_id.clone()));
        }
        if (item.action == ReviewAction::Unchanged) != (item.before == item.after) {
            return Err(RenderError::InconsistentReview(item.source_id.clone()));
        }
        let bytes = source_bytes
            .get(&item.source_id)
            .ok_or_else(|| RenderError::MissingSource(item.source_id.clone()))?;
        let parsed = crate::domains::investigation::parse_frontmatter(bytes, &item.source_id)
            .map_err(|reason| RenderError::SourceInvalid {
                id: item.source_id.clone(),
                reason,
            })?;
        let before: Vec<_> = item.before.iter().map(domain_relation).collect();
        if parsed.relations != before {
            return Err(RenderError::SourceRelationsChanged(item.source_id.clone()));
        }
        if item.action == ReviewAction::Unchanged {
            continue;
        }
        let after: Vec<_> = item.after.iter().map(domain_relation).collect();
        let text = crate::domains::investigation::replace_relations(bytes, &item.source_id, &after)
            .map_err(|reason| RenderError::SourceInvalid {
                id: item.source_id.clone(),
                reason,
            })?;
        edits.push(SourceEdit {
            id: item.source_id.clone(),
            before: bytes.clone(),
            after: text.into_bytes(),
        });
    }
    Ok(edits)
}

mod transaction;
pub use transaction::capture_plan;
pub(super) use transaction::prepare_captured_plan;

#[cfg(test)]
mod tests;

pub struct PreparedReplacement {
    pub edits: Vec<SourceEdit>,
    pub index: crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    pub review: Vec<SourceReview<InvestigationRelationKind>>,
}

#[derive(Debug)]
pub enum PreparationError {
    MissingPublishedSource(String),
    DuplicateSource(String),
    InvalidUtf8(String),
    StaleSource(String),
    Render(RenderError),
    Projection(crate::mutations::sync::selected_sync::SelectedError<crate::index::IndexError>),
}

/// Prepares source bytes and the complete next index from a validated baseline.
/// The shared domain source-revision algorithm checks the selected bytes. The
/// caller retains responsibility for reading the baseline and selected sources
/// and for executing the resulting writes.
pub fn prepare_replacements(
    baseline: &crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    review: &[SourceReview<InvestigationRelationKind>],
    source_bytes: &HashMap<String, Vec<u8>>,
) -> Result<PreparedReplacement, PreparationError> {
    use crate::mutations::sync::selected_sync::build_validated_selected;
    validate_sources(baseline, review, source_bytes)?;
    let edits = render_replacements(review, source_bytes).map_err(PreparationError::Render)?;
    let updates = build_updates(baseline, review, &edits)?;
    let index = build_validated_selected(
        baseline,
        &crate::domains::investigation::Definition,
        &updates,
        &[],
    )
    .map_err(PreparationError::Projection)?
    .index;
    Ok(PreparedReplacement {
        edits,
        index,
        review: review.to_vec(),
    })
}

fn build_updates(
    baseline: &crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    review: &[SourceReview<InvestigationRelationKind>],
    edits: &[SourceEdit],
) -> Result<
    Vec<
        crate::mutations::sync::selected_sync::SelectedUpdate<
            crate::domains::investigation::InvestigationState,
        >,
    >,
    PreparationError,
> {
    use crate::mutations::sync::selected_sync::{Entry, SelectedUpdate};
    let edited: HashMap<_, _> = edits.iter().map(|edit| (edit.id.as_str(), edit)).collect();
    let mut updates = Vec::with_capacity(review.len());
    for item in review {
        let mut state = baseline.index().entries[&item.source_id].clone();
        state.relations = item.after.iter().map(domain_relation).collect();
        let revision = match edited.get(item.source_id.as_str()) {
            Some(edit) => {
                let text = std::str::from_utf8(&edit.after)
                    .map_err(|_| PreparationError::InvalidUtf8(item.source_id.clone()))?;
                crate::source_revision::fingerprint(
                    crate::source_revision::Domain::Investigation,
                    &item.source_id,
                    &state.source_path,
                    text,
                )
            }
            None => baseline.index().source_revision.entries[&item.source_id].clone(),
        };
        updates.push(SelectedUpdate {
            id: item.source_id.clone(),
            current: Some(Entry { state, revision }),
            located_from: None,
        });
    }
    Ok(updates)
}

fn validate_sources(
    baseline: &crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    review: &[SourceReview<InvestigationRelationKind>],
    source_bytes: &HashMap<String, Vec<u8>>,
) -> Result<(), PreparationError> {
    let mut ids = std::collections::HashSet::new();
    for item in review {
        if !ids.insert(item.source_id.as_str()) {
            return Err(PreparationError::DuplicateSource(item.source_id.clone()));
        }
        let state = baseline
            .index()
            .entries
            .get(&item.source_id)
            .ok_or_else(|| PreparationError::MissingPublishedSource(item.source_id.clone()))?;
        let bytes = source_bytes.get(&item.source_id).ok_or_else(|| {
            PreparationError::Render(RenderError::MissingSource(item.source_id.clone()))
        })?;
        let text = std::str::from_utf8(bytes)
            .map_err(|_| PreparationError::InvalidUtf8(item.source_id.clone()))?;
        if crate::source_revision::fingerprint(
            crate::source_revision::Domain::Investigation,
            &item.source_id,
            &state.source_path,
            text,
        ) != baseline.index().source_revision.entries[&item.source_id]
        {
            return Err(PreparationError::StaleSource(item.source_id.clone()));
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "investigation_relations/tests/preparation_tests.rs"]
mod preparation_tests;

#[cfg(test)]
#[path = "investigation_relations/tests/preparation_change_tests.rs"]
mod preparation_change_tests;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NormalizeError {
    DuplicateTarget(String),
    InvalidSummary(String),
}

/// Called after target selector resolution; duplicate aliases are rejected and
/// relations are normalized in the domain's canonical type/target order.
pub fn normalize_relations(
    relations: &[Relation<InvestigationRelationKind>],
) -> Result<Vec<Relation<InvestigationRelationKind>>, NormalizeError> {
    use crate::domains::JsTrim;
    use std::collections::HashSet;
    let mut seen = HashSet::new();
    let mut normalized = Vec::with_capacity(relations.len());
    for relation in relations {
        if !seen.insert(relation.target.as_str()) {
            return Err(NormalizeError::DuplicateTarget(relation.target.clone()));
        }
        let summary = match &relation.summary {
            Some(value) => {
                let trimmed = value.js_trim();
                if value.contains(['\r', '\n']) || trimmed.chars().count() > 40 {
                    return Err(NormalizeError::InvalidSummary(relation.target.clone()));
                }
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_owned())
                }
            }
            None => None,
        };
        normalized.push(Relation {
            kind: relation.kind,
            target: relation.target.clone(),
            summary,
        });
    }
    fn rank(kind: InvestigationRelationKind) -> u8 {
        match kind {
            InvestigationRelationKind::Supplement => 0,
            InvestigationRelationKind::Reexamination => 1,
            InvestigationRelationKind::Correction => 2,
            InvestigationRelationKind::Reversal => 3,
            InvestigationRelationKind::Merge => 4,
            InvestigationRelationKind::Split => 5,
        }
    }
    normalized.sort_by(|a, b| {
        rank(a.kind)
            .cmp(&rank(b.kind))
            .then_with(|| a.target.encode_utf16().cmp(b.target.encode_utf16()))
    });
    Ok(normalized)
}

#[cfg(test)]
#[path = "investigation_relations/tests/normalization_tests.rs"]
mod normalization_tests;
