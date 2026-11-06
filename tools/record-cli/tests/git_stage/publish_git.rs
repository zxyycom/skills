use super::*;

#[test]
fn conditional_publication_preserves_other_pending_and_worktree() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    git(root, &["update-index", "--skip-worktree", "unselected"]);
    let before_flags = git(root, &["ls-files", "-v", "--", "unselected"]);
    let fixed = head(root).unwrap();
    let before_other = git(root, &["show", ":unselected"]);
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"new pending\n".to_vec(),
        }),
    }];
    let result = replace_selected(root, &fixed, &snapshot, &updates);
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
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn conditional_publication_rejects_stale_pending_and_busy_lock() {
    use record_cli::git::publish::{FailureKind, PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
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
        replace_selected(root, &fixed, &snapshot, &updates)
            .unwrap_err()
            .kind,
        FailureKind::Conflict
    );
    assert_eq!(
        fs::read(root.join(".git/index.lock")).unwrap(),
        b"other owner"
    );
    fs::remove_file(root.join(".git/index.lock")).unwrap();
    fs::write(root.join("unselected"), b"winner\n").unwrap();
    git(root, &["add", "--", "unselected"]);
    assert_eq!(
        replace_selected(root, &fixed, &snapshot, &updates)
            .unwrap_err()
            .kind,
        FailureKind::Conflict
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"winner\n");
    assert_eq!(git(root, &["show", ":selected"]), b"pending\n");
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn conditional_publication_deletes_adds_and_keeps_unchanged_entries() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
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
    let changed = replace_selected(root, &fixed, &snapshot, &updates)
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
        replace_selected(root, &fixed, &fresh, &updates)
            .unwrap()
            .changed_paths
            .is_empty()
    );
    assert!(!root.join(".git/index.lock").exists());
}

#[test]
fn source_guard_conflict_is_observed_while_real_git_lock_is_held() {
    use record_cli::git::publish::{
        FailureKind, GuardFailure, PendingFile, PendingUpdate, replace_selected_guarded,
    };
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"new\n".to_vec(),
        }),
    }];
    let error = replace_selected_guarded(root, &fixed, &snapshot, &updates, || {
        assert!(root.join(".git/index.lock").exists());
        let competing = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(["add", "--", "selected"])
            .output()
            .unwrap();
        assert!(
            !competing.status.success(),
            "Git writer must respect the held index lock"
        );
        fs::write(root.join("selected"), b"source changed\n").unwrap();
        Err(GuardFailure::Conflict)
    })
    .unwrap_err();
    assert_eq!(error.kind, FailureKind::Conflict);
    assert_eq!(git(root, &["show", ":selected"]), b"pending\n");
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
    assert_eq!(
        fs::read(root.join("selected")).unwrap(),
        b"source changed\n"
    );
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn source_guard_abort_cleans_owned_git_lock_without_publishing() {
    use record_cli::git::publish::{
        FailureKind, PendingFile, PendingUpdate, replace_selected_guarded,
    };
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"new\n".to_vec(),
        }),
    }];
    let error = replace_selected_guarded(root, &fixed, &snapshot, &updates, || {
        panic!("fixture guard abort")
    })
    .unwrap_err();
    assert_eq!(error.kind, FailureKind::Failed);
    assert_eq!(git(root, &["show", ":selected"]), b"pending\n");
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn noncooperative_index_change_during_guard_is_detected_and_preserved() {
    use record_cli::git::publish::{
        FailureKind, PendingFile, PendingUpdate, replace_selected_guarded,
    };
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"our proposal\n".to_vec(),
        }),
    }];
    let error = replace_selected_guarded(root, &fixed, &snapshot, &updates, || {
        let index = root.join(".git/index");
        let rival = root.join(".git/rival-index");
        fs::copy(&index, &rival).unwrap();
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .env("GIT_INDEX_FILE", &rival)
            .args(["add", "--", "selected"])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        fs::rename(&rival, &index).unwrap();
        Ok(())
    })
    .unwrap_err();
    assert_eq!(error.kind, FailureKind::Conflict);
    assert_eq!(git(root, &["show", ":selected"]), b"worktree\n");
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
    assert!(!root.join(".git/index.lock").exists());
}
#[test]
fn replaced_lock_is_never_deleted_as_if_owned() {
    use record_cli::git::publish::{
        FailureKind, PendingFile, PendingUpdate, replace_selected_guarded,
    };
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let updates = [PendingUpdate {
        path: PathBuf::from("selected"),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"proposal\n".to_vec(),
        }),
    }];
    let error = replace_selected_guarded(root, &fixed, &snapshot, &updates, || {
        fs::rename(
            root.join(".git/index.lock"),
            root.join(".git/displaced-lock"),
        )
        .unwrap();
        fs::write(root.join(".git/index.lock"), b"other owner").unwrap();
        Ok(())
    })
    .unwrap_err();
    assert_eq!(error.kind, FailureKind::RecoveryFailed);
    assert_eq!(
        fs::read(root.join(".git/index.lock")).unwrap(),
        b"other owner"
    );
    assert_eq!(git(root, &["show", ":selected"]), b"pending\n");
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
#[test]
fn conditional_publication_preserves_requested_git_symlink_representation() {
    use record_cli::git::publish::{PendingFile, PendingUpdate, replace_selected};
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    let snapshot = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let result = replace_selected(
        root,
        &fixed,
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
        workspace_file_mode(&source, &pending, false).unwrap(),
        0o100755
    );
    git(root, &["update-index", "--chmod=-x", "selected"]);
    let next = read_pending(root).unwrap();
    assert_eq!(
        workspace_file_mode(&source, &next, false).unwrap(),
        0o100644
    );
}
