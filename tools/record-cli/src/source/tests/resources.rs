use super::*;

#[test]
fn selected_resources_reject_case_aliases_without_reading_siblings() {
    let workspace = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(workspace.path().join("resources/Owner")).unwrap();
    std::fs::write(
        workspace.path().join("resources/Owner/File.txt"),
        b"selected",
    )
    .unwrap();
    let root = open_root(workspace.path()).unwrap();
    let resources = RelativePath::new("resources").unwrap();
    assert!(matches!(
        capture_resource_directories(&root, &resources, &RelativePath::new("owner").unwrap()),
        Err(SourceError::CaseMismatch { .. })
    ));
    let owner = RelativePath::new("resources/Owner").unwrap();
    let member = RelativePath::new("file.txt").unwrap();
    assert!(matches!(
        capture_selected_tree(&root, &owner, std::slice::from_ref(&member)),
        Err(SourceError::CaseMismatch { .. })
    ));
    assert!(matches!(
        inspect_selected_tree(&root, &owner, &[member]),
        Err(SourceError::CaseMismatch { .. })
    ));
}
#[test]
fn selected_stat_reports_large_and_missing_members_without_payload_read() {
    let workspace = tempfile::tempdir().unwrap();
    std::fs::create_dir(workspace.path().join("owner")).unwrap();
    let large = std::fs::File::create(workspace.path().join("owner/large.bin")).unwrap();
    large.set_len(128 * 1024 * 1024).unwrap();
    drop(large);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            workspace.path().join("owner/large.bin"),
            std::fs::Permissions::from_mode(0o000),
        )
        .unwrap();
    }
    let root = open_root(workspace.path()).unwrap();
    let owner = RelativePath::new("owner").unwrap();
    let selected = inspect_selected_tree(
        &root,
        &owner,
        &[
            RelativePath::new("large.bin").unwrap(),
            RelativePath::new("missing.bin").unwrap(),
        ],
    )
    .unwrap();
    assert!(selected.belongs_to(&root, &owner));
    assert!(
        matches!(&selected.entries()[0], SelectedStatMember::Present { identity, .. } if identity.size == 128 * 1024 * 1024)
    );
    assert!(matches!(
        &selected.entries()[1],
        SelectedStatMember::Missing { .. }
    ));
}
#[test]
fn selected_tree_does_not_inspect_unselected_link() {
    let workspace = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::fs::create_dir(workspace.path().join("owner")).unwrap();
    std::fs::write(workspace.path().join("owner/selected.txt"), b"selected").unwrap();
    std::fs::write(outside.path().join("outside.txt"), b"outside").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        outside.path().join("outside.txt"),
        workspace.path().join("owner/ignored-link"),
    )
    .unwrap();
    let root = open_root(workspace.path()).unwrap();
    let owner = RelativePath::new("owner").unwrap();
    let selected =
        capture_selected_tree(&root, &owner, &[RelativePath::new("selected.txt").unwrap()])
            .unwrap();
    assert!(selected.belongs_to(&root, &owner));
    assert!(
        matches!(&selected.entries()[0], SelectedMember::Present(file) if file.bytes == b"selected")
    );
    assert!(
        capture_selected_tree(&root, &owner, &[RelativePath::new("ignored-link").unwrap()])
            .is_err()
    );
}
#[test]
fn missing_proof_tracks_observed_ancestor_extensions() {
    let workspace = tempfile::tempdir().unwrap();
    let root = open_root(workspace.path()).unwrap();
    let target = RelativePath::new("a/b/file.txt").unwrap();
    let initial = capture_missing(&root, &target).unwrap();
    let same = capture_missing(&root, &target).unwrap();
    assert!(initial.equivalent(&same));
    assert_eq!(
        create_exclusive(&root, &initial, CreateMode::Native(0o600))
            .unwrap_err()
            .effect,
        CreateEffect::NotStarted
    );
    let a = RelativePath::new("a").unwrap();
    let a_missing = capture_missing(&root, &a).unwrap();
    let made = create_directory_exclusive(&root, &a_missing, CreateMode::Native(0o700)).unwrap();
    let observed = made.identity.clone();
    drop(made);
    let extended = capture_missing(&root, &target).unwrap();
    assert!(!initial.equivalent(&extended));
    assert!(!initial.extends(&extended, &[]));
    assert!(initial.extends(&extended, &[(a, observed)]));
}
#[test]
fn exact_mkdir_never_chmods_replacement_observed_after_creation() {
    let workspace = tempfile::tempdir().unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("owner").unwrap();
    let proof = capture_missing(&root, &path).unwrap();
    #[cfg(unix)]
    let expected = 0o700;
    let observed = std::rc::Rc::new(std::cell::Cell::new(0u32));
    let hook_observed = observed.clone();
    let location = workspace.path().to_path_buf();
    set_mkdir_test_hook(move || {
        std::fs::rename(location.join("owner"), location.join("moved")).unwrap();
        std::fs::create_dir(location.join("owner")).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(
                location.join("owner"),
                std::fs::Permissions::from_mode(0o755),
            )
            .unwrap();
            hook_observed.set(
                std::fs::metadata(location.join("owner"))
                    .unwrap()
                    .permissions()
                    .mode(),
            );
        }
    });
    let result = create_directory_exclusive(&root, &proof, CreateMode::Exact(expected));
    assert_eq!(result.unwrap_err().effect, CreateEffect::Unknown);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(workspace.path().join("owner"))
                .unwrap()
                .permissions()
                .mode(),
            observed.get()
        );
    }
}
#[test]
fn missing_proof_checks_original_and_journaled_parent_chain() {
    let workspace = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(workspace.path().join("a/b")).unwrap();
    std::fs::write(workspace.path().join("a/b/item"), b"data").unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("a/b/item").unwrap();
    let ExpectedFile::Present(original) = capture(&root, &path).unwrap() else {
        panic!("source missing")
    };
    std::fs::remove_file(workspace.path().join("a/b/item")).unwrap();
    let same = capture_missing(&root, &path).unwrap();
    assert!(same.matches_parent_of(&original));
    assert!(same.matches_journaled_parent_of(&original, &[], &[]));
    drop(same);
    std::fs::rename(workspace.path().join("a/b"), workspace.path().join("a/old")).unwrap();
    std::fs::create_dir(workspace.path().join("a/b")).unwrap();
    let replacement = enumerate_directory(&root, &RelativePath::new("a/b").unwrap()).unwrap();
    let now = capture_missing(&root, &path).unwrap();
    assert!(!now.matches_journaled_parent_of(&original, &[], &[]));
    assert!(now.matches_journaled_parent_of(
        &original,
        &[(
            RelativePath::new("a/b").unwrap(),
            replacement.identity.clone()
        )],
        &[]
    ));
    drop(now);
    std::fs::remove_dir(workspace.path().join("a/b")).unwrap();
    let missing_ancestor = capture_missing(&root, &path).unwrap();
    assert!(!missing_ancestor.matches_journaled_parent_of(&original, &[], &[]));
    assert!(missing_ancestor.matches_journaled_parent_of(
        &original,
        &[],
        &[RelativePath::new("a/b").unwrap()]
    ));
    let dir_missing = capture_missing(&root, &RelativePath::new("a/b").unwrap()).unwrap();
    assert!(dir_missing.matches_journaled_parent_of_directory(&replacement, &[], &[]));
}
#[test]
fn collection_lock_is_exclusive_and_releases() {
    let workspace = tempfile::tempdir().expect("private workspace");
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new(".collection.lock").unwrap();
    let lock = acquire_collection_lock(&root, &path).unwrap();
    assert!(acquire_collection_lock(&root, &path).is_err());
    lock.release(&root).unwrap();
    assert!(!workspace.path().join(".collection.lock").exists());
}
#[test]
fn collection_lock_never_removes_replacement() {
    let workspace = tempfile::tempdir().expect("private workspace");
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new(".collection.lock").unwrap();
    let lock = acquire_collection_lock(&root, &path).unwrap();
    let original = workspace.path().join(".collection.lock");
    let moved = workspace.path().join("original.lock");
    if std::fs::rename(&original, &moved).is_ok() {
        std::fs::write(&original, b"rival").unwrap();
        assert!(lock.release(&root).is_err());
        assert_eq!(std::fs::read(&original).unwrap(), b"rival");
    } else {
        // On platforms that deny moving the open handle, the original lock
        // remains present and must still be releasable.
        assert!(original.exists());
        lock.release(&root).unwrap();
    }
}
#[test]
fn captures_only_the_selected_owner_tree_with_bytes() {
    let workspace = tempfile::tempdir().expect("private workspace");
    std::fs::create_dir_all(workspace.path().join("resources/selected/nested")).unwrap();
    std::fs::create_dir_all(workspace.path().join("resources/unselected")).unwrap();
    std::fs::write(
        workspace.path().join("resources/selected/nested/item.txt"),
        b"selected",
    )
    .unwrap();
    std::fs::write(
        workspace.path().join("resources/unselected/other.txt"),
        b"other",
    )
    .unwrap();
    let root = open_root(workspace.path()).expect("native platform source support required");
    let owner = RelativePath::new("resources/selected").unwrap();
    let tree = capture_tree(&root, &owner).unwrap();
    assert!(tree.belongs_to(&root, &owner));
    assert_eq!(tree.entries().len(), 3);
    assert!(tree.entries().iter().any(|entry| matches!(entry, TreeEntry::File { path, bytes, .. } if path.as_path().ends_with("item.txt") && bytes == b"selected")));
    assert!(!tree.belongs_to(&root, &RelativePath::new("resources/unselected").unwrap()));
}
#[test]
fn enumeration_reports_members_and_types() {
    let workspace = tempfile::tempdir().expect("private workspace");
    std::fs::create_dir(workspace.path().join("records")).unwrap();
    std::fs::create_dir(workspace.path().join("records/nested")).unwrap();
    std::fs::write(workspace.path().join("records/item.md"), b"content").unwrap();
    let root = open_root(workspace.path()).expect("native platform source support required");
    let snapshot = enumerate_directory(&root, &RelativePath::new("records").unwrap()).unwrap();
    assert_eq!(snapshot.members.len(), 2);
    assert_eq!(snapshot.members[0].name, "item.md");
    assert_eq!(snapshot.members[0].kind, MemberKind::File);
    assert_eq!(snapshot.members[1].name, "nested");
    assert_eq!(snapshot.members[1].kind, MemberKind::Directory);
}
