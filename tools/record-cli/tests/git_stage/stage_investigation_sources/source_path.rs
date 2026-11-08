use super::*;

#[derive(Clone, Copy)]
enum SourcePathCase {
    Add,
    Move,
    Delete,
    Swap,
}

type SourceRecord<'a> = (&'a str, &'a str, &'a str, &'a str);

fn prepare_source_baseline(root: &Path, case: SourcePathCase, a: &str, b: &str) -> Vec<u8> {
    let old_a = "old-location.md";
    let old_b = "other-location.md";
    let mut head = vec![("240229-beta", old_b, "Beta", b)];
    if !matches!(case, SourcePathCase::Add) {
        head.push(("240229-alpha", old_a, "Alpha", a));
        fs::write(root.join(old_a), a).unwrap();
    }
    fs::write(root.join(old_b), b).unwrap();
    if matches!(case, SourcePathCase::Delete) {
        fs::create_dir_all(root.join("_resources/240229-alpha")).unwrap();
        fs::write(
            root.join("_resources/240229-alpha/old.txt"),
            b"old resource\n",
        )
        .unwrap();
    }
    let head_index = source_index(&head);
    fs::write(root.join("investigation-index.json"), &head_index).unwrap();
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "source baseline"]);
    fs::write(root.join("unselected"), b"pending sentinel\n").unwrap();
    git(root, &["add", "--", "unselected"]);
    fs::write(root.join("unselected"), b"worktree sentinel\n").unwrap();
    let pending_b = source_doc("240229-beta", "Pending Beta");
    fs::write(root.join(old_b), &pending_b).unwrap();
    git(root, &["add", "--", old_b]);
    head_index
}

fn assert_source_paths(root: &Path, case: SourcePathCase, a: &str, b: &str) {
    let old_a = "old-location.md";
    let old_b = "other-location.md";
    match case {
        SourcePathCase::Add | SourcePathCase::Move => {
            assert_eq!(git(root, &["show", ":new-location.md"]), a.as_bytes());
            assert_eq!(
                fs::read(root.join("new-location.md")).unwrap(),
                a.as_bytes()
            );
            if matches!(case, SourcePathCase::Move) {
                assert_eq!(git(root, &["show", "HEAD:old-location.md"]), a.as_bytes());
                assert!(git(root, &["ls-files", "--stage", "--", old_a]).is_empty());
                assert!(!root.join(old_a).exists());
            } else {
                assert_eq!(
                    git(root, &["show", ":_resources/240229-alpha/new.txt"]),
                    b"new resource\n"
                );
            }
        }
        SourcePathCase::Delete => {
            assert_eq!(git(root, &["show", "HEAD:old-location.md"]), a.as_bytes());
            for path in [old_a, "_resources/240229-alpha/old.txt"] {
                assert!(git(root, &["ls-files", "--stage", "--", path]).is_empty());
                assert!(!root.join(path).exists());
            }
        }
        SourcePathCase::Swap => {
            assert_eq!(git(root, &["show", "HEAD:old-location.md"]), a.as_bytes());
            assert_eq!(git(root, &["show", "HEAD:other-location.md"]), b.as_bytes());
            assert_eq!(git(root, &["show", ":old-location.md"]), b.as_bytes());
            assert_eq!(git(root, &["show", ":other-location.md"]), a.as_bytes());
            assert_eq!(fs::read(root.join(old_a)).unwrap(), b.as_bytes());
            assert_eq!(fs::read(root.join(old_b)).unwrap(), a.as_bytes());
        }
    }
}

fn source_path_case(case: SourcePathCase) {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, investigation_scope::stage_investigations},
    };
    let dir = fixture();
    let root = dir.path();
    let a = source_doc("240229-alpha", "Alpha");
    let b = source_doc("240229-beta", "Beta");
    let old_a = "old-location.md";
    let old_b = "other-location.md";
    let head_index = prepare_source_baseline(root, case, &a, &b);
    let pending_b = source_doc("240229-beta", "Pending Beta");
    let (workspace, selected): (Vec<SourceRecord<'_>>, Vec<&str>) = match case {
        SourcePathCase::Add => {
            fs::write(root.join("new-location.md"), &a).unwrap();
            fs::create_dir_all(root.join("_resources/240229-alpha")).unwrap();
            fs::write(
                root.join("_resources/240229-alpha/new.txt"),
                b"new resource\n",
            )
            .unwrap();
            (
                vec![
                    ("240229-alpha", "new-location.md", "Alpha", &a),
                    ("240229-beta", old_b, "Beta", &b),
                ],
                vec!["240229-alpha"],
            )
        }
        SourcePathCase::Move => {
            fs::remove_file(root.join(old_a)).unwrap();
            fs::write(root.join("new-location.md"), &a).unwrap();
            (
                vec![
                    ("240229-alpha", "new-location.md", "Alpha", &a),
                    ("240229-beta", old_b, "Beta", &b),
                ],
                vec!["240229-alpha"],
            )
        }
        SourcePathCase::Delete => {
            fs::remove_file(root.join(old_a)).unwrap();
            fs::remove_file(root.join("_resources/240229-alpha/old.txt")).unwrap();
            (
                vec![("240229-beta", old_b, "Beta", &b)],
                vec!["240229-alpha"],
            )
        }
        SourcePathCase::Swap => {
            fs::write(root.join(old_a), &b).unwrap();
            fs::write(root.join(old_b), &a).unwrap();
            (
                vec![
                    ("240229-alpha", old_b, "Alpha", &a),
                    ("240229-beta", old_a, "Beta", &b),
                ],
                vec!["240229-alpha", "240229-beta"],
            )
        }
    };
    if !matches!(case, SourcePathCase::Swap) {
        fs::write(root.join(old_b), &b).unwrap();
    }
    let workspace_index = source_index(&workspace);
    fs::write(root.join("investigation-index.json"), &workspace_index).unwrap();
    let pending_index = git(root, &["show", ":investigation-index.json"]);
    let pending_other = git(root, &["show", ":unselected"]);
    let result = stage_investigations(
        &open_root(root).unwrap(),
        &RelativePath::new("investigation-index.json").unwrap(),
        &selected.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
        StageScope::Domain,
    )
    .unwrap();
    assert_eq!(result.selected_ids, selected);
    assert_eq!(
        git(root, &["show", "HEAD:investigation-index.json"]),
        head_index
    );
    assert_eq!(
        git(root, &["show", ":investigation-index.json"]),
        pending_index
    );
    assert_eq!(
        fs::read(root.join("investigation-index.json")).unwrap(),
        workspace_index
    );
    assert_eq!(git(root, &["show", ":unselected"]), pending_other);
    if !matches!(case, SourcePathCase::Swap) {
        assert_eq!(
            git(root, &["show", ":other-location.md"]),
            pending_b.as_bytes()
        );
        assert_eq!(fs::read(root.join(old_b)).unwrap(), b.as_bytes());
    }
    assert_source_paths(root, case, &a, &b);
}

#[test]
fn investigation_source_path_add_stages_selected_owner() {
    source_path_case(SourcePathCase::Add);
}
#[test]
fn investigation_source_path_move_stages_old_deletion_and_new_location() {
    source_path_case(SourcePathCase::Move);
}
#[test]
fn investigation_source_path_delete_stages_selected_owner_deletion() {
    source_path_case(SourcePathCase::Delete);
}
#[test]
fn investigation_source_path_swap_stages_both_selected_ids() {
    source_path_case(SourcePathCase::Swap);
}
