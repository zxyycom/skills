//! Resource journal backups responsibility.
use super::*;

impl Journal {
    pub(in crate::transaction) fn ensure_backup(
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
        let mut result = Vec::new();
        for entry in &self.entries {
            if let Actual::RemovedDirectory { path, before } = entry {
                result.push(super::super::RecoveryDirectory {
                    path: path.clone(),
                    mode: super::super::exact_mode(before.identity.mode),
                });
            }
        }
        result
    }
    pub fn retained_backups(
        &self,
        root: &Root,
        include_move_copies: bool,
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
        if include_move_copies {
            self.collect_move_copies(root, &mut retained, &mut errors, &mut unknown);
        }
        (retained, errors, unknown)
    }
    fn collect_move_copies(
        &self,
        root: &Root,
        retained: &mut Vec<super::super::RecoveryBackup>,
        errors: &mut Vec<String>,
        unknown: &mut Vec<RelativePath>,
    ) {
        for copy in &self.copied_move_files {
            match file(root, &copy.destination) {
                Ok(ExpectedFile::Present(current))
                    if current.bytes == copy.bytes
                        && super::super::exact_mode(current.identity.mode) == copy.mode =>
                {
                    retained.push(super::super::RecoveryBackup {
                        source: copy.source.clone(),
                        backup: copy.destination.clone(),
                        mode: copy.mode,
                    })
                }
                _ => {
                    errors.push(format!(
                        "copied resource changed or is unreadable: {}",
                        copy.destination.as_path().display()
                    ));
                    unknown.push(copy.destination.clone());
                }
            }
        }
    }
    pub fn cleanup_backups(&mut self, root: &Root) -> (Vec<String>, Vec<RelativePath>) {
        let mut errors = Vec::new();
        let mut unknown = Vec::new();
        self.backups.retain(
            |backup| match source::remove_if_owned(root, &backup.snapshot) {
                Ok(()) => false,
                Err(error) => {
                    if error.effect != source::RemoveEffect::NotStarted {
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
