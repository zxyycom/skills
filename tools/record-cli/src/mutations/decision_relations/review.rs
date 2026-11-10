use super::*;

pub(super) fn resolve_groups(
    baseline: &crate::index::ValidatedIndex<domains::decision::DecisionState>,
    groups: &[RelationGroup<DecisionRelationKind>],
) -> Result<Vec<SourceReview<DecisionRelationKind>>, TxError> {
    let lookup = domains::SelectorIndex::new(&baseline.index().entries, |s| &s.name);
    let mut selected = HashSet::new();
    let mut resolved = Vec::new();
    for group in groups {
        let (source, state) = lookup
            .resolve(&group.source)
            .map_err(|e| fail("source-selector", format!("{e:?}")))?;
        if !selected.insert(source.to_owned()) {
            return Err(fail("duplicate-source", source));
        }
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
        let after = resolve_edges(&lookup, &group.relations)?;
        let action = if before == after {
            ReviewAction::Unchanged
        } else {
            ReviewAction::Replace
        };
        resolved.push(SourceReview {
            source_id: source.to_owned(),
            action,
            before,
            after,
        });
    }
    resolved.sort_by(|a, b| a.source_id.encode_utf16().cmp(b.source_id.encode_utf16()));
    Ok(resolved)
}

fn resolve_edges(
    lookup: &domains::SelectorIndex<'_, domains::decision::DecisionState>,
    edges: &[Relation<DecisionRelationKind>],
) -> Result<Vec<Relation<DecisionRelationKind>>, TxError> {
    let mut targets = HashSet::new();
    let mut after = Vec::new();
    for edge in edges {
        let target = resolved_target(lookup, edge)?;
        if !targets.insert(target.clone()) {
            return Err(fail("duplicate-target", target));
        }
        let summary = normalize_summary(edge.summary.as_deref())?;
        after.push(Relation {
            summary_selector: None,
            kind: edge.kind,
            target,
            summary,
        });
    }
    Ok(after)
}

fn resolved_target(
    lookup: &domains::SelectorIndex<'_, domains::decision::DecisionState>,
    edge: &Relation<DecisionRelationKind>,
) -> Result<String, TxError> {
    let (target, _) = lookup
        .resolve(&edge.target)
        .map_err(|e| fail("target-selector", format!("{e:?}")))?;
    if let Some(selector) = &edge.summary_selector {
        let (summary_target, _) = lookup
            .resolve(selector)
            .map_err(|e| fail("relation-summary", format!("{e:?}")))?;
        if summary_target != target {
            return Err(fail(
                "relation-summary",
                "summary target differs from relation target",
            ));
        }
    }
    Ok(target.to_owned())
}
