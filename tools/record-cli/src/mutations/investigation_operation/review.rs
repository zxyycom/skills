use super::*;

pub(super) fn resolve_review(
    baseline: &crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    groups: &[RelationGroup<InvestigationRelationKind>],
) -> Result<Vec<SourceReview<InvestigationRelationKind>>, TxError> {
    let lookup = crate::domains::SelectorIndex::new(&baseline.index().entries, |s| &s.name);
    let mut selected = std::collections::HashSet::new();
    let mut review = Vec::new();
    for group in groups {
        let (source_id, state) = lookup
            .resolve(&group.source)
            .map_err(|e| failure("source-selector", format!("{e:?}")))?;
        if !selected.insert(source_id.to_owned()) {
            return Err(failure("duplicate-source", source_id));
        }
        let after = resolve_targets(&lookup, &group.relations)?;
        let before = state
            .relations
            .iter()
            .map(|edge| {
                Ok(Relation {
                    summary_selector: None,
                    kind: kind(&edge.relation_type)?,
                    target: edge.target.clone(),
                    summary: edge.summary.clone(),
                })
            })
            .collect::<Result<Vec<_>, TxError>>()?;
        let action = if before == after {
            ReviewAction::Unchanged
        } else {
            ReviewAction::Replace
        };
        review.push(SourceReview {
            source_id: source_id.to_owned(),
            action,
            before,
            after,
        });
    }
    review.sort_by(|a, b| a.source_id.encode_utf16().cmp(b.source_id.encode_utf16()));
    Ok(review)
}

fn resolve_targets(
    lookup: &crate::domains::SelectorIndex<'_, crate::domains::investigation::InvestigationState>,
    relations: &[Relation<InvestigationRelationKind>],
) -> Result<Vec<Relation<InvestigationRelationKind>>, TxError> {
    let mut after = Vec::with_capacity(relations.len());
    for relation in relations {
        let (target, _) = lookup
            .resolve(&relation.target)
            .map_err(|e| failure("target-selector", format!("{e:?}")))?;
        if let Some(selector) = &relation.summary_selector {
            let (summary_target, _) = lookup
                .resolve(selector)
                .map_err(|e| failure("relation-summary", format!("{e:?}")))?;
            if summary_target != target {
                return Err(failure(
                    "relation-summary",
                    "summary target differs from relation target",
                ));
            }
        }
        after.push(Relation {
            summary_selector: None,
            kind: relation.kind,
            target: target.to_owned(),
            summary: relation.summary.clone(),
        });
    }
    let after = investigation_relations::normalize_relations(&after)
        .map_err(|e| failure("relation-invalid", format!("{e:?}")))?;
    Ok(after)
}
