use super::*;

#[test]
fn conditional_publication_preserves_other_pending_and_worktree() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    fs::write(root.join("deleted"), b"worktree sentinel\n").unwrap();
    git(root, &["add", "--", "deleted"]);
    git(
        root,
        &[
            "commit",
            "-qm",
            "tracked sentinel",
            "--only",
            "--",
            "deleted",
        ],
    );
    git(root, &["rm", "--cached", "--", "deleted"]);
    let oid = String::from_utf8(git(root, &["rev-parse", ":selected"])).unwrap();
    let oid = oid.trim();
    git(
        root,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            "100755",
            oid,
            "other-executable",
        ],
    );
    git(
        root,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            "120000",
            oid,
            "other-symlink",
        ],
    );
    let untouched_modes = git(
        root,
        &[
            "ls-files",
            "--stage",
            "--",
            "other-executable",
            "other-symlink",
        ],
    );
    git(root, &["update-index", "--skip-worktree", "unselected"]);
    let before_flags = git(root, &["ls-files", "-v", "--", "unselected"]);
    let before_other = git(root, &["show", ":unselected"]);
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"new pending\n".to_vec(),
        }),
    }];
    let result = replace_selected(root, &snapshot, &updates);
    assert_eq!(
        result.unwrap().changed_paths,
        vec![PathBuf::from("selected")]
    );
    assert_eq!(git(root, &["show", ":selected"]), b"new pending\n");
    assert_eq!(git(root, &["show", ":unselected"]), before_other);
    assert_eq!(
        git(root, &["ls-files", "-v", "--", "unselected"]),
        before_flags
    );
    assert_eq!(fs::read(root.join("selected")).unwrap(), b"worktree\n");
    assert_eq!(
        fs::read(root.join("deleted")).unwrap(),
        b"worktree sentinel\n"
    );
    assert!(git(root, &["ls-files", "--", "deleted"]).is_empty());
    assert_eq!(
        git(
            root,
            &[
                "ls-files",
                "--stage",
                "--",
                "other-executable",
                "other-symlink"
            ]
        ),
        untouched_modes
    );
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn busy_git_lock_reports_unknown_and_keeps_lock() {
    use record_cli::git::publish::{FailureKind, PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"new\n".to_vec(),
        }),
    }];
    fs::write(root.join(".git/index.lock"), b"other owner").unwrap();
    assert_eq!(
        replace_selected(root, &snapshot, &updates)
            .unwrap_err()
            .kind,
        FailureKind::PartialOrUnknown
    );
    assert_eq!(
        fs::read(root.join(".git/index.lock")).unwrap(),
        b"other owner"
    );
    assert_eq!(git(root, &["show", ":selected"]), b"pending\n");
}
#[test]
fn conditional_publication_deletes_adds_and_keeps_unchanged_entries() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let selected = vec![PathBuf::from("selected"), PathBuf::from("new")];
    let snapshot = read_selected(root, &selected).unwrap();
    let updates = [
        PendingUpdate {
            path: PathBuf::from("selected"),
            file: None,
        },
        PendingUpdate {
            path: PathBuf::from("new"),
            file: Some(PendingFile {
                mode: 0o100755,
                bytes: b"new executable\n".to_vec(),
            }),
        },
    ];
    let changed = replace_selected(root, &snapshot, &updates)
        .unwrap()
        .changed_paths;
    assert_eq!(
        changed,
        vec![PathBuf::from("new"), PathBuf::from("selected")]
    );
    let raw = String::from_utf8(git(root, &["ls-files", "--stage"])).unwrap();
    assert!(
        raw.lines()
            .any(|line| line.starts_with("100755 ") && line.ends_with("\tnew"))
    );
    assert!(!raw.lines().any(|line| line.ends_with("\tselected")));
    assert_eq!(git(root, &["show", ":new"]), b"new executable\n");
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
    let fresh = read_selected(root, &selected).unwrap();
    assert!(
        replace_selected(root, &fresh, &updates)
            .unwrap()
            .changed_paths
            .is_empty()
    );
    assert!(!root.join(".git/index.lock").exists());
}

#[test]
fn conditional_publication_preserves_requested_git_symlink_representation() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let result = replace_selected(
        root,
        &snapshot,
        &[PendingUpdate {
            path: PathBuf::from("selected"),
            file: Some(PendingFile {
                mode: 0o120000,
                bytes: b"target/path".to_vec(),
            }),
        }],
    )
    .unwrap();
    assert_eq!(result.changed_paths, [PathBuf::from("selected")]);
    let metadata =
        String::from_utf8(git(root, &["ls-files", "--stage", "--", "selected"])).unwrap();
    assert!(metadata.starts_with("120000 "));
    assert_eq!(git(root, &["show", ":selected"]), b"target/path");
    assert_eq!(fs::read(root.join("selected")).unwrap(), b"worktree\n");
}
#[test]
fn disabled_filemode_preserves_pending_executable_representation() {
    use record_cli::{
        git::{core_file_mode, workspace_file_mode},
        source::{ExpectedFile, RelativePath, capture, open_root},
    };
    let dir = fixture();
    let root = dir.path();
    git(root, &["config", "core.filemode", "false"]);
    git(root, &["update-index", "--chmod=+x", "selected"]);
    let pending = read_pending(root).unwrap();
    let source = match capture(
        &open_root(root).unwrap(),
        &RelativePath::new("selected").unwrap(),
    )
    .unwrap()
    {
        ExpectedFile::Present(source) => source,
        ExpectedFile::Missing => panic!("fixture source missing"),
    };
    assert!(!core_file_mode(root).unwrap());
    assert_eq!(
        workspace_file_mode(&open_root(root).unwrap(), &source, &pending, false).unwrap(),
        0o100755
    );
    git(root, &["update-index", "--chmod=-x", "selected"]);
    let next = read_pending(root).unwrap();
    assert_eq!(
        workspace_file_mode(&open_root(root).unwrap(), &source, &next, false).unwrap(),
        0o100644
    );
}

#[test]
fn publication_rejects_file_directory_conflicts_without_changing_pending() {
    use record_cli::git::publish::{FailureKind, PendingFile, PendingUpdate, replace_selected};
    for (existing, selected) in [("clash/child", "clash"), ("clash", "clash/child")] {
        let dir = fixture();
        let root = dir.path();
        let oid = String::from_utf8(git(root, &["rev-parse", ":unselected"])).unwrap();
        git(
            root,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                &format!("100644,{},{}", oid.trim(), existing),
            ],
        );
        let before = git(root, &["ls-files", "--stage", "-z"]);
        let index_before = fs::read(root.join(".git/index")).unwrap();
        let other = git(root, &["show", &format!(":{existing}")]);
        let snapshot = read_selected(root, &[PathBuf::from(selected)]).unwrap();
        let updates = [PendingUpdate {
            path: selected.into(),
            file: Some(PendingFile {
                mode: 0o100644,
                bytes: b"replacement".to_vec(),
            }),
        }];
        let error = replace_selected(root, &snapshot, &updates).unwrap_err();
        assert_eq!(error.kind, FailureKind::Failed);
        assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));
        assert_eq!(index_before, fs::read(root.join(".git/index")).unwrap());
        assert_eq!(other, git(root, &["show", &format!(":{existing}")]));
    }
}

#[test]
fn publication_rejects_conflicting_upserts_but_allows_selected_path_replacement() {
    use record_cli::git::publish::{FailureKind, PendingFile, PendingUpdate, replace_selected};
    let file = || {
        Some(PendingFile {
            mode: 0o100644,
            bytes: b"replacement".to_vec(),
        })
    };
    let dir = fixture();
    let root = dir.path();
    let paths = [PathBuf::from("clash"), PathBuf::from("clash/child")];
    let snapshot = read_selected(root, &paths).unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    let updates = paths.map(|path| PendingUpdate { path, file: file() });
    assert_eq!(
        replace_selected(root, &snapshot, &updates)
            .unwrap_err()
            .kind,
        FailureKind::Failed
    );
    assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));

    for (existing, replacement) in [("clash/child", "clash"), ("clash", "clash/child")] {
        let dir = fixture();
        let root = dir.path();
        let oid = String::from_utf8(git(root, &["rev-parse", ":unselected"])).unwrap();
        git(
            root,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                &format!("100644,{},{}", oid.trim(), existing),
            ],
        );
        let snapshot = read_selected(root, &[existing.into(), replacement.into()]).unwrap();
        let updates = [
            PendingUpdate {
                path: existing.into(),
                file: None,
            },
            PendingUpdate {
                path: replacement.into(),
                file: file(),
            },
        ];
        replace_selected(root, &snapshot, &updates).unwrap();
        assert_eq!(
            git(root, &["show", &format!(":{replacement}")]),
            b"replacement"
        );
        assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
    }
}

#[test]
fn publication_allows_textual_prefix_without_component_conflict() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let oid = String::from_utf8(git(root, &["rev-parse", ":unselected"])).unwrap();
    git(
        root,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            &format!("100644,{},ab/file", oid.trim()),
        ],
    );
    let snapshot = read_selected(root, &["a".into()]).unwrap();
    replace_selected(
        root,
        &snapshot,
        &[PendingUpdate {
            path: "a".into(),
            file: Some(PendingFile {
                mode: 0o100644,
                bytes: b"a".to_vec(),
            }),
        }],
    )
    .unwrap();
    assert_eq!(git(root, &["show", ":a"]), b"a");
    assert_eq!(git(root, &["show", ":ab/file"]), b"other pending\n");
}

#[cfg(unix)]
#[test]
fn selected_executable_only_change_updates_mode_once() {
    use record_cli::{
        git::{
            core_file_mode,
            publish::{PendingFile, PendingUpdate, replace_selected},
            workspace_file_mode,
        },
        source::{ExpectedFile, RelativePath, capture, open_root},
    };
    use std::os::unix::fs::PermissionsExt;
    let dir = fixture();
    let root = dir.path();
    git(root, &["config", "core.filemode", "true"]);
    fs::write(root.join("selected"), b"pending\n").unwrap();
    fs::set_permissions(root.join("selected"), fs::Permissions::from_mode(0o755)).unwrap();
    let before = String::from_utf8(git(root, &["ls-files", "--stage", "--", "selected"])).unwrap();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let pending = read_pending(root).unwrap();
    let handle = open_root(root).unwrap();
    let ExpectedFile::Present(source) =
        capture(&handle, &RelativePath::new("selected").unwrap()).unwrap()
    else {
        panic!("missing fixture")
    };
    assert!(core_file_mode(root).unwrap());
    let mode = workspace_file_mode(&handle, &source, &pending, true).unwrap();
    assert_eq!(mode, 0o100755);
    let update = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode,
            bytes: source.bytes,
        }),
    }];
    assert_eq!(
        replace_selected(root, &snapshot, &update)
            .unwrap()
            .changed_paths,
        vec![PathBuf::from("selected")]
    );
    let after = String::from_utf8(git(root, &["ls-files", "--stage", "--", "selected"])).unwrap();
    assert!(before.starts_with("100644 "));
    assert!(after.starts_with("100755 "));
    assert_eq!(
        before.split_whitespace().nth(1),
        after.split_whitespace().nth(1)
    );
    let fresh = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    assert!(
        replace_selected(root, &fresh, &update)
            .unwrap()
            .changed_paths
            .is_empty()
    );
}
