use super::*;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct FileProof {
    pub path: RelativePath,
    pub identity: source::FileIdentity,
    pub parents: Vec<source::FileIdentity>,
    pub parent_paths: Vec<RelativePath>,
    pub bytes: Vec<u8>,
}
impl From<&source::SourceSnapshot> for FileProof {
    fn from(value: &source::SourceSnapshot) -> Self {
        Self {
            path: value.path.clone(),
            identity: value.identity.clone(),
            parents: value.parents.clone(),
            parent_paths: value.parent_paths.clone(),
            bytes: value.bytes.clone(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct DirectoryProof {
    pub path: RelativePath,
    pub identity: source::FileIdentity,
    pub parents: Vec<source::FileIdentity>,
    pub parent_paths: Vec<RelativePath>,
    pub members: Vec<DirectoryMember>,
}
impl DirectoryProof {
    pub(super) fn from_listing(listing: &source::DirectorySnapshot, ignored: Option<&str>) -> Self {
        Self {
            path: listing.path.clone(),
            identity: listing.identity.clone(),
            parents: listing.parents.clone(),
            parent_paths: listing.parent_paths.clone(),
            members: listing
                .members
                .iter()
                .filter(|member| Some(member.name.as_str()) != ignored)
                .cloned()
                .collect(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct DecisionProof {
    pub directories: Vec<DirectoryProof>,
    pub sources: Vec<FileProof>,
    pub index: Option<FileProof>,
}
#[derive(Clone, Debug)]
pub(crate) struct DecisionStage {
    pub result: CheckResult,
    pub proof: DecisionProof,
    pub target: Vec<u8>,
    pub needs_write: bool,
    pub activation_paths: Vec<String>,
}
pub(crate) struct InvestigationProof {
    pub directories: Vec<DirectoryProof>,
    pub sources: Vec<FileProof>,
    pub index: Option<FileProof>,
    pub resources: Option<crate::resources::ResourceEvidence>,
}
impl InvestigationProof {
    pub fn sources_equivalent(&self, other: &Self) -> bool {
        self.directories == other.directories
            && self.sources == other.sources
            && match (&self.resources, &other.resources) {
                (Some(a), Some(b)) => a.equivalent(b),
                (None, None) => true,
                _ => false,
            }
    }
    pub fn equivalent(&self, other: &Self) -> bool {
        self.sources_equivalent(other) && self.index == other.index
    }
}
pub(crate) struct InvestigationStage {
    pub result: CheckResult,
    pub proof: Option<InvestigationProof>,
    pub target: Vec<u8>,
    pub needs_write: bool,
}
