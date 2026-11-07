use super::*;

#[test]
fn native_join_preserves_workspace_path_contract() {
    let parent = super::RelativePath::new("records").unwrap();
    let joined = parent.as_path().join("nested").join("file.md");
    assert_eq!(super::RelativePath::new(&joined).unwrap().as_path(), joined);
    for invalid in [
        "../outside",
        "/absolute",
        "records/../outside",
        "records//file",
        "records/./file",
    ] {
        assert!(super::RelativePath::new(invalid).is_err(), "{invalid}");
    }
    assert!(!crate::domains::investigation::valid_resource_id(
        "240101-owner\\file.txt"
    ));
    assert!(super::RelativePath::new(r"records\file.md").is_err());
}
#[test]
fn header_capture_stops_before_unselected_body() {
    let workspace = tempfile::tempdir().unwrap();
    std::fs::write(
        workspace.path().join("candidate.md"),
        b"---\r\nid: 240101-test\r\n---\r\n\xffbody",
    )
    .unwrap();
    let root = super::open_root(workspace.path()).unwrap();
    let path = super::RelativePath::new("candidate.md").unwrap();
    let header = super::capture_header(&root, &path).unwrap().unwrap();
    assert_eq!(header.bytes, b"---\r\nid: 240101-test\r\n---");
    assert!(std::str::from_utf8(&header.bytes).is_ok());
    assert!(
        super::strict_text(match &super::capture(&root, &path).unwrap() {
            super::ExpectedFile::Present(s) => s,
            _ => panic!("missing"),
        })
        .is_err()
    );
    std::fs::write(
        workspace.path().join("bom.md"),
        b"\xef\xbb\xbf---\r\nid: 240101-test\r\nstatus: candidate\r\n---\r\n\xff",
    )
    .unwrap();
    let bom = super::capture_header(&root, &super::RelativePath::new("bom.md").unwrap())
        .unwrap()
        .unwrap();
    assert!(
        crate::domains::decision::candidate_header(
            std::str::from_utf8(&bom.bytes).unwrap(),
            "bom.md"
        )
        .is_ok()
    );
}
#[test]
fn capture_checks_relative_path_and_strict_utf8() {
    let workspace = tempfile::tempdir().expect("private workspace");
    std::fs::create_dir(workspace.path().join("records")).unwrap();
    std::fs::write(workspace.path().join("records/valid.md"), "安全正文\n").unwrap();
    std::fs::write(workspace.path().join("records/invalid.md"), [0xff]).unwrap();
    let root = open_root(workspace.path()).expect("native platform source support required");
    assert!(RelativePath::new("../outside").is_err());
    assert!(RelativePath::new("records/./valid.md").is_err());
    let ExpectedFile::Present(valid) =
        capture(&root, &RelativePath::new("records/valid.md").unwrap()).unwrap()
    else {
        panic!("valid source missing")
    };
    assert_eq!(strict_text(&valid).unwrap(), "安全正文\n");
    let ExpectedFile::Present(invalid) =
        capture(&root, &RelativePath::new("records/invalid.md").unwrap()).unwrap()
    else {
        panic!("invalid source missing")
    };
    assert!(matches!(
        strict_text(&invalid),
        Err(SourceError::InvalidUtf8)
    ));
    assert!(matches!(
        capture(&root, &RelativePath::new("records/missing.md").unwrap()).unwrap(),
        ExpectedFile::Missing
    ));
}
#[test]
fn capture_allows_internal_directory_link_but_rejects_escape() {
    let workspace = tempfile::tempdir().expect("private workspace");
    let outside = tempfile::tempdir().expect("private outside directory");
    std::fs::create_dir(workspace.path().join("real")).unwrap();
    std::fs::write(workspace.path().join("real/item.md"), b"inside").unwrap();
    std::fs::write(outside.path().join("item.md"), b"outside").unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink("real", workspace.path().join("alias")).unwrap();
        std::os::unix::fs::symlink(
            workspace.path().join("real"),
            workspace.path().join("absolute-alias"),
        )
        .unwrap();
        std::os::unix::fs::symlink("real/item.md", workspace.path().join("file-link.md")).unwrap();
        std::os::unix::fs::symlink(outside.path(), workspace.path().join("escape")).unwrap();
    }
    let root = open_root(workspace.path()).unwrap();
    let ExpectedFile::Present(snapshot) =
        capture(&root, &RelativePath::new("alias/item.md").unwrap()).unwrap()
    else {
        panic!("inside missing")
    };
    assert_eq!(snapshot.bytes, b"inside");
    let ExpectedFile::Present(absolute) = capture(
        &root,
        &RelativePath::new("absolute-alias/item.md").unwrap(),
    )
    .unwrap_or_else(|error| {
        panic!(
            "absolute link capture failed: {error:?}; workspace={:?}; root={:?}; target={:?}",
            workspace.path(),
            root.path(),
            std::fs::read_link(workspace.path().join("absolute-alias"))
        )
    }) else {
        panic!("absolute internal link missing")
    };
    assert_eq!(absolute.bytes, b"inside");
    assert!(capture(&root, &RelativePath::new("file-link.md").unwrap()).is_err());
    assert!(capture(&root, &RelativePath::new("escape/item.md").unwrap()).is_err());
}
#[test]
fn bounded_capture_distinguishes_file_and_total_budget() {
    let workspace = tempfile::tempdir().expect("private workspace");
    std::fs::write(workspace.path().join("item.md"), b"12345").unwrap();
    let root = open_root(workspace.path()).expect("native platform source support required");
    let path = RelativePath::new("item.md").unwrap();
    assert!(matches!(
        capture_bounded(&root, &path, 4, 10),
        Err(SourceError::FileBudgetExceeded { size: 5, limit: 4 })
    ));
    assert!(matches!(
        capture_bounded(&root, &path, 10, 4),
        Err(SourceError::TotalBudgetExceeded {
            size: 5,
            remaining: 4
        })
    ));
    assert!(matches!(
        capture_bounded(&root, &path, 5, 5),
        Ok(ExpectedFile::Present(_))
    ));
}
#[test]
fn missing_proof_creates_exclusively_without_overwriting_rival() {
    use std::io::Write;
    let workspace = tempfile::tempdir().unwrap();
    std::fs::create_dir(workspace.path().join("records")).unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("records/item.md").unwrap();
    let absent = capture_missing(&root, &path).unwrap();
    std::fs::write(workspace.path().join("records/item.md"), b"rival").unwrap();
    let failure = create_exclusive(&root, &absent, CreateMode::Native(0o600)).unwrap_err();
    assert_eq!(failure.effect, CreateEffect::NotStarted);
    assert_eq!(
        std::fs::read(workspace.path().join("records/item.md")).unwrap(),
        b"rival"
    );
    std::fs::remove_file(workspace.path().join("records/item.md")).unwrap();
    let fresh = capture_missing(&root, &path).unwrap();
    let mut created = create_exclusive(&root, &fresh, CreateMode::Native(0o600)).unwrap();
    created.file.write_all(b"new").unwrap();
    created.file.sync_all().unwrap();
    assert_eq!(
        std::fs::read(workspace.path().join("records/item.md")).unwrap(),
        b"new"
    );
    assert_eq!(
        created.identity.inode,
        identity_from_handle(&created.file).unwrap().inode
    );
}
#[test]
fn conditional_remove_rejects_changed_source_then_removes_verified_source() {
    let workspace = tempfile::tempdir().unwrap();
    std::fs::write(workspace.path().join("item.md"), b"original").unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("item.md").unwrap();
    let ExpectedFile::Present(original) = capture(&root, &path).unwrap() else {
        panic!("source missing")
    };
    std::fs::write(workspace.path().join("item.md"), b"rival").unwrap();
    let failure = remove_if_matches(&root, &original).unwrap_err();
    assert_eq!(failure.effect, RemoveEffect::NotStarted);
    assert_eq!(
        std::fs::read(workspace.path().join("item.md")).unwrap(),
        b"rival"
    );
    let ExpectedFile::Present(fresh) = capture(&root, &path).unwrap() else {
        panic!("source missing")
    };
    remove_if_matches(&root, &fresh).unwrap();
    assert!(!workspace.path().join("item.md").exists());
}
#[test]
fn directory_creation_and_empty_removal_preserve_members() {
    let workspace = tempfile::tempdir().unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("owner").unwrap();
    let proof = capture_missing(&root, &path).unwrap();
    let created = create_directory_exclusive(&root, &proof, CreateMode::Native(0o700)).unwrap();
    assert_eq!(
        created.identity.inode,
        identity_from_handle(&created.handle).unwrap().inode
    );
    drop(created);
    std::fs::write(workspace.path().join("owner/item"), b"preserve").unwrap();
    let populated = enumerate_directory(&root, &path).unwrap();
    assert_eq!(
        remove_empty_directory(&root, &populated)
            .unwrap_err()
            .effect,
        RemoveEffect::NotStarted
    );
    assert_eq!(
        std::fs::read(workspace.path().join("owner/item")).unwrap(),
        b"preserve"
    );
    std::fs::remove_file(workspace.path().join("owner/item")).unwrap();
    let empty = enumerate_directory(&root, &path).unwrap();
    remove_empty_directory(&root, &empty).unwrap();
    assert!(!workspace.path().join("owner").exists());
}
#[test]
fn resource_root_and_owner_are_proven_without_following_links() {
    let workspace = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let root = open_root(workspace.path()).unwrap();
    let resources = RelativePath::new("resources").unwrap();
    let owner = RelativePath::new("selected").unwrap();
    let missing = capture_resource_directories(&root, &resources, &owner).unwrap();
    assert!(!missing.root_exists() && !missing.owner_exists());
    assert!(missing.equivalent(&capture_resource_directories(&root, &resources, &owner).unwrap()));
    std::fs::create_dir_all(workspace.path().join("resources/selected")).unwrap();
    let present = capture_resource_directories(&root, &resources, &owner).unwrap();
    assert!(present.root_exists() && present.owner_exists());
    assert!(!missing.equivalent(&present));
    #[cfg(unix)]
    std::os::unix::fs::symlink(outside.path(), workspace.path().join("resources/linked")).unwrap();
    assert!(matches!(
        capture_resource_directories(&root, &resources, &RelativePath::new("linked").unwrap()),
        Err(SourceError::Symlink(_))
    ));
}

#[test]
fn atomic_replace_compares_content_and_mode_and_preserves_external_hard_link() {
    use std::os::unix::fs::PermissionsExt;
    let workspace = tempfile::tempdir().unwrap();
    let path = workspace.path().join("record.md");
    let link = workspace.path().join("old-link.md");
    std::fs::write(&path, b"old").unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o640)).unwrap();
    let root = open_root(workspace.path()).unwrap();
    let relative = RelativePath::new("record.md").unwrap();
    let ExpectedFile::Present(before) = capture(&root, &relative).unwrap() else {
        panic!()
    };
    // A different inode with the same content and permissions is not a conflict.
    let replacement = workspace.path().join("replacement");
    std::fs::write(&replacement, b"old").unwrap();
    std::fs::set_permissions(&replacement, std::fs::Permissions::from_mode(0o640)).unwrap();
    std::fs::rename(&replacement, &path).unwrap();
    // The external link must refer to the current target at replacement time.
    std::fs::hard_link(&path, &link).unwrap();
    replace_if_matches(&root, &before, b"new").unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), b"new");
    assert_eq!(std::fs::read(&link).unwrap(), b"old");
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o7777,
        0o640
    );
    assert!(replace_if_matches(&root, &before, b"lost").is_err());
    assert_eq!(std::fs::read(&path).unwrap(), b"new");
}

#[test]
fn atomic_replace_rejects_readonly_even_when_directory_is_writable() {
    use std::os::unix::fs::PermissionsExt;
    let workspace = tempfile::tempdir().unwrap();
    let path = workspace.path().join("record.md");
    std::fs::write(&path, b"old").unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o444)).unwrap();
    let root = open_root(workspace.path()).unwrap();
    let relative = RelativePath::new("record.md").unwrap();
    let ExpectedFile::Present(before) = capture(&root, &relative).unwrap() else {
        panic!()
    };
    assert!(
        matches!(replace_if_matches(&root, &before, b"new"), Err(ReplaceFailure { error: SourceError::Io(e), .. }) if e.kind() == std::io::ErrorKind::PermissionDenied)
    );
    assert_eq!(std::fs::read(&path).unwrap(), b"old");
}

#[test]
fn owned_cleanup_never_deletes_equal_replacement() {
    use std::os::unix::fs::PermissionsExt;
    let workspace = tempfile::tempdir().unwrap();
    let file = workspace.path().join("file");
    std::fs::write(&file, b"same").unwrap();
    std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("file").unwrap();
    let ExpectedFile::Present(before) = capture(&root, &path).unwrap() else {
        panic!()
    };
    let replacement = workspace.path().join("replacement");
    std::fs::write(&replacement, b"same").unwrap();
    std::fs::set_permissions(&replacement, std::fs::Permissions::from_mode(0o600)).unwrap();
    std::fs::rename(replacement, &file).unwrap();
    assert!(remove_if_owned(&root, &before).is_err());
    assert_eq!(std::fs::read(file).unwrap(), b"same");
}
