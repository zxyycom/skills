use super::*;

pub(super) struct Discovery {
    pub domain: Domain,
    pub listing: Option<source::DirectorySnapshot>,
    pub ids: HashSet<String>,
    pub occupied: HashSet<String>,
    pub warnings: Vec<String>,
}
pub(super) fn capture(operation: &NewOperation, root: &Root) -> Result<Discovery, TxError> {
    let domain = match &operation.input {
        NewInput::Decision { .. } => Domain::Decision,
        NewInput::Investigation { .. } => Domain::Investigation,
    };
    let listing = capture_listing(operation, root)?;
    let Inventory {
        ids,
        occupied,
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
    Ok(Discovery {
        domain,
        listing,
        ids,
        occupied,
        warnings,
    })
}

fn capture_listing(
    operation: &NewOperation,
    root: &Root,
) -> Result<Option<source::DirectorySnapshot>, TxError> {
    match source::enumerate_directory(root, &operation.collection) {
        Ok(v) => Ok(Some(v)),
        Err(source::SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(err("collection", e)),
    }
}

#[derive(Default)]
struct Inventory {
    ids: HashSet<String>,
    occupied: HashSet<String>,
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
    let occupied = listing.members.iter().map(|m| m.name.clone()).collect();
    Inventory {
        ids,
        occupied,
        warnings: found.warnings,
    }
}
