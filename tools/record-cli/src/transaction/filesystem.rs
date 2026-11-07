use super::{ExpectedFile, RelativePath, ResourceIntent, Root, WriteIntent};
use std::{
    io::{self, Write},
    path::{Path, PathBuf},
};

// Resolve the parent within the workspace before an ordinary filesystem operation.
fn target(root: &Root, path: &RelativePath) -> io::Result<PathBuf> {
    let full = root.path().join(path.as_path());
    let parent = full
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing parent"))?;
    let canonical = parent.canonicalize()?;
    if !canonical.starts_with(root.path()) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "path escapes workspace",
        ));
    }
    Ok(canonical.join(
        full.file_name()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing file name"))?,
    ))
}
fn regular(path: &Path) -> io::Result<()> {
    let metadata = std::fs::symlink_metadata(path)?;
    if !metadata.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "expected regular file",
        ));
    }
    Ok(())
}
fn create(path: &Path, bytes: &[u8]) -> Result<(), (io::Error, bool)> {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| (e, false))?;
    file.write_all(bytes).map_err(|e| (e, true))
}
pub(super) fn apply_write(root: &Root, write: &WriteIntent) -> Result<(), (io::Error, bool)> {
    let path = target(root, &write.path).map_err(|e| (e, false))?;
    match (&write.before, &write.after) {
        (ExpectedFile::Missing, Some(bytes)) => create(&path, bytes),
        (ExpectedFile::Present(_), Some(bytes)) => replace(&path, bytes).map_err(|e| (e, false)),
        (ExpectedFile::Present(_), None) => {
            regular(&path).map_err(|e| (e, false))?;
            std::fs::remove_file(path).map_err(|e| (e, false))
        }
        (ExpectedFile::Missing, None) => Ok(()),
    }
}
fn replace(path: &Path, bytes: &[u8]) -> io::Result<()> {
    regular(path)?;
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().expect("target has parent"))?;
    temp.write_all(bytes)?;
    temp.persist(path).map_err(|e| e.error)?;
    Ok(())
}
pub(super) fn resource_effects(resource: &ResourceIntent) -> Vec<&RelativePath> {
    match resource {
        ResourceIntent::CreateDirectory { path }
        | ResourceIntent::RemoveFile { path }
        | ResourceIntent::RemoveDirectory { path } => vec![path],
        ResourceIntent::MoveDirectory {
            source,
            destination,
        } => vec![source, destination],
    }
}
type ResourceFailure = (&'static str, RelativePath, io::Error, bool);
pub(super) fn apply_resource(root: &Root, intent: &ResourceIntent) -> Result<(), ResourceFailure> {
    let fail = |step, path: &RelativePath, error, unknown| (step, path.clone(), error, unknown);
    match intent {
        ResourceIntent::CreateDirectory { path } => {
            let dest = target(root, path).map_err(|e| fail("create-directory", path, e, false))?;
            std::fs::create_dir(dest).map_err(|e| fail("create-directory", path, e, false))
        }
        ResourceIntent::MoveDirectory {
            source,
            destination,
        } => move_directory(root, source, destination),
        ResourceIntent::RemoveFile { path } => {
            let target = target(root, path).map_err(|e| fail("remove-file", path, e, false))?;
            regular(&target).map_err(|e| fail("remove-file", path, e, false))?;
            std::fs::remove_file(target).map_err(|e| fail("remove-file", path, e, false))
        }
        ResourceIntent::RemoveDirectory { path } => {
            let target =
                target(root, path).map_err(|e| fail("remove-directory", path, e, false))?;
            std::fs::remove_dir(target).map_err(|e| fail("remove-directory", path, e, false))
        }
    }
}

fn move_directory(
    root: &Root,
    source: &RelativePath,
    destination: &RelativePath,
) -> Result<(), ResourceFailure> {
    let fail = |path: &RelativePath, error| ("move-directory", path.clone(), error, false);
    let src = target(root, source).map_err(|e| fail(source, e))?;
    let dst = target(root, destination).map_err(|e| fail(destination, e))?;
    let metadata = std::fs::symlink_metadata(&src).map_err(|e| fail(source, e))?;
    if !metadata.is_dir() {
        return Err(fail(
            source,
            io::Error::new(io::ErrorKind::InvalidInput, "expected directory"),
        ));
    }
    match std::fs::symlink_metadata(&dst) {
        Ok(_) => {
            return Err(fail(
                destination,
                io::Error::new(io::ErrorKind::AlreadyExists, "destination exists"),
            ));
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => (),
        Err(e) => return Err(fail(destination, e)),
    }
    std::fs::rename(src, dst).map_err(|e| fail(source, e))
}
