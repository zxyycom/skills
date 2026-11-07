//! Selected Investigation synchronization: only selected known locations and their
//! necessary graph dependencies are read. Unknown locations remain unchecked.
use crate::mutations::sync::selected_sync;
use crate::{
    domains::{
        self,
        investigation::{Definition, InvestigationState},
    },
    source::{RelativePath, Root, SourceSnapshot},
    source_revision::Domain,
    transaction::TxError,
};
use std::collections::{BTreeMap, BTreeSet};

struct Stage {
    index: SourceSnapshot,
    selected: Vec<String>,
    checked: Vec<String>,
    changed: Vec<String>,
    target: Vec<u8>,
    needs_write: bool,
    report_count: usize,
}
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Coverage {
    pub source: &'static str,
    pub currentness: &'static str,
    pub checked_ids: Vec<String>,
}
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedInvestigationSyncResult {
    pub command: &'static str,
    pub scope: &'static str,
    pub state: &'static str,
    pub changed: bool,
    pub changed_ids: Vec<String>,
    pub selected_ids: Vec<String>,
    pub selectors: Vec<String>,
    pub index_path: String,
    pub unactivated_paths: Vec<String>,
    pub warnings: Vec<String>,
    pub report_count: usize,
    pub coverage: Coverage,
}
pub struct PreparedSelected {
    stage: Stage,
    index_path: String,
    selectors: Vec<String>,
}
pub struct SelectedInvestigationSyncOperation {
    pub directory: String,
    pub selectors: Vec<String>,
    observed_baseline_count: std::cell::Cell<Option<usize>>,
    observation: selected_sync::SelectionObservation,
}
fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}
pub(crate) fn related(
    entries: &BTreeMap<String, InvestigationState>,
    anchors: &BTreeSet<String>,
) -> BTreeSet<String> {
    let edges: Vec<_> = entries
        .iter()
        .flat_map(|(source, state)| {
            state
                .relations
                .iter()
                .map(move |r| (source.as_str(), r.target.as_str(), r.relation_type.as_str()))
        })
        .collect();
    let mut result = selected_sync::related_events(&edges, anchors);
    loop {
        let owners: Vec<String> = result
            .iter()
            .filter_map(|id| entries.get(id))
            .flat_map(|state| state.resource_ids.iter())
            .filter_map(|resource| resource.split_once('/').map(|(owner, _)| owner.to_owned()))
            .collect();
        let mut changed = false;
        for owner in owners {
            changed |= result.insert(owner);
        }
        if !changed {
            break;
        }
    }
    result
}
fn capture_resources(
    root: &Root,
    directory: &str,
    ids: &[String],
    removed: &[String],
) -> Result<(), TxError> {
    let exists = crate::resources::root_exists(root, directory)
        .map_err(|e| fail("resource-read", e.to_string()))?;
    let mut context = crate::resources::ResourceContext::open(root, directory, exists)
        .map_err(|e| fail("resource-read", e.to_string()))?;
    for owner in removed {
        context
            .require_owner_absent(owner)
            .map_err(|e| fail("resource-owner-present", e.to_string()))?;
    }
    let issues = context
        .direct_issues(ids)
        .map_err(|e| fail("resource-read", e.to_string()))?;
    if !issues.is_empty() {
        return Err(fail("resource-invalid", issues.join("; ")));
    }
    Ok(())
}
fn collect_selected_facts(
    root: &Root,
    dir: &RelativePath,
    baseline: &crate::index::IndexV4<InvestigationState>,
    selected: &BTreeSet<String>,
) -> Result<selected_sync::SelectedFacts<InvestigationState>, TxError> {
    let adapter = selected_sync::SourceAdapter {
        domain: Domain::Investigation,
        path: |state: &InvestigationState| &state.source_path,
        identity: domains::investigation::id_from_markdown,
        parse: |bytes, id, path| {
            domains::investigation::parse_established(bytes, id, path).map(|doc| doc.state)
        },
    };
    let sources = selected_sync::SourceScope {
        root,
        dir,
        baseline,
        adapter: &adapter,
    };
    sources
        .collect_facts(selected, related)
        .map_err(|error| selected_sync::source_failure(error, Domain::Investigation))
}

struct ResourceClosure {
    report_count: usize,
}
fn resource_closure(
    root: &Root,
    directory: &str,
    baseline: &crate::index::IndexV4<InvestigationState>,
    selected: &BTreeSet<String>,
    facts: &selected_sync::SelectedFacts<InvestigationState>,
) -> Result<ResourceClosure, TxError> {
    let mut resource_ids: Vec<String> = facts
        .dependencies
        .iter()
        .filter_map(|id| facts.combined.get(id))
        .flat_map(|state| state.resource_ids.iter().cloned())
        .collect();
    resource_ids.sort();
    resource_ids.dedup();
    let removed_owners: Vec<String> = selected
        .iter()
        .filter(|id| baseline.entries.contains_key(*id) && !facts.combined.contains_key(*id))
        .cloned()
        .collect();
    capture_resources(root, directory, &resource_ids, &removed_owners)?;
    Ok(ResourceClosure {
        report_count: facts.combined.len(),
    })
}

impl SelectedInvestigationSyncOperation {
    pub fn new(directory: String, selectors: Vec<String>) -> Self {
        Self {
            directory,
            selectors,
            observed_baseline_count: std::cell::Cell::new(None),
            observation: Default::default(),
        }
    }
    /// Count of entries in the most recently validated baseline, not a live collection count.
    pub fn observed_baseline_count(&self) -> Option<usize> {
        self.observed_baseline_count.get()
    }
    pub fn observed_failure_state(&self) -> &'static str {
        self.observation.phase.get()
    }
    pub fn observed_selected_ids(&self) -> Vec<String> {
        self.observation.selected_ids.borrow().clone()
    }
    fn selected_baseline(
        &self,
        root: &Root,
    ) -> Result<selected_sync::SelectedBaseline<InvestigationState>, TxError> {
        self.observed_baseline_count.set(None);
        self.observation.begin();
        selected_sync::require_selection(&self.selectors, Domain::Investigation)?;
        self.observation.baseline();
        let (dir, index_file, baseline) = selected_sync::acquire_baseline(
            root,
            &self.directory,
            "investigation-index.json",
            &Definition,
            Domain::Investigation,
        )?;
        self.observed_baseline_count
            .set(Some(baseline.index().entries.len()));
        self.observation.resolve();
        let selected = selected_sync::resolve_selection(
            &baseline.index().entries,
            &self.selectors,
            |state: &InvestigationState| &state.name,
            Domain::Investigation,
            "investigation-index.json",
        )?;
        Ok(selected_sync::SelectedBaseline {
            dir,
            index_file,
            baseline,
            selected,
        })
    }
    fn stage(&self, root: &Root) -> Result<Stage, TxError> {
        let selected_sync::SelectedBaseline {
            dir,
            index_file,
            baseline,
            selected,
        } = self.selected_baseline(root)?;
        self.observation.sources(&selected);
        let facts = collect_selected_facts(root, &dir, baseline.index(), &selected)?;
        let closure = resource_closure(root, &self.directory, baseline.index(), &selected, &facts)
            .map_err(|error| selected_sync::source_failure(error, Domain::Investigation))?;
        Stage::assemble(index_file, baseline, selected, facts, closure)
    }
    pub fn preflight(&self, root: &Root) -> Result<SelectedInvestigationSyncResult, TxError> {
        let first = self.stage(root)?;
        Ok(sync_result(&first, &self.directory, &self.selectors, false))
    }
}
impl Stage {
    fn assemble(
        index_file: crate::source::SourceSnapshot,
        baseline: crate::index::ValidatedIndex<InvestigationState>,
        selected: BTreeSet<String>,
        facts: selected_sync::SelectedFacts<InvestigationState>,
        closure: ResourceClosure,
    ) -> Result<Self, TxError> {
        let selected_sync::SelectedFacts {
            updates,
            dependencies,
            ..
        } = facts;
        let ResourceClosure { report_count } = closure;
        let selected_sync::PreparedProjection {
            target,
            changed,
            checked,
        } = selected_sync::prepare_projection(&baseline, &Definition, updates, &dependencies)
            .map_err(|error| selected_sync::source_failure(error, Domain::Investigation))?;
        let needs_write = !changed.is_empty();
        Ok(Self {
            index: index_file,
            selected: selected.into_iter().collect(),
            checked,
            changed,
            target,
            needs_write,
            report_count,
        })
    }
}

fn sync_result(
    stage: &Stage,
    directory: &str,
    selectors: &[String],
    committed: bool,
) -> SelectedInvestigationSyncResult {
    SelectedInvestigationSyncResult {
        command: "sync-index",
        scope: "selected",
        state: if stage.needs_write {
            if committed { "written" } else { "previewed" }
        } else {
            "unchanged"
        },
        changed: committed && stage.needs_write,
        changed_ids: stage.changed.clone(),
        selected_ids: stage.selected.clone(),
        selectors: selectors.to_vec(),
        index_path: std::path::Path::new(directory)
            .join("investigation-index.json")
            .to_string_lossy()
            .replace('\\', "/"),
        unactivated_paths: vec![],
        warnings: vec![],
        report_count: stage.report_count,
        coverage: Coverage {
            source: "published-index+selected-current-sources",
            currentness: "selected-and-dependencies",
            checked_ids: stage.checked.clone(),
        },
    }
}
impl PreparedSelected {
    pub fn result(&self, committed: bool) -> SelectedInvestigationSyncResult {
        sync_result(&self.stage, &self.index_path, &self.selectors, committed)
    }
}
mod transaction;

#[cfg(test)]
mod tests;
