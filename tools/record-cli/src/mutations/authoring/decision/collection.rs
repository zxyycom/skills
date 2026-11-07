use super::*;

pub(super) struct Collection {
    pub index_path: RelativePath,
    pub index_before: ExpectedFile,
    pub baseline: index::ValidatedIndex<decision::DecisionState>,
    pub ids: BTreeMap<String, Located>,
    pub archive: Option<source::DirectorySnapshot>,
    pub candidates: BTreeSet<String>,
}

pub(super) fn capture(
    operation: &DecisionEvolutionOperation,
    root: &Root,
) -> Result<Collection, TxError> {
    let listing = source::enumerate_directory(root, &operation.collection)
        .map_err(|e| fail("collection", e))?;
    let Baseline {
        index_path,
        index_before,
        baseline,
    } = baseline(operation, root)?;
    let Members { archive, paths } = collect_members(operation, root, &listing)?;
    let CandidateHeaders { ids, candidates } =
        candidate_headers(operation, root, &baseline, &index_before, &paths)?;
    Ok(Collection {
        index_path,
        index_before,
        baseline,
        ids,
        archive,
        candidates,
    })
}

struct Baseline {
    index_path: RelativePath,
    index_before: ExpectedFile,
    baseline: index::ValidatedIndex<decision::DecisionState>,
}
fn baseline(operation: &DecisionEvolutionOperation, root: &Root) -> Result<Baseline, TxError> {
    let index_path = path(&operation.collection, "decision-index.json")?;
    let index_before = source::capture(root, &index_path).map_err(|e| fail("index", e))?;
    let baseline = match &index_before {
        ExpectedFile::Present(file) => {
            let index = index::parse_index(&file.bytes, &Definition)
                .map_err(|e| fail("index-invalid", e))?;
            if index::serialize_index(&index, &Definition).map_err(|e| fail("index-invalid", e))?
                != file.bytes
            {
                return Err(fail(
                    "index-noncanonical",
                    "publish requires canonical index",
                ));
            }
            index
        }
        ExpectedFile::Missing => index::build_index(
            index::IndexV4 {
                schema_version: 4,
                namespace: "decisions".into(),
                definition_version: 11,
                metadata: serde_json::json!({}),
                source_revision: index::Revision {
                    metadata: source_revision::metadata_fingerprint(Domain::Decision),
                    entries: BTreeMap::new(),
                },
                entries: BTreeMap::new(),
            },
            &Definition,
        )
        .map_err(|e| fail("index-invalid", e))?,
    };
    index::QuerySnapshot::new(baseline.clone())
        .graph(&Definition)
        .map_err(|e| fail("index-invalid", e))?;
    Ok(Baseline {
        index_path,
        index_before,
        baseline,
    })
}

struct Members {
    archive: Option<source::DirectorySnapshot>,
    paths: Vec<String>,
}
fn collect_members(
    operation: &DecisionEvolutionOperation,
    root: &Root,
    listing: &source::DirectorySnapshot,
) -> Result<Members, TxError> {
    let mut archive = None;
    let mut paths = Vec::new();
    for member in &listing.members {
        if member.name == "decision-index.json" {
            continue;
        }
        if member.name == "archive" {
            if member.kind != source::MemberKind::Directory {
                return Err(fail("collection", "archive is not a directory"));
            }
            let snapshot = collect_archive(operation, root, &mut paths)?;
            archive = Some(snapshot);
        } else {
            if member.kind != source::MemberKind::File
                || !member
                    .name
                    .strip_suffix(".md")
                    .is_some_and(domains::is_kebab)
            {
                return Err(fail("collection", &member.name));
            }
            paths.push(member.name.clone());
        }
    }
    paths.sort();
    Ok(Members { archive, paths })
}

fn collect_archive(
    operation: &DecisionEvolutionOperation,
    root: &Root,
    paths: &mut Vec<String>,
) -> Result<source::DirectorySnapshot, TxError> {
    let snapshot = source::enumerate_directory(root, &path(&operation.collection, "archive")?)
        .map_err(|e| fail("collection", e))?;
    for child in &snapshot.members {
        if child.kind != source::MemberKind::File
            || !child
                .name
                .strip_suffix(".md")
                .is_some_and(domains::is_kebab)
        {
            return Err(fail("collection", &child.name));
        }
        paths.push(format!("archive/{}", child.name));
    }
    Ok(snapshot)
}

struct CandidateHeaders {
    ids: BTreeMap<String, Located>,
    candidates: BTreeSet<String>,
}
fn candidate_headers(
    operation: &DecisionEvolutionOperation,
    root: &Root,
    baseline: &index::ValidatedIndex<decision::DecisionState>,
    index_before: &ExpectedFile,
    paths: &[String],
) -> Result<CandidateHeaders, TxError> {
    let mut ids = indexed_identities(baseline);
    let indexed_paths: HashSet<_> = ids.values().map(|item| item.path.clone()).collect();
    let mut candidates = BTreeSet::new();
    for p in paths {
        if indexed_paths.contains(p) {
            continue;
        }
        let id = read_candidate_header(root, &operation.collection, p, index_before)?;
        if let Some(id) = id {
            if ids
                .insert(
                    id.clone(),
                    Located {
                        path: p.clone(),
                        name: domains::name_from_id(&id).into(),
                    },
                )
                .is_some()
            {
                return Err(fail("duplicate-id", id));
            }
            candidates.insert(id);
        }
    }
    Ok(CandidateHeaders { ids, candidates })
}

fn read_candidate_header(
    root: &Root,
    collection: &RelativePath,
    p: &str,
    index_before: &ExpectedFile,
) -> Result<Option<String>, TxError> {
    let h = source::capture_header(root, &path(collection, p)?)
        .map_err(|e| fail("candidate-header", e))?
        .ok_or_else(|| fail("candidate-header", "source disappeared"))?;
    let text = std::str::from_utf8(&h.bytes).map_err(|e| fail("candidate-header", e))?;
    let (id, candidate) =
        decision::candidate_header(text, p).map_err(|e| fail("candidate-header", e))?;
    if !candidate && matches!(index_before, ExpectedFile::Missing) {
        return Err(fail(
            "index-missing",
            "formal sources exist without an index",
        ));
    }
    Ok(if candidate { id } else { None })
}

fn indexed_identities(
    baseline: &index::ValidatedIndex<decision::DecisionState>,
) -> BTreeMap<String, Located> {
    baseline
        .index()
        .entries
        .iter()
        .map(|(id, s)| {
            (
                id.clone(),
                Located {
                    path: s.source_path.clone(),
                    name: s.name.clone(),
                },
            )
        })
        .collect()
}
