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
