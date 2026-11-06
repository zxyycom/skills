//! Execute resource intents and journal only independently observed effects.
use super::*;

impl Resources<'_> {
    pub fn execute(&self, root: &Root, journal: &mut Journal) -> Result<(), TxError> {
        for (intent, observed) in self.intents.iter().zip(&self.observations) {
            let mut action = ResourceAction {
                root,
                journal,
                observed,
            };
            match intent {
                ResourceIntent::MoveDirectory {
                    source,
                    destination,
                } => action.move_directory(source, destination),
                ResourceIntent::CreateDirectory { .. }
                | ResourceIntent::CreateDirectoryFrom { .. } => action.create_directory(intent),
                ResourceIntent::CopyFile {
                    source,
                    destination,
                } => action.copy_file(source, destination),
                ResourceIntent::RemoveFile { path } => action.remove_file(path),
                ResourceIntent::RemoveDirectory { path } => action.remove_directory(path),
            }?;
        }
        Ok(())
    }
}
struct ResourceAction<'a> {
    root: &'a Root,
    journal: &'a mut Journal,
    observed: &'a Observation,
}
impl ResourceAction<'_> {
    fn move_directory(
        &mut self,
        old: &RelativePath,
        destination: &RelativePath,
    ) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            observed,
        } = self;

        let tree = observed.tree.as_ref().expect("prepared move tree");
        let proof = recheck_move(root, old, destination, observed)?;
        journal.ensure_tree_backups(root, tree)?;
        let receipt = source::move_directory(root, tree, &proof).map_err(|failure| {
            if failure.effect == source::MoveDirectoryEffect::Unknown {
                journal.mark_unknown_move(old, destination, tree);
            }
            error("resource-move", failure.error)
        })?;
        journal.changed.push(old.clone());
        journal.changed.push(destination.clone());
        let moved = verify_moved_tree(root, destination, tree)
            .inspect_err(|_| journal.mark_unknown_move(old, destination, tree))?;
        let before = observed
            .directory
            .as_ref()
            .expect("prepared source directory")
            .clone();
        journal.entries.push(Actual::MovedDirectory {
            source: old.clone(),
            destination: destination.clone(),
            before: Box::new(before),
            destination_before: Box::new(proof),
            moved: Box::new(moved),
            receipt: Box::new(receipt),
        });

        Ok(())
    }
    fn create_directory(&mut self, intent: &ResourceIntent) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            observed,
        } = self;

        let (path, mode) = directory_creation_spec(root, observed, intent)?;
        let proof =
            source::capture_missing(root, path).map_err(|e| error("resource-missing", e))?;
        if !observed
            .missing
            .as_ref()
            .expect("missing proof")
            .extends(&proof, &journal.observed_directories())
        {
            return Err(error("resource-changed", "destination namespace changed"));
        }
        let created = source::create_directory_exclusive(root, &proof, mode).map_err(|e| {
            if e.effect == source::CreateEffect::Unknown {
                journal.unknown.push(path.clone());
            }
            error("resource-mkdir", e.error)
        })?;
        journal.changed.push(path.clone());
        let actual = observe_created_directory(root, path, &created, mode)
            .inspect_err(|_| journal.unknown.push(path.clone()))?;
        journal.entries.push(Actual::CreatedDirectory {
            path: path.clone(),
            observed: actual,
        });

        Ok(())
    }
    fn copy_file(
        &mut self,
        path: &RelativePath,
        destination: &RelativePath,
    ) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            observed,
        } = self;

        let Some(ExpectedFile::Present(before)) = &observed.file else {
            return Err(error("resource-plan", "copy source missing"));
        };
        if !matches!(&observed.destination, Some(ExpectedFile::Missing)) {
            return Err(error("resource-plan", "copy destination exists"));
        }
        if !matches!(file(root, path)?, ExpectedFile::Present(current) if current == *before) {
            return Err(error("resource-changed", "copy source changed"));
        }
        let proof =
            source::capture_missing(root, destination).map_err(|e| error("resource-missing", e))?;
        if !observed
            .missing
            .as_ref()
            .expect("missing proof")
            .extends(&proof, &journal.observed_directories())
        {
            return Err(error("resource-changed", "destination namespace changed"));
        }
        let mode = source::CreateMode::Exact(super::super::exact_mode(before.identity.mode));
        let created = source::create_exclusive(root, &proof, mode).map_err(|e| {
            if e.effect == source::CreateEffect::Unknown {
                journal.unknown.push(destination.clone());
            }
            error("resource-create", e.error)
        })?;
        journal.changed.push(destination.clone());
        let snapshot = populate_copy(root, destination, before, created, mode)
            .inspect_err(|_| journal.unknown.push(destination.clone()))?;
        journal.entries.push(Actual::CreatedFile { snapshot });

        Ok(())
    }
    fn remove_file(&mut self, path: &RelativePath) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            observed,
        } = self;

        journal.check_live(root)?;
        let Some(ExpectedFile::Present(before)) = &observed.file else {
            return Err(error("resource-plan", "remove source missing"));
        };
        journal.ensure_backup(root, before)?;
        source::remove_if_matches(root, before).map_err(|e| {
            if e.effect == source::RemoveEffect::Unknown {
                journal.unknown.push(path.clone());
            }
            error("resource-remove", e.error)
        })?;
        journal.changed.push(path.clone());
        let ExpectedFile::Present(before) = file_snapshot_from_observation(before) else {
            unreachable!()
        };
        journal.entries.push(Actual::RemovedFile { before });

        Ok(())
    }
    fn remove_directory(&mut self, path: &RelativePath) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            observed,
        } = self;

        journal.check_live(root)?;
        let Some(before) = &observed.directory else {
            return Err(error("resource-plan", "remove directory missing"));
        };
        let current =
            directory(root, path)?.ok_or_else(|| error("resource-changed", "directory missing"))?;
        if current.identity != before.identity
            || current.parents != before.parents
            || !current.members.is_empty()
        {
            return Err(error("resource-changed", "directory changed or not empty"));
        }
        source::remove_empty_directory(root, &current).map_err(|e| {
            if e.effect == source::RemoveEffect::Unknown {
                journal.unknown.push(path.clone());
            }
            error("resource-rmdir", e.error)
        })?;
        journal.changed.push(path.clone());
        journal.entries.push(Actual::RemovedDirectory {
            path: path.clone(),
            before: current,
        });

        Ok(())
    }
}

fn directory_creation_spec<'a>(
    root: &Root,
    observed: &Observation,
    intent: &'a ResourceIntent,
) -> Result<(&'a RelativePath, source::CreateMode), TxError> {
    match intent {
        ResourceIntent::CreateDirectory { path } => {
            if observed.directory.is_some() {
                return Err(error("resource-plan", "directory destination exists"));
            }
            Ok((path, source::CreateMode::Native(0o777)))
        }
        ResourceIntent::CreateDirectoryFrom {
            source,
            destination,
        } => {
            let before = observed
                .directory
                .as_ref()
                .ok_or_else(|| error("resource-plan", "source directory missing"))?;
            if directory(root, source)?.as_ref() != Some(before) {
                return Err(error("resource-changed", "source directory changed"));
            }
            Ok((
                destination,
                source::CreateMode::Exact(super::super::exact_mode(before.identity.mode)),
            ))
        }
        _ => unreachable!(),
    }
}

// A later handle observation is not proof that mkdir owned the observed object.
fn observe_created_directory(
    root: &Root,
    path: &RelativePath,
    created: &source::CreatedDirectory,
    mode: source::CreateMode,
) -> Result<DirectorySnapshot, TxError> {
    // Handle identity is only a later observation, not proof of mkdir ownership.
    let actual = match directory(root, path) {
        Ok(Some(actual)) => actual,
        Ok(None) => {
            return Err(error("resource-readback", "created directory missing"));
        }
        Err(e) => {
            return Err(e);
        }
    };
    let handle_identity =
        source::identity_from_handle(&created.handle).map_err(|e| error("resource-readback", e))?;
    if matches!(mode, source::CreateMode::Exact(bits) if super::super::exact_mode(actual.identity.mode) != bits)
        || actual.identity.device != created.identity.device
        || actual.identity.inode != created.identity.inode
        || !actual.identity.same_identity_and_mode(&handle_identity)
    {
        return Err(error("resource-readback", "directory identity changed"));
    }
    Ok(actual)
}

// An exclusive copy remains unknown until content, mode and handle identity read back.
fn populate_copy(
    root: &Root,
    destination: &RelativePath,
    before: &SourceSnapshot,
    created: source::CreatedFile,
    mode: source::CreateMode,
) -> Result<SourceSnapshot, TxError> {
    let mut handle = created.file;
    if let Err(e) = super::super::write_synced(&mut handle, &before.bytes) {
        return Err(error("resource-write", e));
    }
    if let Err(e) = source::finalize_created_mode(&handle, mode)
        .and_then(|_| handle.sync_all().map_err(Into::into))
    {
        return Err(error("resource-mode", e));
    }
    let captured = file(root, destination)?;
    let ExpectedFile::Present(snapshot) = captured else {
        return Err(error("resource-readback", "copy missing"));
    };
    let id = source::identity_from_handle(&handle).map_err(|e| error("resource-readback", e))?;
    if snapshot.identity != id
        || id.device != created.identity.device
        || id.inode != created.identity.inode
        || snapshot.bytes != before.bytes
    {
        return Err(error("resource-readback", "copy differs from handle"));
    }
    Ok(snapshot)
}

// Recheck both selected source tree and missing destination immediately before the move.
fn recheck_move(
    root: &Root,
    old: &RelativePath,
    destination: &RelativePath,
    observed: &Observation,
) -> Result<source::MissingProof, TxError> {
    let tree = observed.tree.as_ref().expect("prepared move tree");
    let proof =
        source::capture_missing(root, destination).map_err(|e| error("resource-missing", e))?;
    if !observed
        .missing
        .as_ref()
        .expect("prepared missing proof")
        .equivalent(&proof)
    {
        return Err(error(
            "resource-changed",
            "move destination namespace changed",
        ));
    }
    if directory(root, old)?.as_ref() != observed.directory.as_ref()
        || !same_tree(
            tree,
            &source::capture_tree(root, old).map_err(|e| error("resource-tree", e))?,
        )
    {
        return Err(error("resource-changed", "move source changed"));
    }
    Ok(proof)
}

impl Journal {
    // An unprovable move preserves both names and the original tree's recovery facts.
    fn mark_unknown_move(
        &mut self,
        old: &RelativePath,
        destination: &RelativePath,
        tree: &source::TreeSnapshot,
    ) {
        self.unknown.push(old.clone());
        self.unknown.push(destination.clone());
        self.uncertain_moves.push(recovery_dirs_from_tree(tree));
    }
}

// Independently re-read the entire moved tree before recording its receipt.
fn verify_moved_tree(
    root: &Root,
    destination: &RelativePath,
    original: &source::TreeSnapshot,
) -> Result<source::TreeSnapshot, TxError> {
    source::capture_tree(root, destination)
        .ok()
        .filter(|moved| same_tree(original, moved))
        .ok_or_else(|| {
            error(
                "resource-move-readback",
                "moved tree could not be independently verified",
            )
        })
}
