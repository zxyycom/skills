use super::*;

pub(super) struct Selection {
    pub selected: BTreeMap<String, Alignment>,
    pub discarded: Option<String>,
    pub group_map: BTreeMap<String, Vec<Relation<DecisionRelationKind>>>,
}

pub(super) fn resolve_selection(
    operation: &DecisionEvolutionOperation,
    lookup: &domains::SelectorIndex<'_, Located>,
    candidates: &BTreeSet<String>,
) -> Result<Selection, TxError> {
    let mut selected = BTreeMap::new();
    for s in &operation.successors {
        let id = resolve(lookup, &s.selector)?.to_owned();
        if selected.insert(id.clone(), s.alignment).is_some() {
            return Err(fail("duplicate-selection", id));
        }
        if operation.publish_only && !candidates.contains(&id) {
            return Err(fail("selection", "publish requires a candidate"));
        }
    }
    let discarded = operation
        .discard
        .as_ref()
        .map(|s| resolve(lookup, s).map(str::to_owned))
        .transpose()?;
    if discarded
        .as_ref()
        .is_some_and(|id| selected.contains_key(id))
    {
        return Err(fail("discard", "successor cannot also be discarded"));
    }
    let group_map = resolve_relation_groups(&operation.relations, lookup, &selected)?;
    Ok(Selection {
        selected,
        discarded,
        group_map,
    })
}

fn resolve_relation_groups(
    relations: &DecisionRelationOverride,
    lookup: &domains::SelectorIndex<'_, Located>,
    selected: &BTreeMap<String, Alignment>,
) -> Result<BTreeMap<String, Vec<Relation<DecisionRelationKind>>>, TxError> {
    let mut group_map = BTreeMap::new();
    match relations {
        DecisionRelationOverride::Preserve => {}
        DecisionRelationOverride::All(edges) => {
            if selected.len() != 1 {
                return Err(fail(
                    "relation-source",
                    "ungrouped relations require one successor",
                ));
            }
            group_map.insert(selected.keys().next().unwrap().clone(), edges.clone());
        }
        DecisionRelationOverride::Groups(groups) => {
            for group in groups {
                let id = resolve(lookup, &group.source)?.to_owned();
                if !selected.contains_key(&id)
                    || group_map.insert(id, group.relations.clone()).is_some()
                {
                    return Err(fail(
                        "relation-source",
                        "invalid or duplicate relation group",
                    ));
                }
            }
        }
    }
    Ok(group_map)
}
