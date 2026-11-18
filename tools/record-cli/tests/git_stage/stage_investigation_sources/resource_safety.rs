#[cfg(unix)]
use super::*;

#[cfg(unix)]
#[test]
fn investigation_stage_rejects_unreferenced_owner_tree_symlinks_without_changing_pending() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    use std::os::unix::fs::symlink;

    for position in ["root", "owner", "member"] {
        let dir = fixture();
        let root = dir.path();
        let external = tempfile::tempdir().unwrap();
        fs::write(external.path().join("outside.txt"), b"outside remains\n").unwrap();
        let old = source_doc("240229-alpha", "Old");
        let current = source_doc("240229-alpha", "Current");
        fs::write(root.join("report.md"), &old).unwrap();
        fs::write(
            root.join("investigation-index.json"),
            source_index(&[("240229-alpha", "report.md", "Old", &old)]),
        )
        .unwrap();
        git(root, &["add", "--all"]);
        git(root, &["commit", "-qm", "symlink baseline"]);
        fs::write(root.join("unselected"), b"pending sentinel\n").unwrap();
        git(root, &["add", "--", "unselected"]);
        fs::write(root.join("unselected"), b"worktree sentinel\n").unwrap();
        fs::write(root.join("report.md"), &current).unwrap();
        let current_index = source_index(&[("240229-alpha", "report.md", "Current", &current)]);
        fs::write(root.join("investigation-index.json"), &current_index).unwrap();
        let resource_root = root.join("_resources");
        let owner = resource_root.join("240229-alpha");
        let link = match position {
            "root" => {
                symlink(external.path(), &resource_root).unwrap();
                resource_root
            }
            "owner" => {
                fs::create_dir(&resource_root).unwrap();
                symlink(external.path(), &owner).unwrap();
                owner
            }
            _ => {
                fs::create_dir_all(&owner).unwrap();
                let link = owner.join("unreferenced.txt");
                symlink(external.path().join("outside.txt"), &link).unwrap();
                link
            }
        };
        let before = git(root, &["ls-files", "--stage", "-z"]);
        let error = stage_investigations(
            &open_root(root).unwrap(),
            &RelativePath::new("investigation-index.json").unwrap(),
            &["240229-alpha".into()],
            StageScope::Domain,
        );
        assert!(error.is_err(), "{position}");
        assert_eq!(
            git(root, &["ls-files", "--stage", "-z"]),
            before,
            "{position}"
        );
        assert!(
            fs::symlink_metadata(&link)
                .unwrap()
                .file_type()
                .is_symlink()
        );
        assert_eq!(
            fs::read(external.path().join("outside.txt")).unwrap(),
            b"outside remains\n"
        );
        assert_eq!(
            fs::read(root.join("report.md")).unwrap(),
            current.as_bytes()
        );
        assert_eq!(
            fs::read(root.join("investigation-index.json")).unwrap(),
            current_index
        );
        assert_eq!(git(root, &["show", ":unselected"]), b"pending sentinel\n");
        assert_eq!(
            fs::read(root.join("unselected")).unwrap(),
            b"worktree sentinel\n"
        );
    }
}

#[cfg(unix)]
#[test]
fn investigation_stage_does_not_traverse_unselected_owner_symlink() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    use std::os::unix::fs::symlink;
    let dir = fixture();
    let root = dir.path();
    let external = tempfile::tempdir().unwrap();
    fs::write(external.path().join("sentinel"), b"outside").unwrap();
    let body = source_doc("240229-alpha", "Alpha");
    fs::write(root.join("source.md"), &body).unwrap();
    fs::write(
        root.join("investigation-index.json"),
        source_index(&[("240229-alpha", "source.md", "Alpha", &body)]),
    )
    .unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "baseline"]);
    fs::create_dir(root.join("_resources")).unwrap();
    symlink(external.path(), root.join("_resources/240229-other")).unwrap();
    stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &["240229-alpha".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert!(
        fs::symlink_metadata(root.join("_resources/240229-other"))
            .unwrap()
            .file_type()
            .is_symlink()
    );
    assert_eq!(
        fs::read(external.path().join("sentinel")).unwrap(),
        b"outside"
    );
    assert!(git(root, &["ls-files", "--", "_resources/240229-other"]).is_empty());
}
