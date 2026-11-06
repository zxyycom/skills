use super::*;

pub(super) fn resolve_review(
    baseline: &crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    groups: &[RelationGroup<InvestigationRelationKind>],
) -> Result<Vec<SourceReview<InvestigationRelationKind>>, TxError> {
    let entries = &baseline.index().entries;
    let mut selected = std::collections::HashSet::new();
    let mut review = Vec::new();
    for group in groups {
        let (source_id, state) =
            crate::domains::resolve_selector(entries, &group.source, |s| &s.name)
                .map_err(|e| failure("source-selector", format!("{e:?}")))?;
        if !selected.insert(source_id.to_owned()) {
            return Err(failure("duplicate-source", source_id));
        }
        let after = resolve_targets(entries, &group.relations)?;
        let before = state
            .relations
            .iter()
            .map(|edge| {
                Ok(Relation {
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
    entries: &std::collections::BTreeMap<String, crate::domains::investigation::InvestigationState>,
    relations: &[Relation<InvestigationRelationKind>],
) -> Result<Vec<Relation<InvestigationRelationKind>>, TxError> {
    let mut after = Vec::with_capacity(relations.len());
    for relation in relations {
        let (target, _) = crate::domains::resolve_selector(entries, &relation.target, |s| &s.name)
            .map_err(|e| failure("target-selector", format!("{e:?}")))?;
        after.push(Relation {
            kind: relation.kind,
            target: target.to_owned(),
            summary: relation.summary.clone(),
        });
    }
    let after = investigation_relations::normalize_relations(&after)
        .map_err(|e| failure("relation-invalid", format!("{e:?}")))?;
    Ok(after)
}
