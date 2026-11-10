use super::*;
use std::collections::BTreeMap;

/// Read one literal path from an already resolved commit, never a moving ref.
pub fn read_revision_file(
    root: &std::path::Path,
    revision: &str,
    path: &std::path::Path,
) -> Result<Option<(u32, Vec<u8>)>, GitError> {
    let name = git_path(path)?;
    if !valid_oid(revision) {
        return Err(GitError::InvalidOutput("invalid fixed revision"));
    }
    let literal = format!(":(literal){name}");
    let listing = tree_listing(root, revision, &literal)?;
    let Some((mode, oid)) = selected_tree_record(&listing, &name)? else {
        return Ok(None);
    };
    let bytes = read_blob(root, oid)?;
    Ok(Some((mode, bytes)))
}

/// Read an explicit set of paths from one immutable revision. Missing paths are absent.
pub fn read_revision_files(
    root: &std::path::Path,
    revision: &str,
    paths: &[PathBuf],
) -> Result<BTreeMap<PathBuf, (u32, Vec<u8>)>, GitError> {
    if !valid_oid(revision) {
        return Err(GitError::InvalidOutput("invalid fixed revision"));
    }
    let mut names = BTreeMap::new();
    for path in paths {
        names.insert(git_path(path)?, path.clone());
    }
    if names.is_empty() {
        return Ok(BTreeMap::new());
    }
    let patterns: Vec<_> = names
        .keys()
        .map(|name| format!(":(top,literal){name}"))
        .collect();
    let mut entries = BTreeMap::new();
    for batch in pattern_batches(&patterns)? {
        tree_listing_batch(root, revision, batch, |listing| {
            merge_tree_listing(&mut entries, listing, revision.len())
        })?;
    }
    reject_directories(&names, &entries)?;
    let selected: Vec<_> = names
        .values()
        .filter_map(|path| entries.get(path).map(|entry| (path, entry)))
        .collect();
    let objects = read_blobs(
        root,
        &selected
            .iter()
            .map(|(_, entry)| entry.oid.clone())
            .collect::<Vec<_>>(),
    )?;
    Ok(selected
        .into_iter()
        .map(|(path, entry)| (path.clone(), (entry.mode, objects[&entry.oid].clone())))
        .collect())
}

/// A requested directory must never be mistaken for an absent file.
fn reject_directories(
    names: &BTreeMap<String, PathBuf>,
    entries: &BTreeMap<PathBuf, PendingEntry>,
) -> Result<(), GitError> {
    // A directory path is not a file, even when Git recursively lists descendants.
    for name in names.keys() {
        let path = std::path::Path::new(name);
        if entries
            .range(path.to_path_buf()..)
            .map(|(entry, _)| entry)
            .find(|entry| entry.as_path() != path)
            .is_some_and(|entry| entry.starts_with(path))
        {
            return Err(GitError::InvalidOutput("revision path is not a file"));
        }
    }
    Ok(())
}

/// Resolve a literal tree result without permitting ambiguous or mismatched paths.
fn selected_tree_record<'a>(
    listing: &'a [u8],
    name: &str,
) -> Result<Option<(u32, &'a str)>, GitError> {
    let mut records = listing.split(|c| *c == 0).filter(|part| !part.is_empty());
    let Some(record) = records.next() else {
        return Ok(None);
    };
    if records.next().is_some() {
        return Err(GitError::InvalidOutput(
            "revision path is not a unique file",
        ));
    }
    let tab = record
        .iter()
        .position(|b| *b == b'\t')
        .ok_or(GitError::InvalidOutput("invalid tree entry"))?;
    if &record[tab + 1..] != name.as_bytes() {
        return Err(GitError::InvalidOutput("revision path is not a file"));
    }
    tree_header(&record[..tab], None).map(Some)
}

/// Enumerate metadata of files in a fixed commit without reading their blobs.
/// Scope paths are literal and relative to the worktree root; empty scopes mean all.
pub fn list_revision_files(
    root: &std::path::Path,
    revision: &str,
    scopes: &[PathBuf],
) -> Result<Vec<PendingEntry>, GitError> {
    if !valid_oid(revision) {
        return Err(GitError::InvalidOutput("invalid fixed revision"));
    }
    let mut patterns: Vec<String> = if scopes.is_empty() {
        vec![":(top,literal)".into()]
    } else {
        scopes
            .iter()
            .map(|path| git_path(path).map(|name| format!(":(top,literal){name}")))
            .collect::<Result<_, _>>()?
    };
    patterns.sort();
    patterns.dedup();
    let mut result = BTreeMap::new();
    for batch in pattern_batches(&patterns)? {
        tree_listing_batch(root, revision, batch, |listing| {
            merge_tree_listing(&mut result, listing, revision.len())
        })?;
    }
    Ok(result.into_values().collect())
}

/// Merge overlapping literal scopes while rejecting conflicting tree entries.
fn merge_tree_listing(
    result: &mut BTreeMap<PathBuf, PendingEntry>,
    listing: &[u8],
    oid_length: usize,
) -> Result<(), GitError> {
    for record in listing
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let entry = listed_tree_record(record, oid_length)?;
        let path = entry.path.clone();
        if let Some(previous) = result.insert(path, entry.clone())
            && previous != entry
        {
            return Err(GitError::InvalidOutput("conflicting tree entries"));
        }
    }
    Ok(())
}

/// Read a literal tree listing and reject truncated NUL framing.
fn tree_listing(
    root: &std::path::Path,
    revision: &str,
    pattern: &str,
) -> Result<Vec<u8>, GitError> {
    let listing = command(
        root,
        &[
            "ls-tree",
            "-r",
            "-z",
            "--full-tree",
            revision,
            "--",
            pattern,
        ],
        None,
    )?;
    if !listing.is_empty() && listing.last() != Some(&0) {
        return Err(GitError::InvalidOutput("unterminated tree output"));
    }
    Ok(listing)
}

fn tree_listing_batch(
    root: &std::path::Path,
    revision: &str,
    patterns: &[String],
    mut consume: impl FnMut(&[u8]) -> Result<(), GitError>,
) -> Result<(), GitError> {
    command_patterns(
        root,
        &["ls-tree", "-r", "-z", "--full-tree", revision, "--"],
        patterns,
        256 * 1024 * 1024,
        |listing| {
            if !listing.is_empty() && listing.last() != Some(&0) {
                return Err(GitError::InvalidOutput("unterminated tree output"));
            }
            consume(listing)
        },
    )
}

fn listed_tree_record(record: &[u8], oid_length: usize) -> Result<PendingEntry, GitError> {
    let tab = record
        .iter()
        .position(|byte| *byte == b'\t')
        .ok_or(GitError::InvalidOutput("invalid tree entry"))?;
    let (mode, oid) = tree_header(&record[..tab], Some(oid_length))?;
    let name = std::str::from_utf8(&record[tab + 1..])
        .map_err(|_| GitError::InvalidOutput("invalid tree path"))?;
    let path = PathBuf::from(name);
    validate_path(&path)?;
    let entry = PendingEntry {
        path: path.clone(),
        mode,
        oid: oid.to_owned(),
        stage: 0,
    };
    Ok(entry)
}

/// Parse one tree entry header while enforcing the caller's object-format contract.
fn tree_header(bytes: &[u8], expected_length: Option<usize>) -> Result<(u32, &str), GitError> {
    let (mode, kind, oid) = tree_header_fields(bytes)?;
    if kind != "blob"
        || !matches!(mode, 0o100644 | 0o100755 | 0o120000)
        || !valid_oid(oid)
        || expected_length.is_some_and(|length| oid.len() != length)
    {
        return Err(GitError::InvalidOutput("unsupported tree entry"));
    }
    Ok((mode, oid))
}

/// Parse the three ordered fields in a Git tree header.
fn tree_header_fields(bytes: &[u8]) -> Result<(u32, &str, &str), GitError> {
    let header =
        std::str::from_utf8(bytes).map_err(|_| GitError::InvalidOutput("invalid tree header"))?;
    let mut fields = header.split(' ');
    let mode = u32::from_str_radix(
        fields
            .next()
            .ok_or(GitError::InvalidOutput("missing tree mode"))?,
        8,
    )
    .map_err(|_| GitError::InvalidOutput("invalid tree mode"))?;
    let kind = fields
        .next()
        .ok_or(GitError::InvalidOutput("missing tree type"))?;
    let oid = fields
        .next()
        .ok_or(GitError::InvalidOutput("missing tree oid"))?;
    if fields.next().is_some() {
        return Err(GitError::InvalidOutput("unsupported tree entry"));
    }
    Ok((mode, kind, oid))
}
