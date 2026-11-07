use super::*;

pub(super) struct Rendered {
    pub projection: crate::mutations::sync::selected_sync::ValidatedSelectedProjection<
        domains::decision::DecisionState,
    >,
    pub changed: HashMap<String, Vec<u8>>,
}
pub(super) fn project(
    baseline: &crate::index::ValidatedIndex<domains::decision::DecisionState>,
    resolved: &[SourceReview<DecisionRelationKind>],
    sources: &HashMap<String, Vec<u8>>,
) -> Result<Rendered, TxError> {
    let mut updates = Vec::new();
    let mut changed = HashMap::new();
    for item in resolved {
        let mut state = baseline.index().entries[&item.source_id].clone();
        state.relations = item.after.iter().map(domain_relation).collect();
        let revision = if item.action == ReviewAction::Replace {
            let (output, revision) = render_changed(item, &state, &sources[&item.source_id])?;
            changed.insert(item.source_id.clone(), output);
            revision
        } else {
            baseline.index().source_revision.entries[&item.source_id].clone()
        };
        updates.push(SelectedUpdate {
            id: item.source_id.clone(),
            current: Some(Entry { state, revision }),
            located_from: None,
        });
    }
    let projection =
        build_validated_selected(baseline, &domains::decision::Definition, &updates, &[])
            .map_err(|e| fail("graph-invalid", format!("{e:?}")))?;
    Ok(Rendered {
        projection,
        changed,
    })
}

fn render_changed(
    item: &SourceReview<DecisionRelationKind>,
    state: &domains::decision::DecisionState,
    source: &[u8],
) -> Result<(Vec<u8>, String), TxError> {
    let output = domains::decision::replace_metadata(
        source,
        &item.source_id,
        domains::decision::MetadataUpdate {
            status: &state.status,
            alignment: Some(&state.alignment),
            created_at: Some(&state.created_at),
            relations: Some(&state.relations),
        },
    )
    .map_err(|error| fail("source-render", error))?;
    let revision = fingerprint(
        Domain::Decision,
        &item.source_id,
        &state.source_path,
        &output,
    );
    Ok((output.into_bytes(), revision))
}
