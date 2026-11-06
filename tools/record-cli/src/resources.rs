//! Shared phase-local resource visibility and direct-reference checks.
use crate::{
    domains,
    protocol::CommandError,
    source::{self, MemberKind, RelativePath, Root},
};
use std::collections::{HashMap, HashSet};

/// Inspect only explicit resource references; payload bytes and ignored siblings
/// are never loaded. Returned issues describe observed missing/ignored members.
pub fn referenced_resource_issues(
    root: &Root,
    directory: &str,
    ids: &[String],
    resources_exist: bool,
) -> Result<Vec<String>, CommandError> {
    ResourceContext::open(root, directory, resources_exist)?.direct_issues(ids)
}

fn copy_directory_snapshot(snapshot: &source::DirectorySnapshot) -> source::DirectorySnapshot {
    source::DirectorySnapshot {
        path: snapshot.path.clone(),
        identity: snapshot.identity.clone(),
        parents: snapshot.parents.clone(),
        parent_paths: snapshot.parent_paths.clone(),
        members: snapshot.members.clone(),
    }
}

mod evidence;
mod inspection;
mod issues;
mod membership;
mod owner;
pub use evidence::ResourceEvidence;

/// One read phase owns one resource-root observation, Git membership snapshot,
/// and per-member stat cache; selected resources are inspected at most once.
pub struct ResourceContext<'a> {
    root: &'a Root,
    directory: String,
    missing_membership_checked: bool,
    relative: Option<RelativePath>,
    listing: Option<source::DirectorySnapshot>,
    git_members: Option<HashSet<String>>,
    git_by_owner: HashMap<String, Vec<String>>,
    checked: HashMap<String, bool>,
    directory_facts: HashMap<std::path::PathBuf, source::DirectorySnapshot>,
    directory_requested: HashMap<(std::path::PathBuf, String), Option<String>>,
    root_fact: source::ResourceRootFact,
    inspected: HashMap<String, source::SelectedStatTree>,
    missing_facts: HashMap<String, source::MissingProof>,
    observed_owners: HashSet<String>,
    owner_facts: HashMap<String, source::ResourceDirectoryFact>,
    observed_ids: HashSet<String>,
    full_visible: Option<Vec<String>>,
}
impl<'a> ResourceContext<'a> {
    pub fn open(root: &'a Root, directory: &str, exists: bool) -> Result<Self, CommandError> {
        let resource_root =
            RelativePath::new(std::path::Path::new(directory).join("_resources"))
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let root_fact = source::capture_resource_root(root, &resource_root)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if root_fact.exists() != exists {
            return Err(CommandError::new(
                "source-changed",
                "resource root changed before phase capture",
            ));
        }
        let mut context = Self {
            root,
            directory: directory.to_owned(),
            missing_membership_checked: false,
            relative: None,
            listing: None,
            git_members: None,
            git_by_owner: HashMap::new(),
            checked: HashMap::new(),
            directory_facts: HashMap::new(),
            directory_requested: HashMap::new(),
            root_fact,
            inspected: HashMap::new(),
            missing_facts: HashMap::new(),
            observed_owners: HashSet::new(),
            owner_facts: HashMap::new(),
            observed_ids: HashSet::new(),
            full_visible: None,
        };
        if exists {
            context.capture_existing_root(resource_root)?;
        }
        Ok(context)
    }

    fn capture_existing_root(&mut self, relative: RelativePath) -> Result<(), CommandError> {
        let listing = source::enumerate_directory(self.root, &relative)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if !self.root_fact.matches_directory(&listing) {
            return Err(CommandError::new(
                "source-changed",
                "resource root changed between phase observations",
            ));
        }
        let (git_members, git_by_owner) = membership::capture(self.root, &self.directory)?;
        self.directory_facts.insert(
            relative.as_path().to_path_buf(),
            copy_directory_snapshot(&listing),
        );
        self.relative = Some(relative);
        self.listing = Some(listing);
        self.git_members = git_members;
        self.git_by_owner = git_by_owner;
        self.missing_membership_checked = true;
        Ok(())
    }

    /// Finish this phase. A later fresh phase must build its own context and compare.
    pub fn into_evidence(self) -> ResourceEvidence {
        let git_relevant = self.git_members.map(|members| {
            let mut selected: Vec<_> = members
                .into_iter()
                .filter(|id| {
                    self.full_visible.is_some()
                        || self.observed_ids.contains(id)
                        || id
                            .split_once('/')
                            .is_some_and(|(owner, _)| self.observed_owners.contains(owner))
                })
                .collect();
            selected.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            selected
        });
        ResourceEvidence {
            root: self.root_fact,
            directories: self.directory_facts,
            requested: self.directory_requested,
            checked: self.checked,
            inspected: self.inspected,
            missing: self.missing_facts,
            owners: self.owner_facts,
            git_relevant,
            full_visible: self.full_visible,
        }
    }
}

#[cfg(test)]
mod tests;
