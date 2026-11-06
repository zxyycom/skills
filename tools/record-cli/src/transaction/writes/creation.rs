//! Exclusive file creation, initialization, and readback.
use super::*;

// Exclusive creation succeeded, but its bytes and representation still need readback.
struct EstablishedWrite<'a> {
    index: usize,
    write: &'a WriteIntent,
    after: &'a [u8],
    mode: CreateMode,
    created: CreatedFile,
}
impl WriteJournal {
    pub(super) fn create<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        index: usize,
        write: &WriteIntent,
        after: &[u8],
    ) -> Result<(), TxError> {
        let WriteContext {
            root,
            plan,
            outcome,
            resource_journal,
            missing,
            ..
        } = context;
        let mode = match write.mode.as_ref().expect("validated create mode") {
            WriteMode::Exact(bits) => CreateMode::Exact(*bits),
            WriteMode::Native(bits) => CreateMode::Native(*bits),
        };
        let proof = verify_create_namespace(root, &write.path, missing, resource_journal)?;
        let created = create_exclusive(root, &proof, mode).map_err(|error| {
            if error.effect == CreateEffect::Unknown {
                self.unknown = true;
                outcome.unknown_paths.push(write.path.clone());
            }
            TxError::new("create", error.error.to_string())
        })?;
        // Exclusive establishment is the candidate-create commit point,
        // even if populating or verifying its actual handle later fails.
        outcome.changed = true;
        outcome.committed =
            matches!(&plan.commit_point, CommitPoint::Created(path) if *path == write.path);
        outcome.written_paths.push(write.path.clone());
        self.populate_created(
            context,
            EstablishedWrite {
                index,
                write,
                after,
                mode,
                created,
            },
        )
    }
    fn populate_created<T, O: TransactionOperation<T>>(
        &mut self,
        context: &mut WriteContext<'_, '_, T, O>,
        established: EstablishedWrite<'_>,
    ) -> Result<(), TxError> {
        let WriteContext {
            root,
            plan,
            outcome,
            ..
        } = context;
        let EstablishedWrite {
            index,
            write,
            after,
            mode,
            created,
        } = established;
        let mut handle = created.file;
        if let Err(error) = initialize_created(&mut handle, after, mode) {
            self.unknown = true;
            outcome.unknown_paths.push(write.path.clone());
            return Err(error);
        }
        if matches!(&plan.commit_point, CommitPoint::PublishedIndex(path) if *path == write.path) {
            outcome.committed = true;
        }
        match readback_created(root, &write.path, after, &created.identity, &handle) {
            Some(snapshot) => self.entries.push(Entry::Written(index, snapshot)),
            None => {
                self.unknown = true;
                outcome.unknown_paths.push(write.path.clone());
                return Err(TxError::new(
                    "write-readback",
                    format!(
                        "created file could not be verified: {}",
                        write.path.as_path().display()
                    ),
                ));
            }
        }

        Ok(())
    }
}

// Populate, set the representation, and sync before publication can commit.
fn initialize_created(
    handle: &mut std::fs::File,
    after: &[u8],
    mode: CreateMode,
) -> Result<(), TxError> {
    if let Err(error) = write_synced(handle, after) {
        return Err(TxError::new("write-unknown", error.to_string()));
    }
    if let Err(error) =
        finalize_created_mode(handle, mode).and_then(|_| handle.sync_all().map_err(Into::into))
    {
        return Err(TxError::new("create-mode-unknown", error.to_string()));
    }
    Ok(())
}

// An absent name may extend only through journal-observed directory identities.
fn verify_create_namespace(
    root: &Root,
    path: &RelativePath,
    missing: &HashMap<RelativePath, MissingProof>,
    resources: &resources::Journal,
) -> Result<MissingProof, TxError> {
    let proof = match capture_missing(root, path) {
        Ok(proof) => proof,
        Err(error) => {
            return Err(TxError::new("write-missing", error.to_string()));
        }
    };
    if !missing
        .get(path)
        .expect("prepared missing proof")
        .extends(&proof, &resources.observed_directories())
    {
        return Err(TxError::new(
            "source-changed",
            format!("missing namespace changed: {}", path.as_path().display()),
        ));
    }
    Ok(proof)
}

// Bind the created handle and original create identity to the independently read name.
fn readback_created(
    root: &Root,
    path: &RelativePath,
    bytes: &[u8],
    created: &crate::source::FileIdentity,
    handle: &std::fs::File,
) -> Option<crate::source::SourceSnapshot> {
    match (capture(root, path), identity_from_handle(handle)) {
        (Ok(ExpectedFile::Present(snapshot)), Ok(identity))
            if snapshot.identity == identity
                && identity.device == created.device
                && identity.inode == created.inode
                && snapshot.bytes == *bytes =>
        {
            Some(snapshot)
        }
        _ => None,
    }
}
