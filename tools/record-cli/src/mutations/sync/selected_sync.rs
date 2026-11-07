//! Selected-domain sync projection on a trusted canonical baseline. The caller
//! owns source/dependency discovery and projection preparation.
mod baseline;
mod publication;
mod sources;
pub(super) use baseline::{
    acquire as acquire_baseline, require_selection, resolve as resolve_selection,
};

pub(super) use publication::prepare as prepare_publication;
pub(super) use sources::{SelectedFacts, SourceAdapter, SourceScope};

use std::collections::{BTreeMap, BTreeSet, HashSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry<S> {
    pub state: S,
    pub revision: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SelectedUpdate<S> {
    pub id: String,
    pub current: Option<Entry<S>>,
    /// For a new ID, the selected baseline ID at the same observed locator.
    pub located_from: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SelectedProjection<S> {
    pub entries: BTreeMap<String, Entry<S>>,
    pub changed_ids: Vec<String>,
    /// Selected IDs and all actually observed direct/event/owner dependencies.
    pub checked_ids: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SelectedError<E> {
    EmptySelection,
    DuplicateSelection(String),
    UnknownSelection(String),
    NewIdentityRequiresSelectedLocator(String),
    EmptyRevision(String),
    InvalidProjection(E),
}

/// Builds the full candidate index without reading or making claims about other
/// current sources. `validate` must prove the combined graph and owner rules;
/// metadata and its revision are deliberately not replaced by selected sync.
pub fn project_selected<S: Clone + PartialEq, V, E>(
    baseline: &BTreeMap<String, Entry<S>>,
    updates: &[SelectedUpdate<S>],
    checked_dependencies: &[String],
    validate: impl FnOnce(&BTreeMap<String, Entry<S>>) -> Result<V, E>,
) -> Result<(SelectedProjection<S>, V), SelectedError<E>> {
    if updates.is_empty() {
        return Err(SelectedError::EmptySelection);
    }
    let mut entries = baseline.clone();
    let mut selected = BTreeSet::new();
    let mut checked: BTreeSet<String> = checked_dependencies.iter().cloned().collect();
    let mut changed = Vec::new();
    for update in updates {
        if !selected.insert(update.id.clone()) {
            return Err(SelectedError::DuplicateSelection(update.id.clone()));
        }
        checked.insert(update.id.clone());
        let before = baseline.get(&update.id);
        validate_update(baseline, updates, update)?;
        if let Some(current) = &update.current {
            entries.insert(update.id.clone(), current.clone());
        } else {
            entries.remove(&update.id);
        }
        if before != update.current.as_ref() {
            changed.push(update.id.clone());
        }
    }
    let validated = validate(&entries).map_err(SelectedError::InvalidProjection)?;
    changed.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    let mut checked_ids: Vec<_> = checked.into_iter().collect();
    checked_ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    Ok((
        SelectedProjection {
            entries,
            changed_ids: changed,
            checked_ids,
        },
        validated,
    ))
}

fn validate_update<S, E>(
    baseline: &BTreeMap<String, Entry<S>>,
    updates: &[SelectedUpdate<S>],
    update: &SelectedUpdate<S>,
) -> Result<(), SelectedError<E>> {
    let before = baseline.get(&update.id);
    if before.is_none() && update.current.is_some() {
        let old = update.located_from.as_ref().filter(|old| {
            baseline.contains_key(*old)
                && updates
                    .iter()
                    .any(|other| &other.id == *old && other.current.is_none())
        });
        if old.is_none() {
            return Err(SelectedError::NewIdentityRequiresSelectedLocator(
                update.id.clone(),
            ));
        }
    }
    if before.is_none() && update.current.is_none() {
        return Err(SelectedError::UnknownSelection(update.id.clone()));
    }
    if let Some(current) = &update.current
        && current.revision.is_empty()
    {
        return Err(SelectedError::EmptyRevision(update.id.clone()));
    }
    Ok(())
}

/// Validate and serialize the combined baseline and selected updates before publication.
pub(super) struct PreparedProjection {
    pub target: Vec<u8>,
    pub changed: Vec<String>,
    pub checked: Vec<String>,
}
pub(super) fn prepare_projection<D: crate::index::DomainDefinition>(
    baseline: &crate::index::ValidatedIndex<D::State>,
    definition: &D,
    updates: BTreeMap<String, SelectedUpdate<D::State>>,
    dependencies: &BTreeSet<String>,
) -> Result<PreparedProjection, crate::transaction::TxError>
where
    D::State: Clone + PartialEq,
{
    let updates: Vec<_> = updates.into_values().collect();
    let dependency_ids: Vec<_> = dependencies.iter().cloned().collect();
    let projection = build_validated_selected(baseline, definition, &updates, &dependency_ids)
        .map_err(|e| crate::transaction::TxError::new("projection-invalid", format!("{e:?}")))?;
    let target = crate::index::serialize_index(&projection.index, definition)
        .map_err(|e| crate::transaction::TxError::new("index-serialize", e.to_string()))?;
    Ok(PreparedProjection {
        target,
        changed: projection.changed_ids,
        checked: projection.checked_ids,
    })
}

pub(super) struct SelectedBaseline<S> {
    pub dir: crate::source::RelativePath,
    pub index_file: crate::source::SourceSnapshot,
    pub baseline: crate::index::ValidatedIndex<S>,
    pub selected: BTreeSet<String>,
}

#[derive(Default)]
pub(super) struct SelectionObservation {
    pub(super) phase: std::cell::Cell<&'static str>,
    pub(super) selected_ids: std::cell::RefCell<Vec<String>>,
}
impl SelectionObservation {
    pub(super) fn begin(&self) {
        self.phase.set("selection-invalid");
        self.selected_ids.borrow_mut().clear();
    }
    pub(super) fn baseline(&self) {
        self.phase.set("selected-baseline-invalid");
    }
    pub(super) fn resolve(&self) {
        self.phase.set("selection-invalid");
    }
    pub(super) fn sources(&self, ids: &BTreeSet<String>) {
        self.phase.set("source-invalid");
        *self.selected_ids.borrow_mut() = ids.iter().cloned().collect();
    }
}

fn source_failure_with_reason(
    error: crate::transaction::TxError,
    domain: crate::source_revision::Domain,
    reason: String,
) -> crate::transaction::TxError {
    if !error.diagnostics.is_empty() {
        return error;
    }
    let (code, target, recovery) = match domain {
        crate::source_revision::Domain::Decision => (
            "decision-records.sync-index-failed",
            "decision-index.json",
            "Inspect the decision collection and derived index, then retry the command.",
        ),
        crate::source_revision::Domain::Investigation => (
            "investigation-report.selected-sync-invalid",
            "investigation-index.json",
            "correct the reported derived-index problem, then retry the synchronization",
        ),
    };
    error.with_diagnostics(vec![crate::protocol::Diagnostic {
        code: code.into(),
        message: reason.clone(),
        path: None,
        target: Some(target.into()),
        cause_category: None,
        operation: None,
        detail: None,
        reason: Some(reason),
        recovery: Some(recovery.into()),
    }])
}

pub(super) fn source_failure(
    error: crate::transaction::TxError,
    domain: crate::source_revision::Domain,
) -> crate::transaction::TxError {
    let reason = error.message.clone();
    source_failure_with_reason(error, domain, reason)
}

#[cfg(test)]
mod tests;

/// The projection remains a complete, domain-validated v4 index; selected
/// sources and the baseline are validated during preparation.
pub struct ValidatedSelectedProjection<S> {
    pub index: crate::index::ValidatedIndex<S>,
    pub changed_ids: Vec<String>,
    pub checked_ids: Vec<String>,
}

pub fn build_validated_selected<D>(
    baseline: &crate::index::ValidatedIndex<D::State>,
    domain: &D,
    updates: &[SelectedUpdate<D::State>],
    checked_dependencies: &[String],
) -> Result<ValidatedSelectedProjection<D::State>, SelectedError<crate::index::IndexError>>
where
    D: crate::index::DomainDefinition,
    D::State: Clone + PartialEq,
{
    let original = baseline.index();
    let entries = original
        .entries
        .iter()
        .map(|(id, state)| {
            (
                id.clone(),
                Entry {
                    state: state.clone(),
                    revision: original.source_revision.entries[id].clone(),
                },
            )
        })
        .collect();
    let (projected, index) =
        project_selected(&entries, updates, checked_dependencies, |combined| {
            validate_projection(original, domain, combined)
        })?;
    Ok(ValidatedSelectedProjection {
        index,
        changed_ids: projected.changed_ids,
        checked_ids: projected.checked_ids,
    })
}

fn validate_projection<D: crate::index::DomainDefinition>(
    original: &crate::index::IndexV4<D::State>,
    domain: &D,
    combined: &BTreeMap<String, Entry<D::State>>,
) -> Result<crate::index::ValidatedIndex<D::State>, crate::index::IndexError>
where
    D::State: Clone,
{
    let mut index = original.clone();
    index.entries = combined
        .iter()
        .map(|(id, item)| (id.clone(), item.state.clone()))
        .collect();
    index.source_revision.entries = combined
        .iter()
        .map(|(id, item)| (id.clone(), item.revision.clone()))
        .collect();
    let checked = crate::index::build_index(index, domain)?;
    let snapshot = crate::index::QuerySnapshot::new(checked);
    snapshot.graph(domain)?;
    let built = snapshot.index().clone();
    Ok(built)
}

#[cfg(test)]
#[path = "selected_sync/tests/domain_integration_tests.rs"]
mod domain_integration_tests;

/// Include all participants of split and merge events touched by the anchors.
pub(super) fn related_events(
    edges: &[(&str, &str, &str)],
    anchors: &BTreeSet<String>,
) -> BTreeSet<String> {
    let EventNeighborhood {
        mut result,
        splits,
        merges,
    } = touched_events(edges, anchors);
    for (source, target, kind) in edges {
        if (*kind == "拆分" && splits.contains(target))
            || (*kind == "归并" && merges.contains(source))
        {
            result.insert((*source).into());
            result.insert((*target).into());
        }
    }
    result
}

struct EventNeighborhood<'a> {
    result: BTreeSet<String>,
    splits: HashSet<&'a str>,
    merges: HashSet<&'a str>,
}
fn touched_events<'a>(
    edges: &[(&'a str, &'a str, &'a str)],
    anchors: &BTreeSet<String>,
) -> EventNeighborhood<'a> {
    let mut result = anchors.clone();
    let mut splits = HashSet::new();
    let mut merges = HashSet::new();
    for (source, target, kind) in edges {
        if anchors.contains(*source) || anchors.contains(*target) {
            result.insert((*source).into());
            result.insert((*target).into());
            if *kind == "拆分" {
                splits.insert(*target);
            }
            if *kind == "归并" {
                merges.insert(*source);
            }
        }
    }
    EventNeighborhood {
        result,
        splits,
        merges,
    }
}

/// Apply selected changes to a temporary baseline for dependency closure.
pub(super) fn combine_selected<S: Clone>(
    baseline: &BTreeMap<String, S>,
    updates: &BTreeMap<String, SelectedUpdate<S>>,
) -> BTreeMap<String, S> {
    let mut combined = baseline.clone();
    for update in updates.values() {
        if let Some(current) = &update.current {
            combined.insert(update.id.clone(), current.state.clone());
        } else {
            combined.remove(&update.id);
        }
    }
    combined
}
