use super::*;

/// Read only requested object identities, verifying Git's batch protocol and payload hashes.
pub(super) fn read_blobs(
    root: &std::path::Path,
    oids: &[String],
) -> Result<std::collections::BTreeMap<String, Vec<u8>>, GitError> {
    read_blobs_with_budget(root, oids, 256 * 1024 * 1024)
}

pub(super) fn read_blobs_with_budget(
    root: &std::path::Path,
    oids: &[String],
    budget: usize,
) -> Result<std::collections::BTreeMap<String, Vec<u8>>, GitError> {
    let unique: std::collections::BTreeSet<_> = oids.iter().collect();
    let mut result = std::collections::BTreeMap::new();
    for group in unique.into_iter().collect::<Vec<_>>().chunks(128) {
        let mut input = Vec::new();
        for oid in group {
            if !valid_oid(oid) {
                return Err(GitError::InvalidOutput("invalid oid"));
            }
            input.extend_from_slice(oid.as_bytes());
            input.push(b'\n');
        }
        let output = match command::command_with_budget(
            root,
            &["cat-file", "--batch"],
            Some(&input),
            budget,
        ) {
            Ok(output) => output,
            Err(GitError::OutputBudgetExceeded) => {
                result.extend(read_individual(root, group)?);
                continue;
            }
            Err(error) => return Err(error),
        };
        result.extend(parse_batch(group, &output)?);
    }
    Ok(result)
}

fn read_individual(
    root: &std::path::Path,
    group: &[&String],
) -> Result<std::collections::BTreeMap<String, Vec<u8>>, GitError> {
    let mut result = std::collections::BTreeMap::new();
    for oid in group {
        if command(root, &["cat-file", "-t", oid], None)? != b"blob\n" {
            return Err(GitError::InvalidOutput("pending object is not a blob"));
        }
        result.insert((*oid).clone(), read_blob(root, oid)?);
    }
    Ok(result)
}

/// Validate every response and bind its payload to the requested object identity.
pub(super) fn parse_batch(
    group: &[&String],
    output: &[u8],
) -> Result<std::collections::BTreeMap<String, Vec<u8>>, GitError> {
    let mut result = std::collections::BTreeMap::new();
    let mut offset = 0usize;
    for oid in group {
        let end = output[offset..]
            .iter()
            .position(|&b| b == b'\n')
            .ok_or(GitError::InvalidOutput("unterminated batch header"))?
            + offset;
        let size = parse_header(&output[offset..end], oid)?;
        let start = end + 1;
        let finish = start
            .checked_add(size)
            .ok_or(GitError::InvalidOutput("batch size overflow"))?;
        if output.get(finish) != Some(&b'\n') {
            return Err(GitError::InvalidOutput("truncated batch payload"));
        }
        let bytes = &output[start..finish];
        verify_payload(oid, bytes)?;
        result.insert((*oid).clone(), bytes.to_vec());
        offset = finish + 1;
    }
    if offset != output.len() {
        return Err(GitError::InvalidOutput("extra batch output"));
    }
    Ok(result)
}

fn parse_header(bytes: &[u8], oid: &str) -> Result<usize, GitError> {
    let header =
        std::str::from_utf8(bytes).map_err(|_| GitError::InvalidOutput("invalid batch header"))?;
    let mut fields = header.split(' ');
    if fields.next() != Some(oid) || fields.next() != Some("blob") {
        return Err(GitError::InvalidOutput(
            "batch object identity or type mismatch",
        ));
    }
    let size = fields
        .next()
        .ok_or(GitError::InvalidOutput("missing batch size"))?;
    if fields.next().is_some() || size.is_empty() || !size.bytes().all(|b| b.is_ascii_digit()) {
        return Err(GitError::InvalidOutput("invalid batch size"));
    }
    size.parse()
        .map_err(|_| GitError::InvalidOutput("invalid batch size"))
}

fn verify_payload(oid: &str, bytes: &[u8]) -> Result<(), GitError> {
    use sha2::Digest;
    let size = bytes.len();
    let prefix = format!("blob {size}\0");
    let actual = if oid.len() == 40 {
        checked_sha1(prefix.as_bytes(), bytes)?
    } else {
        let mut hash = sha2::Sha256::new();
        hash.update(prefix.as_bytes());
        hash.update(bytes);
        format!("{:x}", hash.finalize())
    };
    if actual != oid {
        return Err(GitError::InvalidOutput("blob identity mismatch"));
    }
    Ok(())
}

/// SHA-1 collision detection covers both Git's object header and its payload.
pub(super) fn checked_sha1(prefix: &[u8], bytes: &[u8]) -> Result<String, GitError> {
    let mut hash = sha1collisiondetection::Sha1CD::configure()
        .detect_collisions(true)
        .build();
    hash.update(prefix);
    hash.update(bytes);
    let digest = hash
        .finalize_cd()
        .map_err(|_| GitError::InvalidOutput("SHA-1 collision detected"))?;
    Ok(format!("{digest:x}"))
}
