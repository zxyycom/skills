use super::*;
#[cfg(windows)]
mod windows_rename_diagnostics;
fn fixture() -> (tempfile::TempDir, Root, RelativePath, RelativePath) {
    let temp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(temp.path().join("resources/old/nested")).unwrap();
    std::fs::write(
        temp.path().join("resources/old/nested/file"),
        b"bytes\0here",
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for (path, mode) in [
            ("resources/old", 0o775),
            ("resources/old/nested", 0o751),
            ("resources/old/nested/file", 0o640),
        ] {
            std::fs::set_permissions(
                temp.path().join(path),
                std::fs::Permissions::from_mode(mode),
            )
            .unwrap();
        }
    }
    let root = open_root(temp.path()).unwrap();
    (
        temp,
        root,
        RelativePath::new("resources/old").unwrap(),
        RelativePath::new("resources/new").unwrap(),
    )
}
#[test]
fn moves_complete_tree_and_conditionally_restores_it() {
    let (temp, root, old, new) = fixture();
    let tree = capture_tree(&root, &old).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    let receipt = move_directory(&root, &tree, &proof).unwrap_or_else(|error| {
        #[cfg(windows)]
        panic!(
            "{error:?}; isolated rename diagnostics: {:?}",
            windows_rename_diagnostics::rename_diagnostics()
        );
        #[cfg(not(windows))]
        panic!("{error:?}");
    });
    assert!(!temp.path().join("resources/old").exists());
    assert_eq!(
        std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
        b"bytes\0here"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(temp.path().join("resources/new"))
                .unwrap()
                .permissions()
                .mode()
                & 0o7777,
            0o775
        );
        assert_eq!(
            std::fs::metadata(temp.path().join("resources/new/nested"))
                .unwrap()
                .permissions()
                .mode()
                & 0o7777,
            0o751
        );
    }
    receipt.restore(&root).unwrap();
    assert_eq!(
        std::fs::read(temp.path().join("resources/old/nested/file")).unwrap(),
        b"bytes\0here"
    );
    assert!(!temp.path().join("resources/new").exists());
}
#[test]
fn destination_winner_and_changed_source_are_never_overwritten() {
    let (temp, root, old, new) = fixture();
    let tree = capture_tree(&root, &old).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    std::fs::create_dir(temp.path().join("resources/new")).unwrap();
    std::fs::write(temp.path().join("resources/new/winner"), b"winner").unwrap();
    assert_eq!(
        move_directory(&root, &tree, &proof).unwrap_err().effect,
        MoveDirectoryEffect::NotStarted
    );
    assert_eq!(
        std::fs::read(temp.path().join("resources/new/winner")).unwrap(),
        b"winner"
    );
    std::fs::remove_file(temp.path().join("resources/new/winner")).unwrap();
    std::fs::remove_dir(temp.path().join("resources/new")).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    std::fs::write(temp.path().join("resources/old/nested/file"), b"edited").unwrap();
    assert_eq!(
        move_directory(&root, &tree, &proof).unwrap_err().effect,
        MoveDirectoryEffect::NotStarted
    );
    assert!(!temp.path().join("resources/new").exists());
}
#[test]
fn restore_never_overwrites_new_original_or_edited_tree() {
    let (temp, root, old, new) = fixture();
    let receipt = move_directory(
        &root,
        &capture_tree(&root, &old).unwrap(),
        &capture_missing(&root, &new).unwrap(),
    )
    .unwrap();
    std::fs::create_dir(temp.path().join("resources/old")).unwrap();
    std::fs::write(temp.path().join("resources/old/winner"), b"winner").unwrap();
    assert_eq!(
        receipt.restore(&root).unwrap_err().effect,
        MoveDirectoryEffect::NotStarted
    );
    assert_eq!(
        std::fs::read(temp.path().join("resources/old/winner")).unwrap(),
        b"winner"
    );
    assert_eq!(
        std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
        b"bytes\0here"
    );
}
#[test]
fn syscall_collision_preserves_winner_and_source() {
    let (temp, root, old, new) = fixture();
    let tree = capture_tree(&root, &old).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    let path = temp.path().join("resources/new");
    BEFORE_RENAME.with(|slot| {
        *slot.borrow_mut() = Some(Box::new(move || {
            std::fs::create_dir(&path).unwrap();
            std::fs::write(path.join("winner"), b"winner").unwrap();
        }))
    });
    assert_eq!(
        move_directory(&root, &tree, &proof).unwrap_err().effect,
        MoveDirectoryEffect::NotStarted
    );
    assert_eq!(
        std::fs::read(temp.path().join("resources/new/winner")).unwrap(),
        b"winner"
    );
    assert!(temp.path().join("resources/old/nested/file").exists());
}
#[test]
fn post_syscall_drift_is_unknown_not_owned() {
    let (temp, root, old, new) = fixture();
    let tree = capture_tree(&root, &old).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    let path = temp.path().join("resources/new/nested/file");
    AFTER_RENAME.with(|slot| {
        *slot.borrow_mut() = Some(Box::new(move || std::fs::write(path, b"rival").unwrap()))
    });
    assert_eq!(
        move_directory(&root, &tree, &proof).unwrap_err().effect,
        MoveDirectoryEffect::Unknown
    );
    assert_eq!(
        std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
        b"rival"
    );
}
#[test]
fn replaced_parent_and_case_alias_are_rejected() {
    let (temp, root, old, new) = fixture();
    let tree = capture_tree(&root, &old).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    std::fs::create_dir(temp.path().join("resources/NEW")).unwrap();
    assert_eq!(
        move_directory(&root, &tree, &proof).unwrap_err().effect,
        MoveDirectoryEffect::NotStarted
    );
    std::fs::remove_dir(temp.path().join("resources/NEW")).unwrap();
    // Some platforms intentionally hold directory handles without delete sharing.
    if std::fs::rename(temp.path().join("resources"), temp.path().join("displaced")).is_ok() {
        std::fs::create_dir(temp.path().join("resources")).unwrap();
        assert_eq!(
            move_directory(&root, &tree, &proof).unwrap_err().effect,
            MoveDirectoryEffect::NotStarted
        );
        assert!(temp.path().join("displaced/old/nested/file").exists());
    }
}
#[test]
fn move_preserves_platform_metadata_and_bytes() {
    #[cfg(unix)]
    {
        const CHILD: &str = "RECORD_CLI_DIRECTORY_MOVE_UMASK_CHILD";
        if std::env::var_os(CHILD).is_none() {
            let result = std::process::Command::new(std::env::current_exe().unwrap())
                .arg("--exact")
                .arg("source::directory_move::tests::move_preserves_platform_metadata_and_bytes")
                .arg("--nocapture")
                .env(CHILD, "1")
                .status()
                .unwrap();
            assert!(result.success());
            return;
        }
        // SAFETY: this test is alone in its isolated child process.
        unsafe {
            libc::umask(0o077);
        }
        let (temp, root, old, new) = fixture();
        move_directory(
            &root,
            &capture_tree(&root, &old).unwrap(),
            &capture_missing(&root, &new).unwrap(),
        )
        .unwrap();
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(temp.path().join("resources/new"))
                .unwrap()
                .permissions()
                .mode()
                & 0o7777,
            0o775
        );
        assert_eq!(
            std::fs::metadata(temp.path().join("resources/new/nested"))
                .unwrap()
                .permissions()
                .mode()
                & 0o7777,
            0o751
        );
        assert_eq!(
            std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
            b"bytes\0here"
        );
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        let (temp, root, old, new) = fixture();
        let before = std::fs::metadata(temp.path().join("resources/old"))
            .unwrap()
            .file_attributes();
        move_directory(
            &root,
            &capture_tree(&root, &old).unwrap(),
            &capture_missing(&root, &new).unwrap(),
        )
        .unwrap();
        assert_eq!(
            std::fs::metadata(temp.path().join("resources/new"))
                .unwrap()
                .file_attributes(),
            before
        );
        assert_eq!(
            std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
            b"bytes\0here"
        );
    }
}
#[test]
fn edited_moved_tree_blocks_recovery() {
    let (temp, root, old, new) = fixture();
    let receipt = move_directory(
        &root,
        &capture_tree(&root, &old).unwrap(),
        &capture_missing(&root, &new).unwrap(),
    )
    .unwrap();
    std::fs::write(temp.path().join("resources/new/nested/file"), b"rival").unwrap();
    assert_eq!(
        receipt.restore(&root).unwrap_err().effect,
        MoveDirectoryEffect::NotStarted
    );
    assert!(!temp.path().join("resources/old").exists());
    assert_eq!(
        std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
        b"rival"
    );
}
#[test]
fn source_name_replaced_at_syscall_is_unknown() {
    let (temp, root, old, new) = fixture();
    let tree = capture_tree(&root, &old).unwrap();
    let proof = capture_missing(&root, &new).unwrap();
    let path = temp.path().join("resources");
    BEFORE_RENAME.with(|slot| {
        *slot.borrow_mut() = Some(Box::new(move || {
            std::fs::rename(path.join("old"), path.join("displaced")).unwrap();
            std::fs::create_dir(path.join("old")).unwrap();
            std::fs::write(path.join("old/winner"), b"winner").unwrap();
        }))
    });
    assert_eq!(
        move_directory(&root, &tree, &proof).unwrap_err().effect,
        MoveDirectoryEffect::Unknown
    );
    #[cfg(unix)]
    {
        assert_eq!(
            std::fs::read(temp.path().join("resources/new/winner")).unwrap(),
            b"winner"
        );
        assert_eq!(
            std::fs::read(temp.path().join("resources/displaced/nested/file")).unwrap(),
            b"bytes\0here"
        );
    }
    #[cfg(windows)]
    {
        assert_eq!(
            std::fs::read(temp.path().join("resources/old/winner")).unwrap(),
            b"winner"
        );
        assert_eq!(
            std::fs::read(temp.path().join("resources/new/nested/file")).unwrap(),
            b"bytes\0here"
        );
    }
}
