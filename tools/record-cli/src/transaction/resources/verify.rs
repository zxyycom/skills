//! Resource journal independent verification.
use super::*;

impl Journal {
    pub(super) fn removed_directories(&self) -> Vec<RelativePath> {
        self.entries
            .iter()
            .filter_map(|entry| match entry {
                Actual::RemovedDirectory { path, .. } => Some(path.clone()),
                _ => None,
            })
            .collect()
    }
    pub fn verifies_removed_file(
        &self,
        proof: &source::MissingProof,
        before: &SourceSnapshot,
    ) -> bool {
        proof.matches_journaled_parent_of(before, &[], &self.removed_directories())
    }
    pub fn observed_directories(&self) -> Vec<(RelativePath, source::FileIdentity)> {
        self.entries
            .iter()
            .filter_map(|entry| match entry {
                Actual::CreatedDirectory { path, observed } => {
                    Some((path.clone(), observed.identity.clone()))
                }
                _ => None,
            })
            .collect()
    }
    pub(super) fn check_live(&self, root: &Root) -> Result<(), TxError> {
        for (i, entry) in self.entries.iter().enumerate() {
            if self.entries[i + 1..]
                .iter()
                .any(|later| later.path() == entry.path())
            {
                continue;
            }
            verify_live_entry(root, entry)?;
        }
        Ok(())
    }
    /// `written` contains only independently captured actual transaction writes
    /// from the current phase, never anticipated writes from a plan.
    pub fn verify(&self, root: &Root, written: &[&SourceSnapshot]) -> Result<(), TxError> {
        for (i, entry) in self.entries.iter().enumerate() {
            if self.entries[i + 1..]
                .iter()
                .any(|other| other.path() == entry.path())
            {
                continue;
            }
            self.verify_entry(root, entry, written)?;
        }
        Ok(())
    }
    // Verify the latest actual effect at a path, not its planned intent.
    fn verify_entry(
        &self,
        root: &Root,
        entry: &Actual,
        written: &[&SourceSnapshot],
    ) -> Result<(), TxError> {
        match entry {
            Actual::MovedDirectory {
                source,
                destination,
                before,
                moved,
                ..
            } => moved_tree_still_matches(root, source, destination, before, moved),
            Actual::CreatedFile { snapshot } => {
                if same_current_file(root, snapshot)? {
                    Ok(())
                } else {
                    Err(error("resource-verify", "created file changed"))
                }
            }
            Actual::RemovedFile { before } => self.verify_removed_file(root, before),
            Actual::CreatedDirectory { .. } => self.verify_created_directory(root, entry, written),
            Actual::RemovedDirectory { path, before } => {
                self.verify_removed_directory(root, path, before)
            }
        }
    }
    // Absence must still be rooted in the original file parent chain.
    fn verify_removed_file(&self, root: &Root, before: &SourceSnapshot) -> Result<(), TxError> {
        let proof =
            source::capture_missing(root, &before.path).map_err(|e| error("resource-verify", e))?;
        if !self.verifies_removed_file(&proof, before) {
            return Err(error("resource-verify", "removed file namespace changed"));
        }
        Ok(())
    }
    // A removed directory may only be absent through journaled ancestor removals.
    fn verify_removed_directory(
        &self,
        root: &Root,
        path: &RelativePath,
        before: &DirectorySnapshot,
    ) -> Result<(), TxError> {
        let proof = source::capture_missing(root, path).map_err(|e| error("resource-verify", e))?;
        if !proof.matches_journaled_parent_of_directory(before, &[], &self.removed_directories()) {
            return Err(error(
                "resource-verify",
                "removed directory namespace changed",
            ));
        }
        Ok(())
    }
    fn verify_created_directory(
        &self,
        root: &Root,
        entry: &Actual,
        written: &[&SourceSnapshot],
    ) -> Result<(), TxError> {
        let Actual::CreatedDirectory { path, observed } = entry else {
            unreachable!()
        };
        let tree = source::capture_tree(root, path).map_err(|e| error("resource-verify", e))?;
        let current = directory(root, path)?
            .ok_or_else(|| error("resource-verify", "created directory missing"))?;
        if current.identity != observed.identity || current.parents != observed.parents {
            return Err(error("resource-verify", "created directory changed"));
        }
        for member in tree.entries() {
            let member_path = member.path();
            if !self.accepts_member(member, written) {
                return Err(error(
                    "resource-verify",
                    format!(
                        "unexpected or changed member: {}",
                        member_path.as_path().display()
                    ),
                ));
            }
        }

        Ok(())
    }
    fn accepts_member(&self, member: &source::TreeEntry, written: &[&SourceSnapshot]) -> bool {
        let member_path = match member {
            source::TreeEntry::Directory { path, .. } | source::TreeEntry::File { path, .. } => {
                path
            }
        };
        let expected = self
            .entries
            .iter()
            .rev()
            .find(|candidate| candidate.path() == member_path);
        let matches_resource = match (member, expected) {
            (
                source::TreeEntry::Directory { identity, .. },
                Some(Actual::CreatedDirectory { observed, .. }),
            ) => identity == &observed.identity,
            (
                source::TreeEntry::File {
                    identity, bytes, ..
                },
                Some(Actual::CreatedFile { snapshot }),
            ) => identity == &snapshot.identity && bytes == &snapshot.bytes,
            _ => false,
        };
        let matches_write = match member {
            source::TreeEntry::File {
                identity, bytes, ..
            } => written.iter().any(|snapshot| {
                &snapshot.path == member_path
                    && &snapshot.identity == identity
                    && &snapshot.bytes == bytes
            }),
            source::TreeEntry::Directory { .. } => false,
        };
        matches_resource || matches_write
    }
}

// Protect prior owned effects before a later removal can proceed.
fn verify_live_entry(root: &Root, entry: &Actual) -> Result<(), TxError> {
    match entry {
        Actual::MovedDirectory {
            source,
            destination,
            before,
            moved,
            ..
        } => moved_tree_still_matches(root, source, destination, before, moved),
        Actual::CreatedFile { snapshot } => verify_live_file(root, snapshot),
        Actual::CreatedDirectory { path, observed } => verify_live_directory(root, path, observed),
        _ => Ok(()),
    }
}
fn verify_live_file(root: &Root, snapshot: &SourceSnapshot) -> Result<(), TxError> {
    if !matches!(file(root, &snapshot.path)?, ExpectedFile::Present(current) if current == *snapshot)
    {
        return Err(error(
            "resource-changed",
            "created file changed before removal",
        ));
    }
    Ok(())
}
fn verify_live_directory(
    root: &Root,
    path: &RelativePath,
    observed: &DirectorySnapshot,
) -> Result<(), TxError> {
    if !matches!(directory(root, path)?, Some(current) if current.identity == observed.identity && current.parents == observed.parents)
    {
        return Err(error(
            "resource-changed",
            "created directory changed before removal",
        ));
    }
    Ok(())
}

// Compare the independently captured file with an actual journal snapshot.
fn same_current_file(root: &Root, snapshot: &SourceSnapshot) -> Result<bool, TxError> {
    Ok(
        matches!(file(root, &snapshot.path)?, ExpectedFile::Present(current) if current == *snapshot),
    )
}
