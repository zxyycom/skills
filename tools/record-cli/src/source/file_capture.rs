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
    path: &RelativePath,
    capability: &cap_std::fs::Dir,
    resolved: &RelativePath,
) -> Result<Option<ParentFacts>, SourceError> {
    let mut prefix = PathBuf::new();
    let mut parents = vec![directory_identity(&root.directory.metadata()?)];
    let mut parent_paths = Vec::new();
    let components: Vec<_> = resolved.as_path().components().collect();
    for component in components.iter().take(components.len().saturating_sub(1)) {
        let Component::Normal(name) = component else {
            return Err(SourceError::InvalidPath(path.0.clone()));
        };
        prefix.push(name);
        let parent = match capability.open_dir(&prefix) {
            Ok(dir) => dir.into_std_file(),
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        parents.push(directory_identity(&parent.metadata()?));
        parent_paths.push(RelativePath::new(&prefix)?);
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
    // Compare two independent traversals from the retained root handle and the named root.
    // This detects common replacement and in-place write races, not atomic isolation
    // from non-cooperating writers.
    let root_now = std::fs::metadata(&root.path)?;
    if directory_identity(&root_now) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    let first = capture_once(root, path, limits)?;
    let second = capture_once(root, path, limits)?;
    if first != second || directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(second)
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
    let first = capture_header_once(root, path)?;
    let second = capture_header_once(root, path)?;
    if first != second || directory_identity(&std::fs::metadata(&root.path)?) != root.identity {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(second)
}
#[cfg(not(any(unix, windows)))]
pub fn open_root(_: &Path) -> Result<Root, SourceError> {
    Err(SourceError::UnsupportedPlatform)
}
#[cfg(not(any(unix, windows)))]
pub fn capture(_: &Root, _: &RelativePath) -> Result<ExpectedFile, SourceError> {
    Err(SourceError::UnsupportedPlatform)
}
#[cfg(not(any(unix, windows)))]
pub fn capture_header(_: &Root, _: &RelativePath) -> Result<Option<HeaderSnapshot>, SourceError> {
    Err(SourceError::UnsupportedPlatform)
}

#[cfg(not(any(unix, windows)))]
pub fn capture_bounded(
    _: &Root,
    _: &RelativePath,
    _: u64,
    _: u64,
) -> Result<ExpectedFile, SourceError> {
    Err(SourceError::UnsupportedPlatform)
}
