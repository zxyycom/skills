//! Resource backup phase.
use super::*;

impl<'a> Resources<'a> {
    /// Persist a separately verified file-level copy before any resource deletion.
    pub fn backup_removals(
        &self,
        root: &Root,
        journal: &mut Journal,
        reserved: &std::collections::HashSet<RelativePath>,
    ) -> Result<(), TxError> {
        let sources = self.backup_sources()?;
        for before in sources {
            let path = &before.path;
            if journal.backups.iter().any(|backup| &backup.source == path) {
                continue;
            }
            if !matches!(file(root, path)?, ExpectedFile::Present(current) if source::same_content_and_mode(&current, before))
            {
                return Err(error(
                    "backup-source-changed",
                    "resource changed before backup",
                ));
            }
            let (path, proof) = reserve_backup_name(root, reserved)?;
            persist_backup(root, journal, before, path, proof)?;
        }
        Ok(())
    }
    /// Protect old record and index bytes before any destructive ordinary write.
    pub fn backup_writes<T>(
        root: &Root,
        plan: &super::super::Plan<T>,
        journal: &mut Journal,
        reserved: &std::collections::HashSet<RelativePath>,
    ) -> Result<(), TxError> {
        for write in &plan.writes {
            let ExpectedFile::Present(before) = &write.before else {
                continue;
            };
            if write
                .after
                .as_ref()
                .is_some_and(|after| *after == before.bytes)
            {
                continue;
            }
            if !matches!(file(root, &before.path)?, ExpectedFile::Present(current) if source::same_content_and_mode(&current, before))
            {
                return Err(error(
                    "backup-source-changed",
                    "source changed before backup",
                ));
            }
            let (path, proof) = reserve_backup_name(root, reserved)?;
            persist_backup(root, journal, before, path, proof)?;
        }
        Ok(())
    }
    fn backup_sources(&self) -> Result<Vec<&SourceSnapshot>, TxError> {
        let mut sources = Vec::new();
        for (intent, observed) in self.intents.iter().zip(&self.observations) {
            if let ResourceIntent::RemoveFile { .. } = intent {
                let Some(ExpectedFile::Present(before)) = &observed.file else {
                    return Err(error("backup-plan", "resource file missing"));
                };
                sources.push(before);
            }
        }
        Ok(sources)
    }
}

// Allocate only a proven-missing, unreserved backup name; creation remains exclusive.
fn reserve_backup_name(
    root: &Root,
    reserved: &std::collections::HashSet<RelativePath>,
) -> Result<(RelativePath, source::MissingProof), TxError> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let mut selected = None;
    for _ in 0..1024 {
        let sequence = NEXT.fetch_add(1, Ordering::Relaxed);
        let name = format!(".record-cli-recovery-{}-{sequence}.bak", std::process::id());
        let candidate = RelativePath::new(name).map_err(|e| error("backup-path", e))?;
        if reserved.contains(&candidate) {
            continue;
        }
        match source::capture_missing(root, &candidate) {
            Ok(proof) => {
                selected = Some((candidate, proof));
                break;
            }
            Err(SourceError::Changed(_)) => continue,
            Err(e) => return Err(error("backup-path", e)),
        }
    }
    let (path, proof) =
        selected.ok_or_else(|| error("backup-path", "cannot allocate a unique recovery file"))?;
    Ok((path, proof))
}

// Keep a newly created backup unknown until bytes, mode and identity are re-read.
fn persist_backup(
    root: &Root,
    journal: &mut Journal,
    before: &SourceSnapshot,
    path: RelativePath,
    proof: source::MissingProof,
) -> Result<(), TxError> {
    let mode = source::CreateMode::Exact(super::super::exact_mode(before.identity.mode));
    let created = source::create_exclusive(root, &proof, mode).map_err(|e| {
        if e.effect == source::CreateEffect::Unknown {
            journal.unknown.push(path.clone());
        }
        error("backup-create", e.error)
    })?;
    let mut handle = created.file;
    // After creation any write or readback failure is an unknown artifact.
    journal.unknown.push(path.clone());
    super::super::write_synced(&mut handle, &before.bytes).map_err(|e| error("backup-write", e))?;
    source::finalize_created_mode(&handle, mode)
        .and_then(|_| handle.sync_all().map_err(Into::into))
        .map_err(|e| error("backup-mode", e))?;
    let snapshot = verify_backup(root, &path, before, &created.identity, &handle)?;
    journal.unknown.pop();
    journal.backups.push(Backup {
        source: before.path.clone(),
        snapshot,
    });
    Ok(())
}

// Verify the durable copy against both the opened handle and original representation.
fn verify_backup(
    root: &Root,
    path: &RelativePath,
    before: &SourceSnapshot,
    created_identity: &source::FileIdentity,
    handle: &std::fs::File,
) -> Result<SourceSnapshot, TxError> {
    let ExpectedFile::Present(snapshot) = file(root, path)? else {
        return Err(error("backup-readback", "backup missing"));
    };
    let id = source::identity_from_handle(handle).map_err(|e| error("backup-readback", e))?;
    if snapshot.identity != id
        || id.device != created_identity.device
        || id.inode != created_identity.inode
        || snapshot.bytes != before.bytes
        || snapshot.identity.mode != before.identity.mode
    {
        return Err(error(
            "backup-readback",
            "backup bytes, mode or identity changed",
        ));
    }
    Ok(snapshot)
}
