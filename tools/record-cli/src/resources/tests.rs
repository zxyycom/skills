use super::*;
#[test]
fn absent_owner_is_bound_and_empty_or_case_alias_is_rejected() {
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources");
    std::fs::create_dir_all(&base).unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let mut first = ResourceContext::open(&root, "investigations", true).unwrap();
    first.require_owner_absent("chosen").unwrap();
    let first = first.into_evidence();
    let mut second = ResourceContext::open(&root, "investigations", true).unwrap();
    second.require_owner_absent("chosen").unwrap();
    assert!(first.equivalent(&second.into_evidence()));
    std::fs::create_dir(base.join("chosen")).unwrap();
    let mut present = ResourceContext::open(&root, "investigations", true).unwrap();
    assert!(present.require_owner_absent("chosen").is_err());
    std::fs::remove_dir(base.join("chosen")).unwrap();
    std::fs::create_dir(base.join("Chosen")).unwrap();
    let mut alias = ResourceContext::open(&root, "investigations", true).unwrap();
    assert!(alias.require_owner_absent("chosen").is_err());
}
fn selected(root: &Root) -> ResourceEvidence {
    let mut context = ResourceContext::open(root, "investigations", true).unwrap();
    assert!(
        context
            .direct_issues(&["chosen/file.txt".into()])
            .unwrap()
            .is_empty()
    );
    context
        .visible_owned("chosen", &["chosen/file.txt".into()])
        .unwrap();
    context.into_evidence()
}
#[test]
fn evidence_distinguishes_missing_root_and_empty_selected_owner() {
    let workspace = tempfile::tempdir().unwrap();
    std::fs::create_dir(workspace.path().join("investigations")).unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let missing = ResourceContext::open(&root, "investigations", false)
        .unwrap()
        .into_evidence();
    let same = ResourceContext::open(&root, "investigations", false)
        .unwrap()
        .into_evidence();
    assert!(missing.equivalent(&same));
    std::fs::create_dir_all(workspace.path().join("investigations/_resources/chosen")).unwrap();
    let mut present = ResourceContext::open(&root, "investigations", true).unwrap();
    assert!(present.visible_owned("chosen", &[]).unwrap().is_empty());
    let present = present.into_evidence();
    assert!(!missing.equivalent(&present));
    let mut same = ResourceContext::open(&root, "investigations", true).unwrap();
    assert!(same.visible_owned("chosen", &[]).unwrap().is_empty());
    assert!(present.equivalent(&same.into_evidence()));
}
#[test]
fn selected_git_evidence_ignores_other_owner_membership() {
    let workspace = tempfile::tempdir().unwrap();
    let initialized = std::process::Command::new("git")
        .arg("-C")
        .arg(workspace.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(initialized.success());
    let base = workspace.path().join("investigations/_resources");
    std::fs::create_dir_all(base.join("chosen")).unwrap();
    std::fs::create_dir_all(base.join("other")).unwrap();
    std::fs::write(base.join("chosen/file.txt"), b"first").unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let before = selected(&root);
    std::fs::write(base.join("other/unselected.txt"), b"other").unwrap();
    let after = selected(&root);
    assert!(before.equivalent(&after));
    std::fs::write(base.join("chosen/new.txt"), b"new").unwrap();
    let changed = selected(&root);
    assert!(!before.equivalent(&changed));
}
#[test]
fn selected_evidence_ignores_payload_and_other_owner_but_detects_replacement() {
    let workspace = tempfile::tempdir().unwrap();
    let base = workspace.path().join("investigations/_resources");
    std::fs::create_dir_all(base.join("chosen")).unwrap();
    std::fs::create_dir_all(base.join("other")).unwrap();
    std::fs::write(base.join("chosen/file.txt"), b"first").unwrap();
    let root = source::open_root(workspace.path()).unwrap();
    let before = selected(&root);
    std::fs::write(base.join("chosen/file.txt"), b"new payload and length").unwrap();
    std::fs::write(base.join("other/unselected.txt"), b"other").unwrap();
    let same = selected(&root);
    assert!(before.equivalent(&same));
    std::fs::rename(base.join("chosen/file.txt"), base.join("chosen/old.txt")).unwrap();
    std::fs::write(base.join("chosen/file.txt"), b"replacement").unwrap();
    let replaced = selected(&root);
    assert!(!before.equivalent(&replaced));
}
