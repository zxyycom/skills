//! Platform file capture and independent readback.
use super::*;

#[cfg(unix)]
pub fn open_root(path: &Path) -> Result<Root, SourceError> {
    use std::os::unix::fs::OpenOptionsExt;
    let canonical = std::fs::canonicalize(path)?;
    let directory = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(&canonical)?;
    let metadata = directory.metadata()?;
    if !metadata.is_dir() {
        return Err(SourceError::Unsafe(canonical));
    }
    Ok(Root {
        path: canonical,
        identity: directory_identity(&metadata),
        directory,
    })
}
// One no-follow handle and the independently recorded parent chain of the named file.
#[cfg(unix)]
struct OpenedSource {
    file: File,
    before: std::fs::Metadata,
    parents: Vec<FileIdentity>,
    parent_paths: Vec<RelativePath>,
}
#[cfg(unix)]
fn open_source(root: &Root, path: &RelativePath) -> Result<Option<OpenedSource>, SourceError> {
    use cap_fs_ext::{FollowSymlinks, OpenOptionsFollowExt};
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let resolved = resolve_directory_links(root, path, true)?;
    let Some(ParentFacts {
        parents,
        parent_paths,
    }) = observe_parents(root, path, &capability, &resolved)?
    else {
        return Ok(None);
    };
    let mut options = cap_std::fs::OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    let file = match capability.open_with(resolved.as_path(), &options) {
        Ok(file) => file.into_std(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let before = file.metadata()?;
    if !before.is_file() {
        return Err(SourceError::Unsafe(path.0.clone()));
    }
    Ok(Some(OpenedSource {
        file,
        before,
        parents,
        parent_paths,
    }))
}
// Bind each traversed parent to its identity without reading unrelated files.
#[cfg(unix)]
struct ParentFacts {
    parents: Vec<FileIdentity>,
    parent_paths: Vec<RelativePath>,
}
#[cfg(unix)]
fn observe_parents(
    root: &Root,
    _path: &RelativePath,
    capability: &cap_std::fs::Dir,
    resolved: &RelativePath,
) -> Result<Option<ParentFacts>, SourceError> {
    let mut parents = vec![directory_identity(&root.directory.metadata()?)];
    let mut parent_paths = Vec::new();
    if let Some(parent_path) = resolved
        .as_path()
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
    {
        let parent = match capability.open_dir(parent_path) {
            Ok(dir) => dir.into_std_file(),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        parents.push(directory_identity(&parent.metadata()?));
        parent_paths.push(RelativePath::new(parent_path)?);
    }
    Ok(Some(ParentFacts {
        parents,
        parent_paths,
    }))
}
#[cfg(unix)]
fn capture_once(
    root: &Root,
    path: &RelativePath,
    limits: ReadLimits,
) -> Result<ExpectedFile, SourceError> {
    use std::io::Read;
    let Some(OpenedSource {
        mut file,
        before,
        parents,
        parent_paths,
    }) = open_source(root, path)?
    else {
        return Ok(ExpectedFile::Missing);
    };
    limits.check(before.len())?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(limits.maximum().saturating_add(1))
        .read_to_end(&mut bytes)?;
    limits.check(bytes.len() as u64)?;
    let after = file.metadata()?;
    if identity(&before) != identity(&after)
        || before.modified().ok() != after.modified().ok()
        || bytes.len() as u64 != after.len()
    {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(ExpectedFile::Present(SourceSnapshot {
        path: path.clone(),
        identity: identity(&after),
        parents,
        parent_paths,
        bytes,
    }))
}
#[cfg(unix)]
pub fn capture(root: &Root, path: &RelativePath) -> Result<ExpectedFile, SourceError> {
    capture_bounded(root, path, u64::MAX, u64::MAX)
}
#[cfg(unix)]
pub fn capture_bounded(
    root: &Root,
    path: &RelativePath,
    max_file_bytes: u64,
    remaining_total_bytes: u64,
) -> Result<ExpectedFile, SourceError> {
    let limits = ReadLimits {
        file: max_file_bytes,
        total: remaining_total_bytes,
    };
    if directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    capture_once(root, path, limits)
}

#[cfg(unix)]
fn capture_header_once(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<HeaderSnapshot>, SourceError> {
    let Some(OpenedSource {
        mut file,
        before,
        parents,
        parent_paths,
    }) = open_source(root, path)?
    else {
        return Ok(None);
    };
    let bytes = read_header(&mut file)?;
    let after = file.metadata()?;
    if identity(&before) != identity(&after) || before.modified().ok() != after.modified().ok() {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(Some(HeaderSnapshot {
        path: path.clone(),
        identity: identity(&after),
        parents,
        parent_paths,
        bytes,
    }))
}

#[cfg(unix)]
pub fn capture_header(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<HeaderSnapshot>, SourceError> {
    if directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    capture_header_once(root, path)
}

/// Observe only a regular file's identity for write-set alias detection.
#[cfg(unix)]
pub(crate) fn file_identity(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<FileIdentity>, SourceError> {
    use cap_std::fs::MetadataExt;
    let resolved = resolve_directory_links(root, path, true)?;
    let directory = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let metadata = match directory.symlink_metadata(resolved.as_path()) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    if !metadata.is_file() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    Ok(Some(FileIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
        mode: metadata.mode(),
        size: metadata.size(),
    }))
}
