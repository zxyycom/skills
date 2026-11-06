//! One conditional publication attempt owns the lock and its cleanup evidence.
use super::*;

pub(super) struct PublicationAttempt<'a> {
    root: &'a Path,
    expected_head: Option<&'a str>,
    expected: &'a ContentSnapshot,
    targets: BTreeMap<PathBuf, Option<PendingFile>>,
    index: PathBuf,
    parent_root: crate::source::Root,
    lock: PathBuf,
    lock_file: File,
    alternate: AlternateIndex,
    pub published: bool,
    lock_published: bool,
    committed_paths: Option<Vec<PathBuf>>,
}

impl<'a> PublicationAttempt<'a> {
    pub fn open(
        root: &'a Path,
        expected_head: Option<&'a str>,
        expected: &'a ContentSnapshot,
        updates: &[PendingUpdate],
    ) -> Result<Self, ReplacementFailure> {
        if root.canonicalize().map_err(operation)? != expected.root {
            return Err(failed(FailureKind::Conflict, "repository root changed"));
        }
        let targets = validate_targets(expected, updates)?;
        let index = index_path(root)?;
        let parent = index
            .parent()
            .ok_or_else(|| failed(FailureKind::Failed, "index parent missing"))?;
        let parent_root = crate::source::open_root(parent).map_err(operation)?;
        let (lock, lock_file) = acquire_lock(&index)?;
        Ok(Self {
            root,
            expected_head,
            expected,
            targets,
            index,
            parent_root,
            lock,
            lock_file,
            alternate: AlternateIndex::default(),
            published: false,
            lock_published: false,
            committed_paths: None,
        })
    }

    /// Prepare under the real lock, prove freshness, then commit or report no change.
    pub fn execute<F>(&mut self, verify_source: F) -> Result<ReplacementResult, ReplacementFailure>
    where
        F: FnOnce() -> Result<(), GuardFailure>,
    {
        let original = read_optional_index(&self.index).map_err(operation)?;
        if !head_matches(self.root, self.expected_head).map_err(operation)?
            || read_selected(self.root, &self.expected.paths).map_err(operation)? != *self.expected
        {
            return Err(failed(FailureKind::Conflict, "HEAD or pending changed"));
        }
        let temp = self
            .alternate
            .prepare(self.root, &self.index, original.as_deref())?;
        let prepared = self
            .alternate
            .build(self.root, &temp, self.expected, &self.targets)?;
        self.verify_under_lock(&original, verify_source)?;
        self.commit(&temp, &original, prepared)
    }

    fn verify_under_lock<F>(
        &self,
        original: &Option<Vec<u8>>,
        verify_source: F,
    ) -> Result<(), ReplacementFailure>
    where
        F: FnOnce() -> Result<(), GuardFailure>,
    {
        let guard = PendingGuard {
            root: self.root,
            index: &self.index,
            expected_head: self.expected_head,
            expected: self.expected,
            original,
        };
        guard.check("HEAD or pending changed before publication")?;
        verify_source().map_err(|error| match error {
            GuardFailure::Conflict => failed(FailureKind::Conflict, "source changed under lock"),
            GuardFailure::Failed => {
                failed(FailureKind::Failed, "source verification failed under lock")
            }
        })?;
        let parent = self.index.parent().expect("validated index parent");
        let fresh = crate::source::open_root(parent).map_err(operation)?;
        if fresh.identity().device != self.parent_root.identity().device
            || fresh.identity().inode != self.parent_root.identity().inode
        {
            return Err(failed(
                FailureKind::Conflict,
                "Git index directory identity changed",
            ));
        }
        guard.check("HEAD or pending changed during source verification")
    }

    fn commit(
        &mut self,
        temp: &Path,
        original: &Option<Vec<u8>>,
        prepared: PreparedIndex,
    ) -> Result<ReplacementResult, ReplacementFailure> {
        let PreparedIndex { observed, changed } = prepared;
        if changed.is_empty() {
            return Ok(ReplacementResult {
                changed_paths: changed,
                pending_after: observed.membership.clone(),
            });
        }
        let bytes = read_regular(temp).map_err(operation)?;
        write_verified_lock(&mut self.lock_file, &self.lock, &bytes)?;
        if let Err(error) = fs::rename(&self.lock, &self.index) {
            if read_optional_index(&self.index).ok().as_ref() != Some(original) {
                self.published = true;
                return Err(failed(
                    FailureKind::CommittedUnverified,
                    "rename failed and index state is unknown",
                ));
            }
            return Err(operation(error));
        }
        self.published = true;
        self.lock_published = true;
        self.committed_paths = Some(changed.clone());
        let pending_after = self.readback(&observed)?;
        Ok(ReplacementResult {
            changed_paths: changed,
            pending_after,
        })
    }

    /// Verify both pending contents and HEAD after the irreversible rename.
    fn readback(
        &self,
        observed: &ContentSnapshot,
    ) -> Result<super::super::PendingSnapshot, ReplacementFailure> {
        let current = read_selected(self.root, &self.expected.paths).map_err(|_| {
            failed(
                FailureKind::CommittedUnverified,
                "published index readback failed",
            )
        })?;
        if current != *observed
            || !head_matches(self.root, self.expected_head).map_err(|_| {
                failed(
                    FailureKind::CommittedUnverified,
                    "published HEAD readback failed",
                )
            })?
        {
            return Err(failed(
                FailureKind::CommittedUnverified,
                "published index readback mismatch",
            ));
        }
        Ok(current.membership.clone())
    }

    pub fn finish(
        self,
        result: Result<ReplacementResult, ReplacementFailure>,
    ) -> Result<ReplacementResult, ReplacementFailure> {
        OwnedFiles {
            alternate: self.alternate.path,
            alternate_owner: self.alternate.owner,
            lock: &self.lock,
            lock_file: &self.lock_file,
            published: self.published,
            lock_published: self.lock_published,
            committed_paths: self.committed_paths,
        }
        .finish(result)
    }
}

/// Create the cooperative Git lock exclusively; callers own its cleanup.
fn acquire_lock(index: &Path) -> Result<(PathBuf, File), ReplacementFailure> {
    let lock = index.with_file_name(format!(
        "{}.lock",
        index.file_name().unwrap().to_string_lossy()
    ));
    let lock_file = match OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(&lock)
    {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
            return Err(failed(FailureKind::Conflict, "index lock busy"));
        }
        Err(e) => return Err(operation(e)),
    };
    Ok((lock, lock_file))
}
