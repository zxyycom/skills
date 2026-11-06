use super::*;

pub(super) fn resolve_groups(
    baseline: &crate::index::ValidatedIndex<domains::decision::DecisionState>,
    groups: &[RelationGroup<DecisionRelationKind>],
) -> Result<Vec<SourceReview<DecisionRelationKind>>, TxError> {
    let mut selected = HashSet::new();
    let mut resolved = Vec::new();
    for group in groups {
        let (source, state) =
            domains::resolve_selector(&baseline.index().entries, &group.source, |s| &s.name)
                .map_err(|e| fail("source-selector", format!("{e:?}")))?;
        if !selected.insert(source.to_owned()) {
            return Err(fail("duplicate-source", source));
        }
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
        let after = resolve_edges(baseline, &group.relations)?;
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
    baseline: &crate::index::ValidatedIndex<domains::decision::DecisionState>,
    edges: &[Relation<DecisionRelationKind>],
) -> Result<Vec<Relation<DecisionRelationKind>>, TxError> {
    let mut targets = HashSet::new();
    let mut after = Vec::new();
    for edge in edges {
        let (target, _) =
            domains::resolve_selector(&baseline.index().entries, &edge.target, |s| &s.name)
                .map_err(|e| fail("target-selector", format!("{e:?}")))?;
        if !targets.insert(target.to_owned()) {
            return Err(fail("duplicate-target", target));
        }
        let summary = match &edge.summary {
            Some(value) => {
                let text = value.js_trim();
                if text.contains(['\r', '\n']) || text.chars().count() > 40 {
                    return Err(fail(
                        "relation-summary",
                        "summary must be single-line and at most 40 code points",
                    ));
                }
                if text.is_empty() {
                    None
                } else {
                    Some(text.to_owned())
                }
            }
            None => None,
        };
        after.push(Relation {
            kind: edge.kind,
            target: target.to_owned(),
            summary,
        });
    }
    Ok(after)
}
