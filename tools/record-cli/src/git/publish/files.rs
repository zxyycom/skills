use super::*;

pub(super) fn read_optional_index(path: &Path) -> Result<Option<Vec<u8>>, GitError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() => read_regular(path).map(Some),
        Ok(_) => Err(GitError::InvalidOutput("index is not a regular file")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(GitError::Io(error)),
    }
}

pub(super) fn read_regular(path: &Path) -> Result<Vec<u8>, GitError> {
    open_regular(path).map(|(bytes, _)| bytes)
}
pub(super) fn open_regular(path: &Path) -> Result<(Vec<u8>, File), GitError> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    let mut file = options.open(path).map_err(GitError::Io)?;
    let metadata = file.metadata().map_err(GitError::Io)?;
    validate_index_metadata(&metadata)?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(MAX_INDEX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(GitError::Io)?;
    if bytes.len() as u64 > MAX_INDEX_BYTES {
        return Err(GitError::InvalidOutput("index exceeds output budget"));
    }
    verify_stable_read(&file, path, &metadata, bytes.len())?;
    Ok((bytes, file))
}

/// Bind bytes read from the opened handle to the same path and modification state.
fn verify_stable_read(
    file: &File,
    path: &Path,
    metadata: &fs::Metadata,
    bytes_len: usize,
) -> Result<(), GitError> {
    let after = file.metadata().map_err(GitError::Io)?;
    if !same_file(file, path)?
        || after.len() != bytes_len as u64
        || metadata.modified().ok() != after.modified().ok()
    {
        return Err(GitError::InvalidOutput("index changed during read"));
    }
    Ok(())
}

const MAX_INDEX_BYTES: u64 = 256 * 1024 * 1024;

/// Check file representation and size before consuming bytes from the opened handle.
fn validate_index_metadata(metadata: &fs::Metadata) -> Result<(), GitError> {
    if !metadata.is_file() {
        return Err(GitError::InvalidOutput("index is not a regular file"));
    }
    if metadata.len() > MAX_INDEX_BYTES {
        return Err(GitError::InvalidOutput("index exceeds output budget"));
    }
    Ok(())
}

pub(super) fn index_path(root: &Path) -> Result<PathBuf, ReplacementFailure> {
    let bytes = command(
        root,
        &["rev-parse", "--path-format=absolute", "--git-path", "index"],
        None,
    )
    .map_err(operation)?;
    let text = std::str::from_utf8(&bytes)
        .map_err(operation)?
        .trim_end_matches(['\r', '\n']);
    let path = PathBuf::from(text);
    if !path.is_absolute() || path.file_name().is_none() {
        return Err(failed(FailureKind::Failed, "invalid index path"));
    }
    Ok(path)
}

#[cfg(unix)]
pub(super) fn same_file(file: &File, path: &Path) -> Result<bool, GitError> {
    use std::os::unix::fs::MetadataExt;
    let opened = file.metadata().map_err(GitError::Io)?;
    let current = fs::symlink_metadata(path).map_err(GitError::Io)?;
    Ok(current.file_type().is_file()
        && opened.dev() == current.dev()
        && opened.ino() == current.ino())
}

/// Write and read back the owned lock before its rename can become a commit.
pub(super) fn write_verified_lock(
    lock_file: &mut File,
    lock: &Path,
    prepared: &[u8],
) -> Result<(), ReplacementFailure> {
    lock_file.write_all(prepared).map_err(operation)?;
    lock_file.flush().map_err(operation)?;
    // The lock's path must still name the file we created before rename.
    if !same_file(lock_file, lock).map_err(operation)? {
        return Err(failed(
            FailureKind::RecoveryFailed,
            "index lock identity changed",
        ));
    }
    lock_file.seek(SeekFrom::Start(0)).map_err(operation)?;
    let mut lock_bytes = Vec::new();
    lock_file.read_to_end(&mut lock_bytes).map_err(operation)?;
    if lock_bytes != prepared || !same_file(lock_file, lock).map_err(operation)? {
        return Err(failed(
            FailureKind::RecoveryFailed,
            "index lock readback mismatch",
        ));
    }
    Ok(())
}
