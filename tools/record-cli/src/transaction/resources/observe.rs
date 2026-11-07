//! Resource observe phase.
use super::*;

impl<'a> Resources<'a> {
    pub fn prepare(root: &Root, intents: &'a [ResourceIntent]) -> Result<Self, TxError> {
        let mut observations = Vec::new();
        for intent in intents {
            let mut observation = observe_intent(root, intent)?;
            let valid = valid_observation(intent, &observation);
            if !valid {
                return Err(error(
                    "resource-plan",
                    "resource source or destination state is invalid",
                ));
            }
            let target = creation_target(intent);
            if let Some(path) = target {
                observation.missing = Some(
                    source::capture_missing(root, path)
                        .map_err(|e| error("resource-missing", e))?,
                );
            }
            observations.push(observation);
        }
        Ok(Self {
            intents,
            observations,
        })
    }
    /// Reject hard-linked files that would appear more than once in the write set.
    pub fn reject_write_aliases<T>(
        &self,
        root: &Root,
        plan: &super::super::Plan<T>,
    ) -> Result<(), TxError> {
        let mut identities = std::collections::HashSet::new();
        for write in &plan.writes {
            reject_alias(root, &write.path, &mut identities)?;
        }
        for (intent, observed) in self.intents.iter().zip(&self.observations) {
            match intent {
                ResourceIntent::MoveDirectory { .. } => {
                    for entry in observed.tree.as_ref().expect("move tree").entries() {
                        if let source::TreeEntry::File { path, .. } = entry {
                            reject_alias(root, path, &mut identities)?;
                        }
                    }
                }
                ResourceIntent::RemoveFile { path } => {
                    reject_alias(root, path, &mut identities)?;
                }
                _ => {}
            }
        }
        Ok(())
    }
    pub fn fresh(&self, root: &Root) -> Result<(), TxError> {
        for (intent, before) in self.intents.iter().zip(&self.observations) {
            let equal = matches_observation(root, intent, before)?;
            if !equal {
                return Err(error("resource-changed", "resource changed during fresh"));
            }
            if let Some(before) = &before.missing {
                let path = creation_target(intent).expect("prepared missing target");
                let current = source::capture_missing(root, path)
                    .map_err(|e| error("resource-missing", e))?;
                if !before.equivalent(&current) {
                    return Err(error(
                        "resource-changed",
                        "missing namespace changed during fresh",
                    ));
                }
            }
        }
        Ok(())
    }
    /// Before discarding backups after a failed/no-op transaction, independently
    /// prove that every move source is still the original complete tree.
    pub fn verify_move_originals(&self, root: &Root) -> Result<(), TxError> {
        for (intent, before) in self.intents.iter().zip(&self.observations) {
            if let ResourceIntent::MoveDirectory { source, .. } = intent
                && (directory(root, source)? != before.directory
                    || !same_tree(
                        before.tree.as_ref().expect("prepared move tree"),
                        &source::capture_tree(root, source)
                            .map_err(|e| error("resource-recovery-verify", e))?,
                    ))
            {
                return Err(error(
                    "resource-recovery-verify",
                    format!(
                        "original owner tree changed: {}",
                        source.as_path().display()
                    ),
                ));
            }
        }
        Ok(())
    }
    pub fn verify_sources(&self, root: &Root) -> Result<(), TxError> {
        for (intent, before) in self.intents.iter().zip(&self.observations) {
            self.verify_source(root, intent, before)?;
        }
        Ok(())
    }
    // Unremoved resource sources remain protected after the resource phase.
    fn verify_source(
        &self,
        root: &Root,
        intent: &ResourceIntent,
        before: &Observation,
    ) -> Result<(), TxError> {
        if self.source_will_be_removed(intent) {
            return Ok(());
        }
        match intent {
            ResourceIntent::CreateDirectoryFrom { source, .. }
                if !same_directory(
                    directory(root, source)?.as_ref(),
                    before.directory.as_ref(),
                ) =>
            {
                Err(error(
                    "resource-verify",
                    format!("source directory changed: {}", source.as_path().display()),
                ))
            }
            ResourceIntent::CopyFile { source, .. }
                if !file_matches(root, source, before.file.as_ref())? =>
            {
                Err(error(
                    "resource-verify",
                    format!("copy source changed: {}", source.as_path().display()),
                ))
            }
            _ => Ok(()),
        }
    }
    // Only an explicit removal of this same source exempts it from readback.
    fn source_will_be_removed(&self, intent: &ResourceIntent) -> bool {
        self.intents
            .iter()
            .any(|candidate| match (intent, candidate) {
                (
                    ResourceIntent::CreateDirectoryFrom { source, .. },
                    ResourceIntent::RemoveDirectory { path },
                ) => source == path,
                (ResourceIntent::CopyFile { source, .. }, ResourceIntent::RemoveFile { path }) => {
                    source == path
                }
                _ => false,
            })
    }
}

// Capture and validate the exact resource facts independently of the later fresh pass.
fn observe_intent(root: &Root, intent: &ResourceIntent) -> Result<Observation, TxError> {
    match intent {
        ResourceIntent::CreateDirectory { path } | ResourceIntent::RemoveDirectory { path } => {
            observe_directory(root, path)
        }
        ResourceIntent::MoveDirectory {
            source,
            destination,
        } => observe_move(root, source, destination),
        ResourceIntent::CreateDirectoryFrom {
            source,
            destination,
        } => observe_directory_copy(root, source, destination),
        ResourceIntent::CopyFile {
            source,
            destination,
        } => observe_file_copy(root, source, destination),
        ResourceIntent::RemoveFile { path } => observe_removal(root, path),
    }
}
// A directory fact reads only its identity and direct members.
fn observe_directory(root: &Root, path: &RelativePath) -> Result<Observation, TxError> {
    Ok(Observation {
        directory: directory(root, path)?,
        ..Observation::default()
    })
}
// A move also binds the complete source tree before any resource write.
fn observe_move(
    root: &Root,
    source_path: &RelativePath,
    destination: &RelativePath,
) -> Result<Observation, TxError> {
    if directory(root, destination)?.is_some() {
        return Err(error("resource-plan", "move destination exists"));
    }
    Ok(Observation {
        directory: directory(root, source_path)?,
        tree: Some(source::capture_tree(root, source_path).map_err(|e| error("resource-tree", e))?),
        ..Observation::default()
    })
}
fn observe_directory_copy(
    root: &Root,
    source: &RelativePath,
    destination: &RelativePath,
) -> Result<Observation, TxError> {
    if directory(root, destination)?.is_some() {
        return Err(error("resource-plan", "directory destination exists"));
    }
    observe_directory(root, source)
}
fn observe_file_copy(
    root: &Root,
    source: &RelativePath,
    destination: &RelativePath,
) -> Result<Observation, TxError> {
    Ok(Observation {
        file: Some(file(root, source)?),
        destination: Some(file(root, destination)?),
        ..Observation::default()
    })
}
fn observe_removal(root: &Root, path: &RelativePath) -> Result<Observation, TxError> {
    Ok(Observation {
        file: Some(file(root, path)?),
        ..Observation::default()
    })
}
fn valid_observation(intent: &ResourceIntent, observation: &Observation) -> bool {
    match intent {
        ResourceIntent::CreateDirectory { .. } => observation.directory.is_none(),
        ResourceIntent::RemoveDirectory { .. }
        | ResourceIntent::CreateDirectoryFrom { .. }
        | ResourceIntent::MoveDirectory { .. } => observation.directory.is_some(),
        ResourceIntent::CopyFile { .. } => {
            matches!(&observation.file, Some(ExpectedFile::Present(_)))
                && matches!(&observation.destination, Some(ExpectedFile::Missing))
        }
        ResourceIntent::RemoveFile { .. } => {
            matches!(&observation.file, Some(ExpectedFile::Present(_)))
        }
    }
}
fn creation_target(intent: &ResourceIntent) -> Option<&RelativePath> {
    match intent {
        ResourceIntent::CreateDirectory { path } => Some(path),
        ResourceIntent::CopyFile { destination, .. }
        | ResourceIntent::CreateDirectoryFrom { destination, .. }
        | ResourceIntent::MoveDirectory { destination, .. } => Some(destination),
        _ => None,
    }
}
fn matches_observation(
    root: &Root,
    intent: &ResourceIntent,
    before: &Observation,
) -> Result<bool, TxError> {
    match intent {
        ResourceIntent::CreateDirectory { path } | ResourceIntent::RemoveDirectory { path } => Ok(
            same_directory(directory(root, path)?.as_ref(), before.directory.as_ref()),
        ),
        ResourceIntent::MoveDirectory {
            source,
            destination,
        } => {
            if !same_source_and_missing_destination(root, source, destination, before)? {
                return Ok(false);
            }
            same_move_tree(root, source, before)
        }
        ResourceIntent::CreateDirectoryFrom {
            source,
            destination,
        } => same_source_and_missing_destination(root, source, destination, before),
        ResourceIntent::CopyFile {
            source,
            destination,
        } => same_copy_files(root, source, destination, before),
        ResourceIntent::RemoveFile { path } => file_matches(root, path, before.file.as_ref()),
    }
}

// Both directory-copy and tree-move freshness require this same namespace fact.
fn same_source_and_missing_destination(
    root: &Root,
    source: &RelativePath,
    destination: &RelativePath,
    before: &Observation,
) -> Result<bool, TxError> {
    Ok(
        same_directory(directory(root, source)?.as_ref(), before.directory.as_ref())
            && directory(root, destination)?.is_none(),
    )
}

// Move freshness includes the full source tree, not just its directory identity.
fn same_move_tree(
    root: &Root,
    source: &RelativePath,
    before: &Observation,
) -> Result<bool, TxError> {
    let current = source::capture_tree(root, source).map_err(|e| error("resource-tree", e))?;
    Ok(same_tree(
        before.tree.as_ref().expect("move tree"),
        &current,
    ))
}
// Copy freshness compares both actual endpoint observations.
fn same_copy_files(
    root: &Root,
    source: &RelativePath,
    destination: &RelativePath,
    before: &Observation,
) -> Result<bool, TxError> {
    let source_file = file(root, source)?;
    let destination_file = file(root, destination)?;
    Ok(before
        .file
        .as_ref()
        .is_some_and(|expected| source::equivalent_file(&source_file, expected))
        && before
            .destination
            .as_ref()
            .is_some_and(|expected| source::equivalent_file(&destination_file, expected)))
}

fn file_matches(
    root: &Root,
    path: &RelativePath,
    expected: Option<&ExpectedFile>,
) -> Result<bool, TxError> {
    let current = file(root, path)?;
    Ok(expected.is_some_and(|value| source::equivalent_file(&current, value)))
}

fn reject_alias(
    root: &Root,
    path: &RelativePath,
    identities: &mut std::collections::HashSet<(u64, u64)>,
) -> Result<(), TxError> {
    if let Some(identity) =
        source::file_identity(root, path).map_err(|e| error("resource-alias", e))?
        && !identities.insert((identity.device, identity.inode))
    {
        return Err(error("resource-alias", "aliased files in write set"));
    }
    Ok(())
}
