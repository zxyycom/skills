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

pub fn root_exists(root: &Root, directory: &str) -> Result<bool, CommandError> {
    let path = RelativePath::new(std::path::Path::new(directory).join("_resources"))
        .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
    match source::enumerate_directory(root, &path) {
        Ok(_) => Ok(true),
        Err(source::SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(CommandError::new(
            "candidate-resource-read-failed",
            e.to_string(),
        )),
    }
}

mod inspection;
mod issues;
mod membership;
mod owner;

/// Resource visibility and Git membership for one operation.
pub struct ResourceContext<'a> {
    root: &'a Root,
    directory: String,
    missing_membership_checked: bool,
    relative: Option<RelativePath>,
    listing: Option<source::DirectorySnapshot>,
    git_members: Option<HashSet<String>>,
    git_by_owner: HashMap<String, Vec<String>>,
    checked: HashMap<String, bool>,
    directories: HashMap<std::path::PathBuf, DirectoryFacts>,
    #[cfg(test)]
    directory_enumerations: usize,
}
impl<'a> ResourceContext<'a> {
    pub fn open(root: &'a Root, directory: &str, exists: bool) -> Result<Self, CommandError> {
        let relative = RelativePath::new(std::path::Path::new(directory).join("_resources"))
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let listing =
            if exists {
                Some(source::enumerate_directory(root, &relative).map_err(|e| {
                    CommandError::new("candidate-resource-read-failed", e.to_string())
                })?)
            } else {
                None
            };
        let (git_members, git_by_owner) = if exists {
            membership::capture(root, directory)?
        } else {
            (None, HashMap::new())
        };
        Ok(Self {
            root,
            directory: directory.to_owned(),
            missing_membership_checked: exists,
            relative: exists.then_some(relative),
            listing,
            git_members,
            git_by_owner,
            checked: HashMap::new(),
            directories: HashMap::new(),
            #[cfg(test)]
            directory_enumerations: 0,
        })
    }
}

/// Names are indexed once per observed directory. The source listing is already
/// UTF-16 sorted, so the first folded alias preserves diagnostic ordering.
struct DirectoryFacts {
    version: Option<source::ResourceDirectoryVersion>,
    exact: HashSet<String>,
    folded: HashMap<String, String>,
}
impl DirectoryFacts {
    fn new(
        listing: source::DirectorySnapshot,
        version: Option<source::ResourceDirectoryVersion>,
    ) -> Self {
        let mut exact = HashSet::new();
        let mut folded = HashMap::new();
        for member in listing.members {
            folded
                .entry(member.name.to_lowercase())
                .or_insert_with(|| member.name.clone());
            exact.insert(member.name);
        }
        Self {
            version,
            exact,
            folded,
        }
    }
}

#[cfg(test)]
mod tests;
