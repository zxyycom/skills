//! Decision identity operations over a validated index and selected sources.
use super::super::{discard, rename};
use crate::{
    domains::{
        self,
        decision::{self, Definition},
    },
    source::{self, ExpectedFile, RelativePath, Root},
    source_revision::{self, Domain},
    transaction::{
        CommitPoint, Guard, Plan, TransactionOperation, TxError, WriteIntent, WriteMode,
    },
};
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    Rename {
        target: String,
        confirm_recorded: bool,
    },
    Discard {
        confirm_recorded: bool,
    },
}
pub struct DecisionIdentityOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    pub selector: String,
    pub action: Action,
}
#[derive(Debug)]
pub struct PreparedIdentity {
    pub old_id: String,
    pub new_id: Option<String>,
    pub old_path: String,
    pub new_path: Option<String>,
    pub candidate: bool,
    pub affected_ids: Vec<String>,
    pub affected_relation_count: usize,
    pub impact: super::RewriteImpact,
    pub no_change: bool,
    evidence: Evidence,
}
#[derive(Debug, PartialEq, Eq)]
struct Evidence {
    listing: source::DirectorySnapshot,
    archive: Option<source::DirectorySnapshot>,
    headers: Vec<source::HeaderSnapshot>,
    history: Option<(Option<String>, bool)>,
    pending: Option<pending::Observation>,
}
impl Evidence {
    fn equivalent(&self, other: &Self) -> bool {
        super::super::same_directory(&self.listing, &other.listing)
            && super::super::same_optional_directory(&self.archive, &other.archive)
            && super::super::same_headers(&self.headers, &other.headers)
            && self.history == other.history
            && self.pending == other.pending
    }
}

use super::{fail, mode, relative};
mod change;
mod discovery;
mod history;
mod references;
mod selection;
mod target;
pub(crate) use history::history;

mod pending;
mod phase;
mod verification;

#[cfg(test)]
mod tests;
