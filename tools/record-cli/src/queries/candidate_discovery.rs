//! Candidate identity discovery; published locations come only from the index.
mod decision;
mod investigation;
use crate::{
    domains, index,
    protocol::CommandError,
    source::{self, ExpectedFile, MemberKind, RelativePath, Root},
};
pub use decision::decisions;
pub use investigation::investigations;
use std::collections::{BTreeMap, HashMap, HashSet};
#[derive(Clone)]
pub struct Candidate {
    pub id: String,
    pub name: String,
    pub path: String,
    pub text: String,
}
pub struct Candidates {
    pub items: BTreeMap<String, Candidate>,
    pub warnings: Vec<String>,
    pub resources_exist: bool,
    pub formal_ids: HashSet<String>,
    pub formal_resources: HashMap<String, Vec<String>>,
}
// Candidate IDs remain distinct from the formal index while enforcing uniqueness.
struct CandidateRegistry {
    ids: HashSet<String>,
    paths: HashSet<String>,
    formal_ids: HashSet<String>,
    items: BTreeMap<String, Candidate>,
    warnings: Vec<String>,
}
impl CandidateRegistry {
    fn new(published: PublishedPaths, missing: bool) -> Self {
        Self {
            formal_ids: published.ids.clone(),
            ids: published.ids,
            paths: published.paths,
            items: BTreeMap::new(),
            warnings: index_warnings(missing),
        }
    }
    fn warn_invalid(&mut self, path: &str) {
        self.warnings.push(format!(
            "{path} must declare a valid frontmatter record ID; skipped invalid candidate"
        ));
    }
    fn insert(&mut self, candidate: Candidate) -> Result<(), CommandError> {
        if !self.ids.insert(candidate.id.clone()) {
            return Err(CommandError::new(
                "candidate-discovery-failed",
                format!(
                    "record ID occurs in more than one source path: {}",
                    candidate.id
                ),
            ));
        }
        self.items.insert(candidate.id.clone(), candidate);
        Ok(())
    }
    fn finish(
        self,
        resources_exist: bool,
        formal_resources: HashMap<String, Vec<String>>,
    ) -> Candidates {
        Candidates {
            items: self.items,
            warnings: self.warnings,
            resources_exist,
            formal_ids: self.formal_ids,
            formal_resources,
        }
    }
}

struct DiscoveryInputs<S> {
    dir: RelativePath,
    listing: source::DirectorySnapshot,
    published: Option<index::ValidatedIndex<S>>,
}
fn discovery_inputs<D: index::DomainDefinition>(
    root: &Root,
    directory: &str,
    index_name: &str,
    definition: &D,
) -> Result<DiscoveryInputs<D::State>, CommandError> {
    let failure = |e: String| CommandError::new("candidate-discovery-failed", e);
    let dir = RelativePath::new(directory).map_err(|e| failure(e.to_string()))?;
    let listing = source::enumerate_directory(root, &dir).map_err(|e| failure(e.to_string()))?;
    let published = published_index(root, &dir, index_name, definition)?;
    Ok(DiscoveryInputs {
        dir,
        listing,
        published,
    })
}

struct PublishedPaths {
    ids: HashSet<String>,
    paths: HashSet<String>,
}
fn published_paths<S>(
    index: Option<&index::ValidatedIndex<S>>,
    source_path: impl Fn(&S) -> &str,
) -> PublishedPaths {
    let mut ids = HashSet::new();
    let mut paths = HashSet::new();
    if let Some(index) = index {
        for (id, state) in &index.index().entries {
            ids.insert(id.clone());
            paths.insert(source_path(state).to_owned());
        }
    }
    PublishedPaths { ids, paths }
}
fn index_warnings(missing: bool) -> Vec<String> {
    if missing {
        vec!["formal index is missing; candidate header discovery does not establish published records; explicitly recover before formal queries or publishing existing formal sources".to_owned()]
    } else {
        vec![]
    }
}

// Missing published indexes remain distinct from malformed or unsafe indexes.
fn published_index<D: index::DomainDefinition>(
    root: &Root,
    dir: &RelativePath,
    name: &str,
    definition: &D,
) -> Result<Option<index::ValidatedIndex<D::State>>, CommandError> {
    let failure = |e: String| CommandError::new("candidate-discovery-failed", e);
    let path = RelativePath::new(dir.as_path().join(name)).map_err(|e| failure(e.to_string()))?;
    match source::capture(root, &path).map_err(|e| failure(e.to_string()))? {
        ExpectedFile::Missing => Ok(None),
        ExpectedFile::Present(file) => index::parse_index(&file.bytes, definition)
            .map(Some)
            .map_err(|e| super::load::index_error(&path, e)),
    }
}
