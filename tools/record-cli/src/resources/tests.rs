use super::*;

#[test]
fn absent_owner_check_rejects_present_directory() {
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources");
    std::fs::create_dir_all(&base).unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    ResourceContext::open(&root, "investigations", true)
        .unwrap()
        .require_owner_absent("chosen")
        .unwrap();
    std::fs::create_dir(base.join("chosen")).unwrap();
    assert!(
        ResourceContext::open(&root, "investigations", true)
            .unwrap()
            .require_owner_absent("chosen")
            .is_err()
    );
}

#[test]
fn selected_resources_check_direct_members_and_owned_visibility() {
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources/chosen");
    std::fs::create_dir_all(&base).unwrap();
    std::fs::write(base.join("file.txt"), b"content").unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let mut context = ResourceContext::open(&root, "investigations", true).unwrap();
    assert!(
        context
            .direct_issues(&["chosen/file.txt".into()])
            .unwrap()
            .is_empty()
    );
    assert!(
        !context
            .direct_issues(&["chosen/missing.txt".into()])
            .unwrap()
            .is_empty()
    );
    assert!(
        context
            .visible_owned("chosen", &["chosen/file.txt".into()])
            .unwrap()
            .is_empty()
    );
}

#[cfg(any(unix, windows))]
#[test]
fn shared_directory_observations_scale_with_directories_not_references() {
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources/chosen");
    std::fs::create_dir_all(&base).unwrap();
    let ids: Vec<String> = (0..40)
        .map(|i| {
            std::fs::write(base.join(format!("file{i}.txt")), b"x").unwrap();
            format!("chosen/file{i}.txt")
        })
        .collect();
    let root = source::open_root(workspace.path()).unwrap();
    let mut context = ResourceContext::open(&root, "investigations", true).unwrap();
    assert!(context.direct_issues(&ids).unwrap().is_empty());
    assert_eq!(
        context.directory_enumerations, 2,
        "one observation per shared directory"
    );
}

#[cfg(unix)]
#[test]
fn refreshed_namespace_and_selected_types_preserve_path_safety() {
    use std::os::unix::fs::symlink;
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources/chosen");
    std::fs::create_dir_all(&base).unwrap();
    std::fs::write(base.join("File.txt"), b"x").unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let mut context = ResourceContext::open(&root, "investigations", true).unwrap();
    let issues = context.direct_issues(&["chosen/file.txt".into()]).unwrap();
    assert!(
        issues
            .iter()
            .any(|issue| issue.contains("actual path casing"))
    );
    // A new exact spelling can coexist with the cached folded name on Unix.
    std::fs::write(base.join("file.txt"), b"different").unwrap();
    let directory = std::path::PathBuf::from("investigations/_resources/chosen");
    let relative = RelativePath::new(&directory).unwrap();
    context.directories.get_mut(&directory).unwrap().version =
        source::resource_directory_version(&root, &relative).unwrap();
    assert!(
        context
            .direct_issues(&["chosen/file.txt".into()])
            .unwrap()
            .is_empty()
    );
    std::fs::write(base.join("new.txt"), b"x").unwrap();
    assert!(
        context
            .direct_issues(&["chosen/new.txt".into()])
            .unwrap()
            .is_empty()
    );
    symlink("File.txt", base.join("link.txt")).unwrap();
    // Model a filesystem whose directory timestamp did not change: reuse the
    // pre-link listing with the current version rather than relying on timing.
    context.directories.get_mut(&directory).unwrap().version =
        source::resource_directory_version(&root, &relative).unwrap();
    let issues = context.direct_issues(&["chosen/link.txt".into()]).unwrap();
    assert!(issues.iter().any(|issue| issue.contains("symbolic link")));
    std::fs::create_dir(base.join("sub")).unwrap();
    symlink("sub", base.join("alias")).unwrap();
    let issues = context
        .direct_issues(&["chosen/alias/file.txt".into()])
        .unwrap();
    assert!(issues.iter().any(|issue| issue.contains("symbolic link")));
}

#[cfg(windows)]
#[test]
fn case_mismatch_aliases_do_not_repeat_directory_enumeration() {
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources/chosen");
    std::fs::create_dir_all(&base).unwrap();
    std::fs::write(base.join("Filename.txt"), b"x").unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let mut context = ResourceContext::open(&root, "investigations", true).unwrap();
    for name in [
        "filename.txt",
        "FILENAME.txt",
        "FileName.txt",
        "fIlEnAmE.txt",
    ] {
        let issues = context.direct_issues(&[format!("chosen/{name}")]).unwrap();
        assert!(
            issues
                .iter()
                .any(|issue| issue.contains("actual path casing")),
            "{issues:?}"
        );
    }
    assert_eq!(context.directory_enumerations, 2);
    for (name, child) in [
        ("Chosen", "one.txt"),
        ("CHOSEN", "two.txt"),
        ("cHoSeN", "three.txt"),
        ("chOSen", "four.txt"),
    ] {
        let issues = context.direct_issues(&[format!("{name}/{child}")]).unwrap();
        assert!(
            issues
                .iter()
                .any(|issue| issue.contains("actual path casing")),
            "{issues:?}"
        );
    }
    assert_eq!(context.directory_enumerations, 2);
}
