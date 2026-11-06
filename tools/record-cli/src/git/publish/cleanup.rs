use super::*;

/// Files owned by one publication attempt, plus known commit state.
pub(super) struct OwnedFiles<'a> {
    pub alternate: Option<PathBuf>,
    pub alternate_owner: Option<File>,
    pub lock: &'a Path,
    pub lock_file: &'a File,
    pub published: bool,
    pub lock_published: bool,
    pub committed_paths: Option<Vec<PathBuf>>,
}

impl OwnedFiles<'_> {
    pub fn finish(
        self,
        result: Result<ReplacementResult, ReplacementFailure>,
    ) -> Result<ReplacementResult, ReplacementFailure> {
        // Never remove an unowned lock. Cleanup failure is itself a reported outcome.
        let mut cleanup_failed = self
            .alternate
            .as_ref()
            .is_some_and(|temp| cleanup_alternate(temp, self.alternate_owner.as_ref()));
        if !self.lock_published {
            // Short-circuit: never remove a lock whose identity cannot be proved.
            cleanup_failed |= !same_file(self.lock_file, self.lock).unwrap_or(false)
                || fs::remove_file(self.lock).is_err();
        }
        if cleanup_failed {
            let mut error = failed(
                if self.published && result.is_ok() {
                    FailureKind::CommittedCleanupPending
                } else if self.published {
                    FailureKind::CommittedUnverified
                } else {
                    FailureKind::RecoveryFailed
                },
                "index cleanup or lock ownership failed",
            );
            error.committed_paths = self.committed_paths;
            return Err(error);
        }
        result.map_err(|mut error| {
            error.committed_paths = self.committed_paths;
            error
        })
    }
}

/// Remove only our private index and detect any surviving private Git lock.
fn cleanup_alternate(temp: &Path, owner: Option<&File>) -> bool {
    let index_failed = match fs::symlink_metadata(temp) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Ok(_) if owner.is_some_and(|file| same_file(file, temp).unwrap_or(false)) => {
            fs::remove_file(temp).is_err()
        }
        _ => true,
    };
    let mut temp_lock = temp.as_os_str().to_os_string();
    temp_lock.push(".lock");
    let lock_failed = !matches!(
        fs::symlink_metadata(Path::new(&temp_lock)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound
    );
    index_failed || lock_failed
}
