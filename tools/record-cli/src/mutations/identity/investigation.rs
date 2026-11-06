//! Transactional investigation identity changes, bound to the published projection.
use super::super::{discard, rename};
use crate::{
    domains::{
        self,
        investigation::{self, Definition},
    },
    source::{self, ExpectedFile, RelativePath, Root},
    source_revision::{self, Domain},
    transaction::{
        CommitPoint, Guard, Plan, ResourceIntent, TransactionOperation, TxError, WriteIntent,
        WriteMode,
    },
};
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    Rename {
        target: String,
        confirm_recorded_report: bool,
        confirm_recorded_candidate: bool,
    },
    Discard {
        confirm_recorded: bool,
        delete_owned_resources: bool,
    },
}
pub struct InvestigationIdentityOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    pub selector: String,
    pub action: Action,
}
pub struct PreparedIdentity {
    pub old_id: String,
    pub new_id: Option<String>,
    pub old_path: String,
    pub new_path: Option<String>,
    pub candidate: bool,
    pub affected_ids: Vec<String>,
    pub affected_relation_count: usize,
    pub impact: super::RewriteImpact,
    pub owner_moved: bool,
    pub deleted_resource_ids: Vec<String>,
    pub no_change: bool,
    evidence: Evidence,
}
type OwnerTree = Vec<(RelativePath, source::FileIdentity, Option<Vec<u8>>)>;

struct Evidence {
    listing: source::DirectorySnapshot,
    headers: Vec<source::HeaderSnapshot>,
    history: Option<(Option<String>, bool)>,
    resources: Option<crate::resources::ResourceEvidence>,
    tree: OwnerTree,
}
impl std::fmt::Debug for PreparedIdentity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PreparedIdentity")
            .field("old_id", &self.old_id)
            .field("new_id", &self.new_id)
            .field("old_path", &self.old_path)
            .field("new_path", &self.new_path)
            .field("candidate", &self.candidate)
            .field("affected_ids", &self.affected_ids)
            .field("affected_relation_count", &self.affected_relation_count)
            .field("owner_moved", &self.owner_moved)
            .field("no_change", &self.no_change)
            .finish()
    }
}
impl Evidence {
    fn equivalent(&self, other: &Self) -> bool {
        self.listing == other.listing
            && self.headers == other.headers
            && self.history == other.history
            && self.tree == other.tree
            && match (&self.resources, &other.resources) {
                (None, None) => true,
                (Some(a), Some(b)) => a.equivalent(b),
                _ => false,
            }
    }
}
use super::{fail, mode, relative as rel, selector_name};
mod change;
mod discovery;
mod history;
mod owner;
mod references;
mod selection;
mod target;
use history::history;

mod phase;
mod verification;

#[cfg(test)]
mod tests;
