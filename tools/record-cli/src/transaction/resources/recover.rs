//! Resource journal conditional recovery.
use super::*;

impl Journal {
    /// Returns diagnostics and paths whose recovery cannot be proven.
    pub fn recover(&self, root: &Root) -> (Vec<String>, Vec<RelativePath>) {
        let mut failures = Vec::new();
        let mut unknown = self.unknown.clone();
        if !unknown.is_empty() {
            return (failures, unknown);
        }
        for entry in self.entries.iter().rev() {
            let result = recover_entry(root, entry, &mut unknown);
            if let Err(error) = result {
                failures.push(format!("{}: {error}", entry.path().as_path().display()));
                break;
            }
        }
        if failures.is_empty() {
            failures.extend(self.verify_reconstructed(root));
        }
        (failures, unknown)
    }
    fn verify_reconstructed(&self, root: &Root) -> Vec<String> {
        let mut failures = Vec::new();
        for entry in &self.entries {
            let Actual::RemovedDirectory { path, .. } = entry else {
                continue;
            };
            let tree = match source::capture_tree(root, path) {
                Ok(tree) => tree,
                Err(error) => {
                    failures.push(format!("{}: {error}", path.as_path().display()));
                    continue;
                }
            };
            failures.extend(self.verify_tree_members(path, &tree));
        }

        failures
    }
    // Verify the complete reconstructed owner against only journaled removed entries.
    fn verify_tree_members(&self, path: &RelativePath, tree: &source::TreeSnapshot) -> Vec<String> {
        let mut failures = Vec::new();
        for member in tree.entries() {
            let member_path = member.path();
            if !self.matches_recovered_entry(member) {
                failures.push(format!(
                    "unexpected restored member: {}",
                    member_path.as_path().display()
                ));
            }
        }
        for expected in &self.entries {
            if !matches!(
                expected,
                Actual::RemovedDirectory { .. } | Actual::RemovedFile { .. }
            ) || !expected.path().as_path().starts_with(path.as_path())
            {
                continue;
            }
            if !tree
                .entries()
                .iter()
                .any(|member| member.path() == expected.path())
            {
                failures.push(format!(
                    "restored member missing: {}",
                    expected.path().as_path().display()
                ));
            }
        }

        failures
    }
    // A reconstructed member must correspond to a removed journal fact.
    fn matches_recovered_entry(&self, member: &source::TreeEntry) -> bool {
        let member_path = member.path();
        let expected = self.entries.iter().find(|candidate| {
            candidate.path() == member_path
                && matches!(
                    candidate,
                    Actual::RemovedDirectory { .. } | Actual::RemovedFile { .. }
                )
        });
        match (member, expected) {
            (
                source::TreeEntry::Directory { identity, .. },
                Some(Actual::RemovedDirectory { before, .. }),
            ) => identity.mode == before.identity.mode,
            (
                source::TreeEntry::File {
                    identity, bytes, ..
                },
                Some(Actual::RemovedFile { before }),
            ) => identity.mode == before.identity.mode && bytes == &before.bytes,
            _ => false,
        }
    }
}

fn recover_entry(
    root: &Root,
    entry: &Actual,
    unknown: &mut Vec<RelativePath>,
) -> Result<(), String> {
    match entry {
        // mkdir has no atomic creation handle: never delete an observed winner.
        Actual::CreatedDirectory { path, .. } => {
            unknown.push(path.clone());
            Ok(())
        }
        Actual::CreatedFile { snapshot } => source::remove_if_owned(root, snapshot).map_err(|e| {
            if e.effect != source::RemoveEffect::NotStarted {
                unknown.push(snapshot.path.clone());
            }
            e.error.to_string()
        }),
        Actual::RemovedFile { before } => recover_removed_file(root, before, unknown),
        Actual::RemovedDirectory { path, before } => {
            recover_removed_directory(root, path, before, unknown)
        }
    }
}

fn recover_removed_file(
    root: &Root,
    before: &SourceSnapshot,
    unknown: &mut Vec<RelativePath>,
) -> Result<(), String> {
    let proof = source::capture_missing(root, &before.path).map_err(|e| e.to_string())?;
    if !proof.matches_journaled_parent_of(before, &[], &[]) {
        return Err("original parent chain changed before resource recovery".into());
    }
    let mode = source::CreateMode::Exact(super::super::exact_mode(before.identity.mode));
    let created = source::create_exclusive(root, &proof, mode).map_err(|e| {
        if e.effect == source::CreateEffect::Unknown {
            unknown.push(before.path.clone());
        }
        e.error.to_string()
    })?;
    // Until independent readback succeeds, the recovery write has unknown effects.
    unknown.push(before.path.clone());
    let mut handle = created.file;
    super::super::write_synced(&mut handle, &before.bytes).map_err(|e| e.to_string())?;
    source::finalize_created_mode(&handle, mode)
        .and_then(|_| handle.sync_all().map_err(Into::into))
        .map_err(|e| e.to_string())?;
    if !restored_file_matches(root, before, &proof, &handle) {
        return Err("restored file does not match".into());
    }
    unknown.pop();
    Ok(())
}

fn recover_removed_directory(
    root: &Root,
    path: &RelativePath,
    before: &DirectorySnapshot,
    unknown: &mut Vec<RelativePath>,
) -> Result<(), String> {
    let proof = source::capture_missing(root, path).map_err(|e| e.to_string())?;
    if !proof.matches_journaled_parent_of_directory(before, &[], &[]) {
        return Err("original parent chain changed before directory recovery".into());
    }
    // mkdir followed by open cannot prove that the observed directory
    // belongs to this transaction. Never restore children into it.
    let result = source::create_directory_exclusive(
        root,
        &proof,
        source::CreateMode::Exact(super::super::exact_mode(before.identity.mode)),
    );
    if result.is_ok() || matches!(&result, Err(e) if e.effect == source::CreateEffect::Unknown) {
        unknown.push(path.clone());
    }
    match result {
        Ok(_) => {
            Err("recreated directory ownership is unknown; verified file backups retained".into())
        }
        Err(e) => Err(e.error.to_string()),
    }
}

// A restored resource must match its handle, original bytes/mode, and held parent chain.
fn restored_file_matches(
    root: &Root,
    before: &SourceSnapshot,
    proof: &source::MissingProof,
    handle: &std::fs::File,
) -> bool {
    matches!((file(root, &before.path), source::identity_from_handle(handle)),
        (Ok(ExpectedFile::Present(current)), Ok(identity))
            if current.identity == identity
                && current.bytes == before.bytes
                && current.identity.mode == before.identity.mode
                && proof.matches_parent_of(&current))
}
