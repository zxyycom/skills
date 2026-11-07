use super::*;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct FileProof {
    pub path: RelativePath,
    pub identity: source::FileIdentity,
    pub bytes: Vec<u8>,
}
impl FileProof {
    pub fn equivalent(&self, other: &Self) -> bool {
        self.path == other.path
            && self.bytes == other.bytes
            && self.identity.mode == other.identity.mode
    }
}
pub fn same_files(a: &[FileProof], b: &[FileProof]) -> bool {
    a.len() == b.len() && a.iter().zip(b).all(|(a, b)| a.equivalent(b))
}
fn same_optional_file(a: &Option<FileProof>, b: &Option<FileProof>) -> bool {
    match (a, b) {
        (Some(a), Some(b)) => a.equivalent(b),
        (None, None) => true,
        _ => false,
    }
}
impl From<&source::SourceSnapshot> for FileProof {
    fn from(value: &source::SourceSnapshot) -> Self {
        Self {
            path: value.path.clone(),
            identity: value.identity.clone(),
            bytes: value.bytes.clone(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct DirectoryProof {
    pub path: RelativePath,
    pub members: Vec<DirectoryMember>,
}
impl DirectoryProof {
    fn equivalent(&self, other: &Self) -> bool {
        self.path == other.path
            && self.members.len() == other.members.len()
            && self
                .members
                .iter()
                .zip(&other.members)
                .all(|(a, b)| a.name == b.name && a.kind == b.kind)
    }
    pub(super) fn from_listing(listing: &source::DirectorySnapshot, ignored: Option<&str>) -> Self {
        Self {
            path: listing.path.clone(),
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
impl DecisionProof {
    pub fn sources_equivalent(&self, other: &Self) -> bool {
        same_directories(&self.directories, &other.directories)
            && same_files(&self.sources, &other.sources)
    }
    pub fn equivalent(&self, other: &Self) -> bool {
        self.sources_equivalent(other) && same_optional_file(&self.index, &other.index)
    }
}
fn same_directories(a: &[DirectoryProof], b: &[DirectoryProof]) -> bool {
    a.len() == b.len() && a.iter().zip(b).all(|(a, b)| a.equivalent(b))
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
        same_directories(&self.directories, &other.directories)
            && same_files(&self.sources, &other.sources)
            && match (&self.resources, &other.resources) {
                (Some(a), Some(b)) => a.equivalent(b),
                (None, None) => true,
                _ => false,
            }
    }
    pub fn equivalent(&self, other: &Self) -> bool {
        self.sources_equivalent(other) && same_optional_file(&self.index, &other.index)
    }
}
pub(crate) struct InvestigationStage {
    pub result: CheckResult,
    pub proof: Option<InvestigationProof>,
    pub target: Vec<u8>,
    pub needs_write: bool,
}
