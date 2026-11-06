use super::*;

pub(super) struct Collection {
    pub listing: source::DirectorySnapshot,
    pub index_path: RelativePath,
    pub before_index: ExpectedFile,
    pub baseline: index::ValidatedIndex<InvestigationState>,
    pub headers: Vec<(String, source::HeaderSnapshot)>,
    pub candidates: BTreeMap<String, String>,
    pub discovery_warnings: Vec<String>,
    pub occupied: HashSet<String>,
}
pub(super) fn capture(
    operation: &InvestigationPublishOperation,
    root: &Root,
) -> Result<Collection, TxError> {
    let listing = source::enumerate_directory(root, &operation.collection)
        .map_err(|e| fail("collection", e))?;
    let Baseline {
        index_path,
        before_index,
        baseline,
    } = baseline(operation, root, &listing)?;
    let Candidates {
        headers,
        candidates,
        discovery_warnings,
        occupied,
    } = candidates(operation, root, &listing, &baseline)?;
    Ok(Collection {
        listing,
        index_path,
        before_index,
        baseline,
        headers,
        candidates,
        discovery_warnings,
        occupied,
    })
}

struct Baseline {
    index_path: RelativePath,
    before_index: ExpectedFile,
    baseline: index::ValidatedIndex<InvestigationState>,
}
fn baseline(
    operation: &InvestigationPublishOperation,
    root: &Root,
    listing: &source::DirectorySnapshot,
) -> Result<Baseline, TxError> {
    let index_path = RelativePath::new(
        operation
            .collection
            .as_path()
            .join("investigation-index.json"),
    )
    .map_err(|e| fail("path", e))?;
    let before_index = source::capture(root, &index_path).map_err(|e| fail("index", e))?;
    let baseline = match &before_index {
        ExpectedFile::Present(index_file) => canonical_index(index_file)?,
        ExpectedFile::Missing => {
            if listing.members.iter().any(|m| m.name.ends_with(".md")) {
                return Err(fail(
                    "index-missing",
                    "formal sources exist without an index",
                ));
            }
            empty_baseline()?
        }
    };
    index::QuerySnapshot::new(baseline.clone())
        .graph(&Definition)
        .map_err(|e| fail("index-invalid", e))?;
    Ok(Baseline {
        index_path,
        before_index,
        baseline,
    })
}

struct Candidates {
    headers: Vec<(String, source::HeaderSnapshot)>,
    candidates: BTreeMap<String, String>,
    discovery_warnings: Vec<String>,
    occupied: HashSet<String>,
}
fn candidates(
    operation: &InvestigationPublishOperation,
    root: &Root,
    listing: &source::DirectorySnapshot,
    baseline: &index::ValidatedIndex<InvestigationState>,
) -> Result<Candidates, TxError> {
    let mut found = Candidates {
        headers: Vec::new(),
        candidates: BTreeMap::new(),
        discovery_warnings: Vec::new(),
        occupied: listing.members.iter().map(|m| m.name.clone()).collect(),
    };
    let mut ids: HashSet<String> = baseline.index().entries.keys().cloned().collect();
    for member in &listing.members {
        if member.name == "investigation-index.json" {
            continue;
        }
        if member.name == "_resources" {
            if member.kind != source::MemberKind::Directory {
                return Err(fail("resource-root", "resources must be a directory"));
            }
            continue;
        }
        if member.name.starts_with("_candidate.") {
            capture_candidate(operation, root, member, &mut ids, &mut found)?;
        } else if !member
            .name
            .strip_suffix(".md")
            .is_some_and(domains::is_kebab)
        {
            return Err(fail(
                "collection",
                format!("invalid member: {}", member.name),
            ));
        }
    }
    found.headers.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(found)
}

fn capture_candidate(
    operation: &InvestigationPublishOperation,
    root: &Root,
    member: &source::DirectoryMember,
    ids: &mut HashSet<String>,
    found: &mut Candidates,
) -> Result<(), TxError> {
    let locator = member
        .name
        .strip_prefix("_candidate.")
        .expect("candidate prefix checked");
    if member.kind != source::MemberKind::File || !domains::is_kebab(locator) {
        return Err(fail("collection", "invalid candidate path"));
    }
    let path = RelativePath::new(operation.collection.as_path().join(&member.name))
        .map_err(|e| fail("path", e))?;
    let header = source::capture_header(root, &path)
        .map_err(|e| fail("candidate-header", e))?
        .ok_or_else(|| fail("candidate-header", "candidate disappeared"))?;
    if let Some(id) = parse_candidate_header(&header)? {
        if !ids.insert(id.clone()) {
            return Err(fail("duplicate-id", id));
        }
        found.candidates.insert(id.clone(), member.name.clone());
    } else {
        found.discovery_warnings.push(format!(
            "{} must declare a valid frontmatter record ID; skipped invalid candidate",
            member.name
        ));
    }
    found.headers.push((member.name.clone(), header));
    Ok(())
}

fn empty_baseline() -> Result<index::ValidatedIndex<InvestigationState>, TxError> {
    index::build_index(
        index::IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: index::Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Investigation),
                entries: BTreeMap::new(),
            },
            entries: BTreeMap::new(),
        },
        &Definition,
    )
    .map_err(|e| fail("index-invalid", e))
}

fn parse_candidate_header(header: &source::HeaderSnapshot) -> Result<Option<String>, TxError> {
    let text = std::str::from_utf8(&header.bytes).map_err(|e| fail("candidate-header", e))?;
    domains::investigation::candidate_header(text).map_err(|e| {
        if e == "unsupported-unpaired-surrogate" {
            fail("unsupported-unpaired-surrogate", e)
        } else {
            fail("candidate-header", e)
        }
    })
}

fn canonical_index(
    index_file: &source::SourceSnapshot,
) -> Result<index::ValidatedIndex<InvestigationState>, TxError> {
    let baseline =
        index::parse_index(&index_file.bytes, &Definition).map_err(|e| fail("index-invalid", e))?;
    if index::serialize_index(&baseline, &Definition).map_err(|e| fail("index-invalid", e))?
        != index_file.bytes
    {
        return Err(fail(
            "index-noncanonical",
            "publish requires canonical index",
        ));
    }
    Ok(baseline)
}
