//! Resource directory identity, namespace and selected member observations.
use super::{MemberKind, RelativePath, Root, SourceError, member_kind};
use std::io;

/// A cheap, best-effort namespace revision, not an atomic snapshot or CAS.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ResourceDirectoryVersion {
    #[cfg(unix)]
    device: u64,
    #[cfg(unix)]
    inode: u64,
    #[cfg(unix)]
    modified_seconds: i64,
    #[cfg(unix)]
    modified_nanoseconds: i64,
    #[cfg(unix)]
    changed_seconds: i64,
    #[cfg(unix)]
    changed_nanoseconds: i64,
    #[cfg(unix)]
    mode: u32,
    #[cfg(unix)]
    links: u64,
    #[cfg(windows)]
    volume: u64,
    #[cfg(windows)]
    file_index: u64,
    #[cfg(windows)]
    created: u64,
    #[cfg(windows)]
    modified: u64,
    #[cfg(windows)]
    attributes: u32,
}

pub fn resource_directory_version(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<ResourceDirectoryVersion>, SourceError> {
    let metadata = root.directory.symlink_metadata(path.as_path())?;
    if metadata.is_symlink() {
        return Err(SourceError::Symlink(path.0.clone()));
    }
    if !metadata.is_dir() {
        return Err(SourceError::NonRegular(path.0.clone()));
    }
    directory_version(root, path, metadata)
}

#[cfg(unix)]
fn directory_version(
    _root: &Root,
    _path: &RelativePath,
    metadata: cap_std::fs::Metadata,
) -> Result<Option<ResourceDirectoryVersion>, SourceError> {
    use cap_std::fs::MetadataExt;
    Ok(Some(ResourceDirectoryVersion {
        device: metadata.dev(),
        inode: metadata.ino(),
        modified_seconds: metadata.mtime(),
        modified_nanoseconds: metadata.mtime_nsec(),
        changed_seconds: metadata.ctime(),
        changed_nanoseconds: metadata.ctime_nsec(),
        mode: metadata.mode(),
        links: metadata.nlink(),
    }))
}

#[cfg(windows)]
fn directory_version(
    root: &Root,
    path: &RelativePath,
    _metadata: cap_std::fs::Metadata,
) -> Result<Option<ResourceDirectoryVersion>, SourceError> {
    use cap_primitives::fs::_WindowsByHandle;
    use cap_std::fs::MetadataExt as WindowsMetadataExt;
    // The fixed cap-primitives version exposes optional handle identity via
    // this trait; unlike cap-fs-ext's infallible accessors it cannot panic
    // when a filesystem omits identity. Missing identity disables reuse.
    let metadata = root.directory.open_dir(path.as_path())?.dir_metadata()?;
    let Some((volume, index)) = windows_identity(
        _WindowsByHandle::volume_serial_number(&metadata),
        _WindowsByHandle::file_index(&metadata),
    ) else {
        return Ok(None);
    };
    Ok(Some(ResourceDirectoryVersion {
        volume: u64::from(volume),
        file_index: index,
        created: metadata.creation_time(),
        modified: metadata.last_write_time(),
        attributes: WindowsMetadataExt::file_attributes(&metadata),
    }))
}

#[cfg(not(any(unix, windows)))]
fn directory_version(
    _root: &Root,
    _path: &RelativePath,
    _metadata: cap_std::fs::Metadata,
) -> Result<Option<ResourceDirectoryVersion>, SourceError> {
    Ok(None)
}

#[cfg(any(windows, test))]
fn windows_identity(volume: Option<u32>, index: Option<u64>) -> Option<(u32, u64)> {
    Some((volume?, index?))
}

/// Observe the selected component itself without following its final symlink.
pub fn resource_member_kind(
    root: &Root,
    path: &RelativePath,
) -> Result<Option<MemberKind>, SourceError> {
    match root.directory.symlink_metadata(path.as_path()) {
        Ok(metadata) => Ok(Some(member_kind(metadata.file_type()))),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

/// On Windows, distinguish a case-insensitive alias from a newly added name.
/// Only matching ordinary files or directories with single-link identities are
/// unambiguous; symlinks, multiple links and missing identities force refresh.
#[cfg(windows)]
pub fn same_single_link_member(root: &Root, a: &RelativePath, b: &RelativePath) -> bool {
    let (Ok(a), Ok(b)) = (
        root.directory.symlink_metadata(a.as_path()),
        root.directory.symlink_metadata(b.as_path()),
    ) else {
        return false;
    };
    matches!((single_link_identity(&a), single_link_identity(&b)), (Some(a), Some(b)) if a == b)
}

/// An unavailable, linked, or unsupported member is never an alias proof.
#[cfg(windows)]
fn single_link_identity(metadata: &cap_std::fs::Metadata) -> Option<(MemberKind, u32, u64)> {
    use cap_primitives::fs::_WindowsByHandle;
    let kind = member_kind(metadata.file_type());
    if !matches!(kind, MemberKind::File | MemberKind::Directory)
        || _WindowsByHandle::number_of_links(metadata) != Some(1)
    {
        return None;
    }
    Some((
        kind,
        _WindowsByHandle::volume_serial_number(metadata)?,
        _WindowsByHandle::file_index(metadata)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::windows_identity;

    #[test]
    fn windows_resource_identity_requires_both_handle_fields() {
        assert_eq!(windows_identity(Some(7), Some(11)), Some((7, 11)));
        assert_eq!(windows_identity(None, Some(11)), None);
        assert_eq!(windows_identity(Some(7), None), None);
        assert_eq!(windows_identity(None, None), None);
    }
}
