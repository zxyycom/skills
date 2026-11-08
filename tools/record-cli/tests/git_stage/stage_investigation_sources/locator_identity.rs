use super::*;

#[test]
fn investigation_source_path_uses_index_not_another_ids_canonical_filename() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    let alpha_old = source_doc("240229-alpha", "Alpha");
    let alpha_new = source_doc("240229-alpha", "Updated Alpha");
    let beta = source_doc("240229-beta", "Beta");
    let beta_pending = source_doc("240229-beta", "Pending Beta");
    let beta_work = source_doc("240229-beta", "Workspace Beta");
    fs::write(root.join("semantic-name.md"), &alpha_old).unwrap();
    fs::write(root.join("240229-alpha.md"), &beta).unwrap();
    let head_index = source_index(&[
        ("240229-alpha", "semantic-name.md", "Alpha", &alpha_old),
        ("240229-beta", "240229-alpha.md", "Beta", &beta),
    ]);
    fs::write(root.join("investigation-index.json"), &head_index).unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "source collision baseline"]);
    fs::write(root.join("240229-alpha.md"), &beta_pending).unwrap();
    git(root, &["add", "--", "240229-alpha.md"]);
    fs::write(root.join("240229-alpha.md"), &beta_work).unwrap();
    fs::write(root.join("semantic-name.md"), &alpha_new).unwrap();
    let workspace_index = source_index(&[
        (
            "240229-alpha",
            "semantic-name.md",
            "Updated Alpha",
            &alpha_new,
        ),
        (
            "240229-beta",
            "240229-alpha.md",
            "Workspace Beta",
            &beta_work,
        ),
    ]);
    fs::write(root.join("investigation-index.json"), &workspace_index).unwrap();
    let before_index = git(root, &["show", ":investigation-index.json"]);
    let result = stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["240229-alpha".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-alpha"]);
    assert_eq!(
        git(root, &["show", "HEAD:semantic-name.md"]),
        alpha_old.as_bytes()
    );
    assert_eq!(
        git(root, &["show", "HEAD:240229-alpha.md"]),
        beta.as_bytes()
    );
    assert_eq!(
        git(root, &["show", ":semantic-name.md"]),
        alpha_new.as_bytes()
    );
    assert_eq!(
        git(root, &["show", ":240229-alpha.md"]),
        beta_pending.as_bytes()
    );
    assert_eq!(
        fs::read(root.join("semantic-name.md")).unwrap(),
        alpha_new.as_bytes()
    );
    assert_eq!(
        fs::read(root.join("240229-alpha.md")).unwrap(),
        beta_work.as_bytes()
    );
    assert_eq!(
        git(root, &["show", ":investigation-index.json"]),
        before_index
    );
    assert_eq!(
        fs::read(root.join("investigation-index.json")).unwrap(),
        workspace_index
    );
}

#[test]
fn investigation_source_path_reuse_preserves_new_selected_id_at_old_path() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    let old = source_doc("240229-zulu", "Old");
    let new = source_doc("240229-alpha", "New");
    fs::write(root.join("common.md"), &old).unwrap();
    let head_index = source_index(&[("240229-zulu", "common.md", "Old", &old)]);
    fs::write(root.join("investigation-index.json"), &head_index).unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "source reuse baseline"]);
    fs::write(root.join("unselected"), b"pending sentinel\n").unwrap();
    git(root, &["add", "--", "unselected"]);
    fs::write(root.join("unselected"), b"worktree sentinel\n").unwrap();
    fs::write(root.join("common.md"), &new).unwrap();
    let workspace_index = source_index(&[("240229-alpha", "common.md", "New", &new)]);
    fs::write(root.join("investigation-index.json"), &workspace_index).unwrap();
    let before_index = git(root, &["show", ":investigation-index.json"]);
    let before_other = git(root, &["show", ":unselected"]);
    let result = stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["240229-zulu".into(), "240229-alpha".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert_eq!(result.selected_ids, ["240229-zulu", "240229-alpha"]);
    assert_eq!(git(root, &["show", "HEAD:common.md"]), old.as_bytes());
    assert_eq!(git(root, &["show", ":common.md"]), new.as_bytes());
    assert_eq!(fs::read(root.join("common.md")).unwrap(), new.as_bytes());
    assert_eq!(
        git(
            root,
            &["diff", "--cached", "--name-status", "--", "common.md"]
        ),
        b"M\tcommon.md\n"
    );
    assert_eq!(
        git(root, &["show", ":investigation-index.json"]),
        before_index
    );
    assert_eq!(
        fs::read(root.join("investigation-index.json")).unwrap(),
        workspace_index
    );
    assert_eq!(git(root, &["show", ":unselected"]), before_other);
    assert_eq!(
        fs::read(root.join("unselected")).unwrap(),
        b"worktree sentinel\n"
    );
}
