use super::*;

pub(super) struct PreparedUpdates {
    pub wanted: BTreeMap<(PathBuf, u8), PendingEntry>,
    pub changed: Vec<PathBuf>,
    pub input: Vec<u8>,
}

/// Build an alternate-index batch while preserving untouched membership.
pub(super) fn prepare_updates<'a>(
    root: &'a Path,
    expected: &'a ContentSnapshot,
    targets: &'a BTreeMap<PathBuf, Option<PendingFile>>,
    oid_length: usize,
) -> Result<PreparedUpdates, ReplacementFailure> {
    let wanted: BTreeMap<(PathBuf, u8), PendingEntry> = expected
        .membership
        .entries
        .iter()
        .cloned()
        .map(|entry| ((entry.path.clone(), entry.stage), entry))
        .collect();
    if wanted.len() != expected.membership.entries.len() {
        return Err(failed(FailureKind::Failed, "duplicate pending identity"));
    }
    let mut batch = UpdateBatch {
        root,
        expected,
        oid_length,
        wanted,
        changed: Vec::new(),
        input: Vec::new(),
        object_ids: BTreeMap::new(),
    };
    for (path, target) in targets {
        batch.apply(path, target)?;
    }
    Ok(PreparedUpdates {
        wanted: batch.wanted,
        changed: batch.changed,
        input: batch.input,
    })
}

struct UpdateBatch<'a> {
    root: &'a Path,
    expected: &'a ContentSnapshot,
    oid_length: usize,
    wanted: BTreeMap<(PathBuf, u8), PendingEntry>,
    changed: Vec<PathBuf>,
    input: Vec<u8>,
    object_ids: BTreeMap<&'a [u8], String>,
}
impl<'a> UpdateBatch<'a> {
    /// Record one selected path only when mode or payload differs from pending.
    fn apply(
        &mut self,
        path: &Path,
        target: &'a Option<PendingFile>,
    ) -> Result<(), ReplacementFailure> {
        let previous = self.wanted.get(&(path.to_path_buf(), 0));
        let prior_bytes = self
            .expected
            .blobs()
            .iter()
            .find(|(p, _)| p.as_path() == path)
            .map(|(_, bytes)| bytes.as_slice());
        let unchanged = match (previous, target) {
            (None, None) => true,
            (Some(entry), Some(file)) => {
                entry.mode == file.mode && prior_bytes == Some(file.bytes.as_slice())
            }
            _ => false,
        };
        if unchanged {
            return Ok(());
        }
        self.changed.push(path.to_path_buf());
        self.write_change(path, target)
    }

    /// Keep the Git index-info batch and expected membership in sync.
    fn write_change(
        &mut self,
        path: &Path,
        target: &'a Option<PendingFile>,
    ) -> Result<(), ReplacementFailure> {
        let name = path
            .to_str()
            .ok_or_else(|| failed(FailureKind::Failed, "invalid path"))?;
        match target {
            Some(file) => {
                let oid = write_object(
                    self.root,
                    &file.bytes,
                    self.oid_length,
                    &mut self.object_ids,
                )?;
                write!(self.input, "{:o} {}\t{}\0", file.mode, oid, name).map_err(operation)?;
                self.wanted.insert(
                    (path.to_path_buf(), 0),
                    PendingEntry {
                        path: path.to_path_buf(),
                        mode: file.mode,
                        oid,
                        stage: 0,
                    },
                );
            }
            None => {
                write!(self.input, "0 {}\t{}\0", "0".repeat(self.oid_length), name)
                    .map_err(operation)?;
                self.wanted.remove(&(path.to_path_buf(), 0));
            }
        }
        Ok(())
    }
}

/// Restrict updates to unique selected paths with supported Git representations.
pub(super) fn validate_targets(
    expected: &ContentSnapshot,
    updates: &[PendingUpdate],
) -> Result<BTreeMap<PathBuf, Option<PendingFile>>, ReplacementFailure> {
    let mut targets = BTreeMap::new();
    for update in updates {
        validate_path(&update.path).map_err(operation)?;
        if !expected.paths.contains(&update.path)
            || targets
                .insert(update.path.clone(), update.file.clone())
                .is_some()
        {
            return Err(failed(
                FailureKind::Failed,
                "updates must be unique selected paths",
            ));
        }
        if let Some(file) = &update.file
            && !matches!(file.mode, 0o100644 | 0o100755 | 0o120000)
        {
            return Err(failed(FailureKind::Failed, "unsupported file mode"));
        }
    }
    Ok(targets)
}

/// Hash each distinct payload once while constructing the alternate index batch.
fn write_object<'a>(
    root: &Path,
    bytes: &'a [u8],
    oid_length: usize,
    cache: &mut BTreeMap<&'a [u8], String>,
) -> Result<String, ReplacementFailure> {
    if let Some(oid) = cache.get(bytes) {
        return Ok(oid.clone());
    }
    let output =
        command(root, &["hash-object", "-w", "--stdin"], Some(bytes)).map_err(operation)?;
    let oid = std::str::from_utf8(&output)
        .map_err(operation)?
        .trim_end()
        .to_owned();
    if oid.len() != oid_length || !super::super::valid_oid(&oid) {
        return Err(failed(FailureKind::Failed, "invalid object ID"));
    }
    cache.insert(bytes, oid.clone());
    Ok(oid)
}

/// Verify the alternate index preserves unrelated membership and selected payloads.
pub(super) fn verify_prepared(
    observed: &ContentSnapshot,
    wanted: &BTreeMap<(PathBuf, u8), PendingEntry>,
    targets: &BTreeMap<PathBuf, Option<PendingFile>>,
) -> Result<(), ReplacementFailure> {
    let observed_set: BTreeMap<_, _> = observed
        .membership
        .entries
        .iter()
        .cloned()
        .map(|e| ((e.path.clone(), e.stage), e))
        .collect();
    if observed_set.len() != observed.membership.entries.len() || observed_set != *wanted {
        return Err(failed(
            FailureKind::Failed,
            "prepared pending membership mismatch",
        ));
    }
    for (path, target) in targets {
        let got = observed
            .blobs()
            .iter()
            .find(|(p, _)| p == path)
            .map(|(_, b)| b.as_slice());
        if got != target.as_ref().map(|f| f.bytes.as_slice()) {
            return Err(failed(
                FailureKind::Failed,
                "prepared pending content mismatch",
            ));
        }
    }
    Ok(())
}
