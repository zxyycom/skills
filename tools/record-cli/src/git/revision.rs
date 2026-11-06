use super::*;
use std::collections::BTreeMap;

/// Read one literal path from an already resolved commit, never a moving ref.
pub fn read_revision_file(
    root: &std::path::Path,
    revision: &str,
    path: &std::path::Path,
) -> Result<Option<(u32, Vec<u8>)>, GitError> {
    validate_path(path)?;
    if !valid_oid(revision) {
        return Err(GitError::InvalidOutput("invalid fixed revision"));
    }
    let name = path
        .to_str()
        .ok_or(GitError::InvalidOutput("non-UTF8 path"))?;
    let literal = format!(":(literal){name}");
    let listing = tree_listing(root, revision, &literal)?;
    let Some((mode, oid)) = selected_tree_record(&listing, name)? else {
        return Ok(None);
    };
    let bytes = read_blob(root, oid)?;
    Ok(Some((mode, bytes)))
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
    for scope in scopes {
        validate_path(scope)?;
    }
    let patterns: Vec<String> = if scopes.is_empty() {
        vec![":(top,literal)".into()]
    } else {
        scopes
            .iter()
            .map(|path| format!(":(top,literal){}", path.to_string_lossy()))
            .collect()
    };
    let mut result = BTreeMap::new();
    for pattern in patterns {
        let listing = tree_listing(root, revision, &pattern)?;
        merge_tree_listing(&mut result, &listing, revision.len())?;
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
