use super::*;

pub(super) struct Discovery {
    pub domain: Domain,
    pub listing: Option<source::DirectorySnapshot>,
    pub index_path: RelativePath,
    pub index: ExpectedFile,
    pub ids: HashSet<String>,
    pub occupied: HashSet<String>,
    pub candidates: Vec<(String, String, String)>,
    pub warnings: Vec<String>,
}
pub(super) fn capture(operation: &NewOperation, root: &Root) -> Result<Discovery, TxError> {
    let (domain, index_name) = match &operation.input {
        NewInput::Decision { .. } => (Domain::Decision, "decision-index.json"),
        NewInput::Investigation { .. } => (Domain::Investigation, "investigation-index.json"),
    };
    let listing = capture_listing(operation, root)?;
    let index_path = RelativePath::new(operation.collection.as_path().join(index_name))
        .map_err(|e| err("path", e))?;
    let index = source::capture(root, &index_path).map_err(|e| err("index", e))?;
    let Inventory {
        ids,
        occupied,
        mut candidates,
        warnings,
    } = if let Some(ref listing) = listing {
        let directory = operation
            .collection
            .as_path()
            .to_str()
            .ok_or_else(|| err("path", "collection path is not UTF-8"))?;
        let found = match domain {
            Domain::Decision => candidate_discovery::decisions(root, directory),
            Domain::Investigation => candidate_discovery::investigations(root, directory),
        }
        .map_err(|e| err(&e.code, &e.message))?;
        inventory(found, listing)
    } else {
        Inventory::default()
    };
    candidates.sort();
    Ok(Discovery {
        domain,
        listing,
        index_path,
        index,
        ids,
        occupied,
        candidates,
        warnings,
    })
}

fn capture_listing(
    operation: &NewOperation,
    root: &Root,
) -> Result<Option<source::DirectorySnapshot>, TxError> {
    match source::enumerate_directory(root, &operation.collection) {
        Ok(v) => Ok(Some(v)),
        Err(source::SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {
            source::capture_missing(root, &operation.collection)
                .map_err(|e| err("collection", e))?;
            Ok(None)
        }
        Err(e) => Err(err("collection", e)),
    }
}

#[derive(Default)]
struct Inventory {
    ids: HashSet<String>,
    occupied: HashSet<String>,
    candidates: Vec<(String, String, String)>,
    warnings: Vec<String>,
}
fn inventory(
    found: candidate_discovery::Candidates,
    listing: &source::DirectorySnapshot,
) -> Inventory {
    let ids: HashSet<String> = found
        .formal_ids
        .into_iter()
        .chain(found.items.keys().cloned())
        .collect();
    let candidates = found
        .items
        .into_values()
        .map(|v| (v.id, v.path, v.text))
        .collect::<Vec<_>>();
    let occupied = listing.members.iter().map(|m| m.name.clone()).collect();
    Inventory {
        ids,
        occupied,
        candidates,
        warnings: found.warnings,
    }
}
