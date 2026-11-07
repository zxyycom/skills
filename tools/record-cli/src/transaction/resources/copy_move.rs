//! Copy owner trees exclusively before publication, then retire the old tree.
use super::*;

pub(super) fn prepare(
    root: &Root,
    journal: &mut Journal,
    observed: &Observation,
    old: &RelativePath,
    destination: &RelativePath,
) -> Result<(), TxError> {
    let tree = observed.tree.as_ref().expect("prepared move tree");
    let current = source::capture_tree(root, old).map_err(|e| error("resource-tree", e))?;
    if !same_tree(tree, &current) {
        return Err(error("resource-changed", "source tree changed"));
    }
    let first_entry = journal.entries.len();
    let directories = copy_members(root, journal, tree, old, destination)?;
    settle_directories(root, journal, directories)?;
    refresh_created(root, journal, first_entry)?;
    let copy =
        source::capture_tree(root, destination).map_err(|e| error("resource-readback", e))?;
    if !same_tree(tree, &copy) {
        return Err(error("resource-readback", "copied tree differs"));
    }
    Ok(())
}

fn refresh_directory(
    root: &Root,
    path: &RelativePath,
    observed: &mut DirectorySnapshot,
    unknown: &mut Vec<RelativePath>,
) -> Result<(), TxError> {
    let current =
        directory(root, path)?.ok_or_else(|| error("resource-readback", "directory missing"))?;
    if current.identity.device != observed.identity.device
        || current.identity.inode != observed.identity.inode
        || current.identity.mode != observed.identity.mode
    {
        unknown.push(path.clone());
        return Err(error("resource-readback", "directory changed"));
    }
    *observed = current;
    Ok(())
}

fn copy_members(
    root: &Root,
    journal: &mut Journal,
    tree: &source::TreeSnapshot,
    old: &RelativePath,
    destination: &RelativePath,
) -> Result<Vec<(usize, u32)>, TxError> {
    let mut directories = Vec::new();
    for member in tree.entries() {
        let suffix = member
            .path()
            .as_path()
            .strip_prefix(old.as_path())
            .expect("tree member");
        let target = if suffix.as_os_str().is_empty() {
            destination.clone()
        } else {
            RelativePath::new(destination.as_path().join(suffix))
                .map_err(|e| error("resource-path", e))?
        };
        let proof =
            source::capture_missing(root, &target).map_err(|e| error("resource-missing", e))?;
        let context = CopyMember {
            root,
            journal,
            target,
            proof,
        };
        match member {
            source::TreeEntry::Directory { identity, .. } => {
                context.directory(identity, &mut directories)?
            }
            source::TreeEntry::File {
                path,
                identity,
                bytes,
            } => context.file(path, identity, bytes)?,
        }
    }
    Ok(directories)
}
struct CopyMember<'a> {
    root: &'a Root,
    journal: &'a mut Journal,
    target: RelativePath,
    proof: source::MissingProof,
}
impl CopyMember<'_> {
    fn directory(
        self,
        identity: &source::FileIdentity,
        directories: &mut Vec<(usize, u32)>,
    ) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            target,
            proof,
        } = self;
        let mode = source::CreateMode::Native(0o700);
        let created = source::create_directory_exclusive(root, &proof, mode).map_err(|e| {
            if e.effect == source::CreateEffect::Unknown {
                journal.unknown.push(target.clone());
            }
            error("resource-mkdir", e.error)
        })?;
        journal.changed.push(target.clone());
        let current = directory(root, &target)
            .inspect_err(|_| journal.unknown.push(target.clone()))?
            .ok_or_else(|| {
                journal.unknown.push(target.clone());
                error("resource-readback", "directory missing")
            })?;
        if current.identity.device != created.identity.device
            || current.identity.inode != created.identity.inode
            || super::super::exact_mode(current.identity.mode) != 0o700
        {
            journal.unknown.push(target.clone());
            return Err(error("resource-readback", "directory differs"));
        }
        directories.push((
            journal.entries.len(),
            super::super::exact_mode(identity.mode),
        ));
        journal.entries.push(Actual::CreatedDirectory {
            path: target,
            observed: current,
        });
        Ok(())
    }
    fn file(
        mut self,
        source_path: &RelativePath,
        identity: &source::FileIdentity,
        bytes: &Vec<u8>,
    ) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            target,
            proof,
        } = &mut self;
        let mode = source::CreateMode::Exact(super::super::exact_mode(identity.mode));
        let created = source::create_exclusive(root, proof, mode).map_err(|e| {
            if e.effect == source::CreateEffect::Unknown {
                journal.unknown.push(target.clone());
            }
            error("resource-create", e.error)
        })?;
        journal.changed.push(target.clone());
        let mut handle = created.file;
        let write_result = (|| -> Result<(), SourceError> {
            super::super::write_synced(&mut handle, bytes)?;
            source::finalize_created_mode(&handle, mode)?;
            handle.sync_all()?;
            Ok(())
        })();
        if let Err(e) = write_result {
            journal.unknown.push(target.clone());
            return Err(error("resource-write", e));
        }
        self.verify_file(source_path, identity, bytes, &created.identity)?;
        Ok(())
    }
    fn verify_file(
        self,
        source_path: &RelativePath,
        identity: &source::FileIdentity,
        bytes: &Vec<u8>,
        created: &source::FileIdentity,
    ) -> Result<(), TxError> {
        let Self {
            root,
            journal,
            target,
            ..
        } = self;
        match file(root, &target).inspect_err(|_| journal.unknown.push(target.clone()))? {
            ExpectedFile::Present(snapshot)
                if snapshot.bytes == *bytes
                    && super::super::exact_mode(snapshot.identity.mode)
                        == super::super::exact_mode(identity.mode)
                    && snapshot.identity.device == created.device
                    && snapshot.identity.inode == created.inode =>
            {
                journal.copied_move_files.push(CopiedMoveFile {
                    source: source_path.clone(),
                    destination: target.clone(),
                    bytes: bytes.clone(),
                    mode: super::super::exact_mode(identity.mode),
                });
                journal.entries.push(Actual::CreatedFile { snapshot })
            }
            _ => {
                journal.unknown.push(target);
                return Err(error("resource-readback", "copied file differs"));
            }
        }
        Ok(())
    }
}
fn settle_directories(
    root: &Root,
    journal: &mut Journal,
    directories: Vec<(usize, u32)>,
) -> Result<(), TxError> {
    for (entry_index, mode) in directories.into_iter().rev() {
        settle_directory(root, journal, entry_index, mode)?;
    }
    Ok(())
}
fn settle_directory(
    root: &Root,
    journal: &mut Journal,
    entry_index: usize,
    mode: u32,
) -> Result<(), TxError> {
    let Actual::CreatedDirectory { path, observed } = &mut journal.entries[entry_index] else {
        unreachable!()
    };
    set_directory_mode(root, path, observed, mode, &mut journal.unknown)?;
    *observed = directory(root, path)
        .inspect_err(|_| {
            journal.unknown.push(path.clone());
        })?
        .ok_or_else(|| {
            journal.unknown.push(path.clone());
            error("resource-readback", "directory missing")
        })?;
    if super::super::exact_mode(observed.identity.mode) != mode {
        journal.unknown.push(path.clone());
        return Err(error("resource-readback", "directory mode differs"));
    }
    Ok(())
}
fn set_directory_mode(
    root: &Root,
    path: &RelativePath,
    observed: &DirectorySnapshot,
    mode: u32,
    unknown: &mut Vec<RelativePath>,
) -> Result<(), TxError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let handle = source::open_directory_for_mode(root, path).map_err(|e| {
            unknown.push(path.clone());
            error("resource-mode", e)
        })?;
        let current = source::identity_from_handle(&handle).map_err(|e| {
            unknown.push(path.clone());
            error("resource-mode", e)
        })?;
        if current.device != observed.identity.device || current.inode != observed.identity.inode {
            unknown.push(path.clone());
            return Err(error(
                "resource-changed",
                "created directory changed before mode update",
            ));
        }
        handle
            .set_permissions(std::fs::Permissions::from_mode(mode))
            .map_err(|e| {
                unknown.push(path.clone());
                error("resource-mode", e)
            })?;
    }
    Ok(())
}
fn refresh_created(root: &Root, journal: &mut Journal, first_entry: usize) -> Result<(), TxError> {
    // Parent directory modes have now settled; refresh snapshots without accepting
    // a replaced entry or changed content.
    for entry in &mut journal.entries[first_entry..] {
        match entry {
            Actual::CreatedDirectory { path, observed } => {
                refresh_directory(root, path, observed, &mut journal.unknown)?;
            }
            Actual::CreatedFile { snapshot } => {
                let ExpectedFile::Present(current) = file(root, &snapshot.path)? else {
                    return Err(error("resource-readback", "file missing"));
                };
                if current.identity != snapshot.identity || current.bytes != snapshot.bytes {
                    journal.unknown.push(snapshot.path.clone());
                    return Err(error("resource-readback", "file changed"));
                }
                *snapshot = current;
            }
            _ => unreachable!(),
        }
    }
    Ok(())
}
