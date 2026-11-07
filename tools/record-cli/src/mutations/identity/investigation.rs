//! Transactional investigation identity changes, bound to the published projection.
use super::super::{discard, rename};
use crate::{
    domains::{
        self,
        investigation::{self, Definition},
    },
    source::{self, ExpectedFile, RelativePath, Root},
    source_revision::{self, Domain},
    transaction::{CommitPoint, Plan, ResourceIntent, TransactionOperation, TxError, WriteIntent},
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
}
type OwnerTree = Vec<(RelativePath, bool)>;

use super::{fail, relative as rel, selector_name};
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
