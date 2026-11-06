use super::*;

/// Immutable facts consumed by the next freshness phase. Its constructors are
/// private and compare only selected owners/references unless full scope was used.
pub struct ResourceEvidence {
    pub(super) root: source::ResourceRootFact,
    pub(super) directories: HashMap<std::path::PathBuf, source::DirectorySnapshot>,
    pub(super) requested: HashMap<(std::path::PathBuf, String), Option<String>>,
    pub(super) checked: HashMap<String, bool>,
    pub(super) inspected: HashMap<String, source::SelectedStatTree>,
    pub(super) missing: HashMap<String, source::MissingProof>,
    pub(super) owners: HashMap<String, source::ResourceDirectoryFact>,
    pub(super) git_relevant: Option<Vec<String>>,
    pub(super) full_visible: Option<Vec<String>>,
}
impl ResourceEvidence {
    pub fn equivalent(&self, other: &Self) -> bool {
        self.same_scope(other)
            && self.same_directory_identities(other)
            && self.same_requested_members(other)
            && self.same_stat_facts(other)
    }

    /// Compare which facts were observed before comparing their identities.
    fn same_scope(&self, other: &Self) -> bool {
        self.root.equivalent(&other.root)
            && self.requested == other.requested
            && self.checked == other.checked
            && self.git_relevant == other.git_relevant
            && self.full_visible == other.full_visible
            && self.directories.len() == other.directories.len()
            && self.inspected.len() == other.inspected.len()
            && self.missing.len() == other.missing.len()
            && self.owners.len() == other.owners.len()
    }

    fn same_stat_facts(&self, other: &Self) -> bool {
        self.inspected
            .iter()
            .all(|(id, a)| other.inspected.get(id).is_some_and(|b| a.equivalent(b)))
            && self
                .missing
                .iter()
                .all(|(id, a)| other.missing.get(id).is_some_and(|b| a.equivalent(b)))
            && self
                .owners
                .iter()
                .all(|(id, a)| other.owners.get(id).is_some_and(|b| a.equivalent(b)))
    }

    fn same_directory_identities(&self, other: &Self) -> bool {
        self.directories.iter().all(|(path, a)| {
            other.directories.get(path).is_some_and(|b| {
                a.identity == b.identity
                    && a.parents == b.parents
                    && a.parent_paths == b.parent_paths
            })
        })
    }

    fn same_requested_members(&self, other: &Self) -> bool {
        self.requested.iter().all(|((path, _), actual)| {
            let (Some(a), Some(b)) = (self.directories.get(path), other.directories.get(path))
            else {
                return false;
            };
            let fact = |directory: &source::DirectorySnapshot| {
                actual
                    .as_ref()
                    .and_then(|name| directory.members.iter().find(|member| &member.name == name))
                    .map(|member| {
                        (
                            member.kind.clone(),
                            member.identity.device,
                            member.identity.inode,
                            member.identity.mode,
                        )
                    })
            };
            fact(a) == fact(b)
        })
    }
}
