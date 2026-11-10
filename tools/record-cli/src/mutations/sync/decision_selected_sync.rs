//! Selected Decision synchronization: only selected known locations and their
//! necessary graph dependencies are read. Unknown locations remain unchecked.
use crate::mutations::sync::selected_sync;
use crate::{
    domains::{
        self,
        decision::{DecisionState, Definition},
    },
    source::{Root, SourceSnapshot},
    source_revision::Domain,
    transaction::{Plan, TransactionOperation, TxError},
};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};

#[derive(Clone, Debug)]
struct Stage {
    index: SourceSnapshot,
    selected: Vec<String>,
    checked: Vec<String>,
    changed: Vec<String>,
    target: Vec<u8>,
    needs_write: bool,
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
pub struct SelectedSyncResult {
    pub command: &'static str,
    pub scope: &'static str,
    pub state: &'static str,
    pub changed: bool,
    pub changed_ids: Vec<String>,
    pub selected_ids: Vec<String>,
    pub selectors: Vec<String>,
    pub index_relative_path: String,
    pub unactivated_paths: Vec<String>,
    pub warnings: Vec<String>,
    pub coverage: Coverage,
}
pub struct PreparedSelected {
    stage: Stage,
    index_path: String,
    selectors: Vec<String>,
}
pub struct SelectedDecisionSyncOperation {
    pub directory: String,
    pub selectors: Vec<String>,
    observation: selected_sync::SelectionObservation,
}
pub(crate) fn related(
    entries: &BTreeMap<String, DecisionState>,
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
    // Reallocation is a connected bipartite event; expand only components
    // touched by an anchor, not every ordinary transitive graph neighbor.
    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
    for (source, target, kind) in &edges {
        if *kind == "重划" {
            adjacency.entry(source).or_default().push(target);
            adjacency.entry(target).or_default().push(source);
        }
    }
    let mut connected: HashSet<&str> = anchors.iter().map(String::as_str).collect();
    let mut queue: VecDeque<&str> = anchors.iter().map(String::as_str).collect();
    while let Some(id) = queue.pop_front() {
        if let Some(neighbors) = adjacency.get(id) {
            for &neighbor in neighbors {
                if connected.insert(neighbor) {
                    queue.push_back(neighbor);
                }
            }
        }
    }
    result.extend(connected.into_iter().map(str::to_owned));
    result
}
impl SelectedDecisionSyncOperation {
    pub fn new(directory: String, selectors: Vec<String>) -> Self {
        Self {
            directory,
            selectors,
            observation: Default::default(),
        }
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
    ) -> Result<selected_sync::SelectedBaseline<DecisionState>, TxError> {
        self.observation.begin();
        selected_sync::require_selection(&self.selectors, Domain::Decision)?;
        self.observation.baseline();
        let (dir, index_file, baseline) = selected_sync::acquire_baseline(
            root,
            &self.directory,
            "decision-index.json",
            &Definition,
            Domain::Decision,
        )?;
        self.observation.resolve();
        let selected = selected_sync::resolve_selection(
            &baseline.index().entries,
            &self.selectors,
            |state: &DecisionState| &state.name,
            Domain::Decision,
            "decision-index.json",
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
        let adapter = selected_sync::SourceAdapter {
            domain: Domain::Decision,
            path: |state: &DecisionState| &state.source_path,
            identity: domains::decision::id_from_markdown,
            parse: |bytes, id, path| {
                domains::decision::parse_established(bytes, id, path).map(|doc| doc.state)
            },
        };
        let sources = selected_sync::SourceScope {
            root,
            dir: &dir,
            baseline: baseline.index(),
            adapter: &adapter,
        };
        let selected_sync::SelectedFacts {
            updates,
            dependencies,
            ..
        } = sources
            .collect_facts(&selected, related)
            .map_err(|error| selected_sync::source_failure(error, Domain::Decision))?;
        let selected_sync::PreparedProjection {
            target,
            changed,
            checked,
        } = selected_sync::prepare_projection(&baseline, &Definition, updates, &dependencies)
            .map_err(|error| selected_sync::source_failure(error, Domain::Decision))?;
        let needs_write = !changed.is_empty();
        Ok(Stage {
            index: index_file,
            selected: selected.into_iter().collect(),
            checked,
            changed,
            target,
            needs_write,
        })
    }
    pub fn preflight(&self, root: &Root) -> Result<SelectedSyncResult, TxError> {
        let first = self.stage(root)?;
        Ok(sync_result(&first, &self.directory, &self.selectors, false))
    }
}
fn sync_result(
    stage: &Stage,
    directory: &str,
    selectors: &[String],
    committed: bool,
) -> SelectedSyncResult {
    SelectedSyncResult {
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
        index_relative_path: std::path::Path::new(directory)
            .join("decision-index.json")
            .to_string_lossy()
            .replace('\\', "/"),
        unactivated_paths: vec![],
        warnings: vec![],
        coverage: Coverage {
            source: "published-index+selected-current-sources",
            currentness: "selected-and-dependencies",
            checked_ids: stage.checked.clone(),
        },
    }
}
impl PreparedSelected {
    pub fn result(&self, committed: bool) -> SelectedSyncResult {
        sync_result(&self.stage, &self.index_path, &self.selectors, committed)
    }
}
impl TransactionOperation<PreparedSelected> for SelectedDecisionSyncOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSelected>, TxError> {
        let stage = self.stage(root)?;
        let index = stage.index.clone();
        let target = stage.target.clone();
        let needs_write = stage.needs_write;
        Ok(selected_sync::prepare_publication(
            index,
            &target,
            needs_write,
            PreparedSelected {
                stage,
                index_path: self.directory.clone(),
                selectors: self.selectors.clone(),
            },
        ))
    }
}

#[cfg(test)]
mod tests;
