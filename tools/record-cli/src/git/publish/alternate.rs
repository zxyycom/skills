use super::*;

#[derive(Default)]
pub(super) struct AlternateIndex {
    pub path: Option<PathBuf>,
    pub owner: Option<File>,
}
pub(super) struct PreparedIndex {
    pub observed: ContentSnapshot,
    pub changed: Vec<PathBuf>,
}

impl AlternateIndex {
    /// Create a private index and retain its owned handle for cleanup on every path.
    pub fn prepare(
        &mut self,
        root: &Path,
        index: &Path,
        original: Option<&[u8]>,
    ) -> Result<PathBuf, ReplacementFailure> {
        let mut temp_file = self.allocate(index)?;
        self.owner = Some(temp_file.try_clone().map_err(operation)?);
        if let Some(bytes) = original {
            temp_file.write_all(bytes).map_err(operation)?;
        }
        let temp = self.path.as_ref().expect("created alternate index").clone();
        if !same_file(&temp_file, &temp).map_err(operation)? {
            return Err(failed(
                FailureKind::RecoveryFailed,
                "private index identity changed",
            ));
        }
        drop(temp_file);
        if original.is_none() {
            self.initialize_empty(root, &temp)?;
        }
        Ok(temp)
    }

    /// Let Git create the empty alternate and then capture its new identity.
    fn initialize_empty(&mut self, root: &Path, temp: &Path) -> Result<(), ReplacementFailure> {
        self.owner = None;
        fs::remove_file(temp).map_err(operation)?;
        command_index(root, &["read-tree", "--empty"], None, Some(temp)).map_err(operation)?;
        self.owner = Some(open_regular(temp).map_err(operation)?.1);
        Ok(())
    }

    /// Allocate a unique private pathname and record it before any later fallible work.
    fn allocate(&mut self, index: &Path) -> Result<File, ReplacementFailure> {
        for _ in 0..100 {
            let candidate = index.with_file_name(format!(
                "{}.record-cli-{}-{}",
                index.file_name().unwrap().to_string_lossy(),
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed),
            ));
            match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&candidate)
            {
                Ok(file) => {
                    self.path = Some(candidate);
                    return Ok(file);
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(operation(error)),
            }
        }
        Err(failed(FailureKind::Failed, "cannot allocate private index"))
    }

    /// Apply and read back the selected batch without exposing the alternate index.
    pub fn build(
        &mut self,
        root: &Path,
        temp: &Path,
        expected: &ContentSnapshot,
        targets: &BTreeMap<PathBuf, Option<PendingFile>>,
    ) -> Result<PreparedIndex, ReplacementFailure> {
        let oid_length = match command(root, &["rev-parse", "--show-object-format"], None)
            .map_err(operation)?
            .as_slice()
        {
            b"sha1\n" => 40,
            b"sha256\n" => 64,
            _ => return Err(failed(FailureKind::Failed, "unsupported Git object format")),
        };
        let PreparedUpdates {
            wanted,
            changed,
            input,
        } = prepare_updates(root, expected, targets, oid_length)?;
        if !input.is_empty() {
            command_index(
                root,
                &["update-index", "-z", "--index-info"],
                Some(&input),
                Some(temp),
            )
            .map_err(operation)?;
        }
        let (_, verified_temp) = open_regular(temp).map_err(operation)?;
        self.owner = Some(verified_temp);
        let observed = read_selected_index(root, &expected.paths, Some(temp)).map_err(operation)?;
        verify_prepared(&observed, &wanted, targets)?;
        Ok(PreparedIndex { observed, changed })
    }
}
