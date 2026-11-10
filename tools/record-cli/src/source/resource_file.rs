//! Payload access walks selected directories without following symlinks.
use super::{RelativePath, Root, SourceError};
use cap_fs_ext::{DirExt, FollowSymlinks, OpenOptionsFollowExt};

pub(crate) fn open_resource_file(
    root: &Root,
    path: &RelativePath,
) -> Result<std::fs::File, SourceError> {
    let directory = parent_directory(root, path)?;
    let name = path
        .as_path()
        .file_name()
        .expect("validated relative file path has a filename");
    let metadata = directory.symlink_metadata(name)?;
    if metadata.is_symlink() {
        return Err(SourceError::Symlink(path.as_path().into()));
    }
    if !metadata.is_file() {
        return Err(SourceError::NonRegular(path.as_path().into()));
    }
    let mut options = cap_std::fs::OpenOptions::new();
    options.read(true).follow(FollowSymlinks::No);
    let file = directory.open_with(name, &options)?.into_std();
    if !file.metadata()?.is_file() {
        return Err(SourceError::NonRegular(path.as_path().into()));
    }
    Ok(file)
}

fn parent_directory(root: &Root, path: &RelativePath) -> Result<cap_std::fs::Dir, SourceError> {
    let mut directory = root.directory.try_clone()?;
    let parent = path
        .as_path()
        .parent()
        .expect("validated relative file path has a parent");
    for component in parent.components() {
        directory = directory.open_dir_nofollow(component.as_os_str())?;
    }
    Ok(directory)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::{fs, os::unix::fs::symlink};

    #[test]
    fn payload_open_rejects_symlink_ancestors_and_leaf_files() {
        let temp = tempfile::tempdir().unwrap();
        let external = tempfile::tempdir().unwrap();
        fs::write(external.path().join("sample.txt"), b"external evidence").unwrap();
        fs::create_dir(temp.path().join("normal")).unwrap();
        fs::write(temp.path().join("normal/sample.txt"), b"local evidence").unwrap();
        symlink(external.path(), temp.path().join("linked-parent")).unwrap();
        symlink(
            external.path().join("sample.txt"),
            temp.path().join("linked-file"),
        )
        .unwrap();
        symlink("normal", temp.path().join("internal-parent")).unwrap();
        symlink("normal/sample.txt", temp.path().join("internal-file")).unwrap();
        let root = super::super::open_root(temp.path()).unwrap();
        let normal = RelativePath::new("normal/sample.txt").unwrap();
        assert!(open_resource_file(&root, &normal).is_ok());
        for path in [
            "linked-parent/sample.txt",
            "linked-file",
            "internal-parent/sample.txt",
            "internal-file",
        ] {
            assert!(
                open_resource_file(&root, &RelativePath::new(path).unwrap()).is_err(),
                "{path}"
            );
        }
    }
}
