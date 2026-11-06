use super::*;

pub(super) struct Dependencies<'a> {
    pub root: &'a Root,
    pub collection: &'a RelativePath,
    pub baseline: &'a index::ValidatedIndex<decision::DecisionState>,
    pub final_index: &'a index::ValidatedIndex<decision::DecisionState>,
    pub selected: &'a BTreeMap<String, Alignment>,
    pub target_ids: &'a BTreeSet<String>,
    pub discarded: &'a Option<String>,
    pub archive_ids: &'a [String],
}
impl Dependencies<'_> {
    pub fn capture(self) -> Result<Vec<Guard>, TxError> {
        let Self {
            root,
            collection,
            baseline,
            final_index,
            selected,
            target_ids,
            discarded,
            archive_ids,
        } = self;
        let mut guards = Vec::new();
        let deps = related_ids(baseline, final_index, selected, target_ids, discarded);
        for id in deps {
            if selected.contains_key(&id)
                || archive_ids.contains(&id)
                || discarded.as_ref() == Some(&id)
            {
                continue;
            }
            if let Some(state) = baseline.index().entries.get(&id) {
                let before = validate_source(
                    root,
                    collection,
                    &id,
                    state,
                    &baseline.index().source_revision.entries[&id],
                )?;
                guards.push(Guard {
                    path: path(collection, &state.source_path)?,
                    before,
                });
            }
        }
        Ok(guards)
    }
}

fn related_ids(
    baseline: &index::ValidatedIndex<decision::DecisionState>,
    final_index: &index::ValidatedIndex<decision::DecisionState>,
    selected: &BTreeMap<String, Alignment>,
    target_ids: &BTreeSet<String>,
    discarded: &Option<String>,
) -> BTreeSet<String> {
    let anchors: BTreeSet<_> = selected
        .keys()
        .cloned()
        .chain(target_ids.iter().cloned())
        .chain(discarded.clone())
        .collect();
    let mut deps = decision_selected_sync::related(&baseline.index().entries, &anchors);
    deps.extend(decision_selected_sync::related(
        &final_index.index().entries,
        &anchors,
    ));
    deps
}
