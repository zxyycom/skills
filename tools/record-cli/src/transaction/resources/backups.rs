//! Resource journal backups responsibility.
use super::*;

impl Journal {
    pub(super) fn ensure_tree_backups(
        &self,
        root: &Root,
        tree: &source::TreeSnapshot,
    ) -> Result<(), TxError> {
        for entry in tree.entries() {
            if let source::TreeEntry::File {
                path,
                identity,
                bytes,
            } = entry
            {
                let backup = self
                    .backups
                    .iter()
                    .find(|item| &item.source == path)
                    .ok_or_else(|| {
                        error("backup-missing", "moved resource has no recovery backup")
                    })?;
                if backup.snapshot.bytes != *bytes
                    || super::super::exact_mode(backup.snapshot.identity.mode)
                        != super::super::exact_mode(identity.mode)
                    || !matches!(file(root, &backup.snapshot.path)?, ExpectedFile::Present(current) if current == backup.snapshot)
                {
                    return Err(error(
                        "backup-changed",
                        "moved resource backup changed before move",
                    ));
                }
            }
        }
        Ok(())
    }
    pub(super) fn ensure_backup(
        &self,
        root: &Root,
        before: &SourceSnapshot,
    ) -> Result<(), TxError> {
        let backup = self
            .backups
            .iter()
            .find(|backup| backup.source == before.path)
            .ok_or_else(|| error("backup-missing", "resource has no recovery backup"))?;
        if !matches!(file(root, &backup.snapshot.path)?, ExpectedFile::Present(current) if current == backup.snapshot)
        {
            return Err(error(
                "backup-changed",
                "resource recovery backup changed before deletion",
            ));
        }
        Ok(())
    }
    pub fn recovery_directories(&self) -> Vec<super::super::RecoveryDirectory> {
        let mut result: Vec<_> = self
            .uncertain_moves
            .iter()
            .flatten()
            .map(|entry| super::super::RecoveryDirectory {
                path: entry.path.clone(),
                mode: entry.mode,
            })
            .collect();
        for entry in &self.entries {
            match entry {
                Actual::RemovedDirectory { path, before } => {
                    result.push(super::super::RecoveryDirectory {
                        path: path.clone(),
                        mode: super::super::exact_mode(before.identity.mode),
                    })
                }
                Actual::MovedDirectory { source, moved, .. } => {
                    for item in moved.entries() {
                        if let source::TreeEntry::Directory { path, identity } = item {
                            let relative = path
                                .as_path()
                                .strip_prefix(moved.root().as_path())
                                .expect("tree member under root");
                            let restored = if relative.as_os_str().is_empty() {
                                source.clone()
                            } else {
                                RelativePath::new(source.as_path().join(relative))
                                    .expect("validated tree path")
                            };
                            result.push(super::super::RecoveryDirectory {
                                path: restored,
                                mode: super::super::exact_mode(identity.mode),
                            });
                        }
                    }
                }
                _ => {}
            }
        }
        result
    }
    pub fn retained_backups(
        &self,
        root: &Root,
    ) -> (
        Vec<super::super::RecoveryBackup>,
        Vec<String>,
        Vec<RelativePath>,
    ) {
        let mut retained = Vec::new();
        let mut errors = Vec::new();
        let mut unknown = Vec::new();
        for backup in &self.backups {
            match file(root, &backup.snapshot.path) {
                Ok(ExpectedFile::Present(current)) if current == backup.snapshot => {
                    retained.push(super::super::RecoveryBackup {
                        source: backup.source.clone(),
                        backup: backup.snapshot.path.clone(),
                        mode: super::super::exact_mode(backup.snapshot.identity.mode),
                    })
                }
                _ => {
                    errors.push(format!(
                        "recovery backup changed or is unreadable: {}",
                        backup.snapshot.path.as_path().display()
                    ));
                    unknown.push(backup.snapshot.path.clone());
                }
            }
        }
        (retained, errors, unknown)
    }
    pub fn cleanup_backups(&mut self, root: &Root) -> (Vec<String>, Vec<RelativePath>) {
        let mut errors = Vec::new();
        let mut unknown = Vec::new();
        self.backups.retain(
            |backup| match source::remove_if_matches(root, &backup.snapshot) {
                Ok(()) => false,
                Err(error) => {
                    if error.effect == source::RemoveEffect::Unknown {
                        unknown.push(backup.snapshot.path.clone());
                    }
                    errors.push(format!(
                        "{}: {}",
                        backup.snapshot.path.as_path().display(),
                        error.error
                    ));
                    true
                }
            },
        );
        (errors, unknown)
    }
}
