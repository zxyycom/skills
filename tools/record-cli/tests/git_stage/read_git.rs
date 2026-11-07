use super::*;

#[test]
fn fixed_head_and_selected_content_preserve_unrelated_pending() {
    let dir = fixture();
    let root = dir.path();
    let before = git(root, &["diff", "--cached", "--binary"]);
    let fixed = head(root).unwrap();
    assert_eq!(
        format!("{fixed}\n").as_bytes(),
        git(root, &["rev-parse", "HEAD"])
    );
    let snapshot =
        read_selected(root, &[PathBuf::from("selected"), PathBuf::from("missing")]).unwrap();
    assert_eq!(snapshot.membership().entries.len(), 2);
    assert_eq!(
        snapshot.blobs(),
        vec![(PathBuf::from("selected"), b"pending\n".to_vec())]
    );
    assert_eq!(fs::read(root.join("selected")).unwrap(), b"worktree\n");
    assert_eq!(before, git(root, &["diff", "--cached", "--binary"]));
    assert_eq!(*snapshot.membership(), read_pending(root).unwrap());
}
#[test]
fn selected_invalid_path_fails_without_writes() {
    let dir = fixture();
    let root = dir.path();
    let before = git(root, &["diff", "--cached", "--binary"]);
    assert!(read_selected(root, &[PathBuf::from("../escape")]).is_err());
    assert_eq!(before, git(root, &["diff", "--cached", "--binary"]));
}

#[test]
fn unread_unselected_blob_does_not_block_selected_content() {
    let dir = fixture();
    let root = dir.path();
    let oid = String::from_utf8(git(root, &["rev-parse", ":unselected"])).unwrap();
    let oid = oid.trim();
    let object = root.join(".git/objects").join(&oid[..2]).join(&oid[2..]);
    assert!(object.is_file());
    fs::remove_file(object).unwrap();
    let selected = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    assert_eq!(selected.blobs()[0].1, b"pending\n");
    assert!(read_selected(root, &[PathBuf::from("unselected")]).is_err());
    assert_eq!(
        fs::read(root.join("unselected")).unwrap(),
        b"other pending\n"
    );
}

#[test]
fn revision_file_uses_fixed_commit_and_literal_path() {
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    assert_eq!(
        read_revision_file(root, &fixed, Path::new("selected")).unwrap(),
        Some((0o100644, b"head\n".to_vec()))
    );
    assert_eq!(
        read_revision_file(root, &fixed, Path::new("missing")).unwrap(),
        None
    );
    assert!(read_revision_file(root, "HEAD", Path::new("selected")).is_err());
}

#[test]
fn selected_unmerged_rejected_unselected_unmerged_preserved() {
    use std::io::Write;
    use std::process::Stdio;
    let dir = fixture();
    let root = dir.path();
    let oid = String::from_utf8(git(root, &["rev-parse", ":unselected"])).unwrap();
    let oid = oid.trim();
    let mut child = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["update-index", "--index-info"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    write!(
        child.stdin.take().unwrap(),
        "0 {}\tunselected\n100644 {oid} 1\tunselected\n100644 {oid} 2\tunselected\n",
        "0".repeat(oid.len())
    )
    .unwrap();
    assert!(child.wait().unwrap().success());
    let before = git(root, &["ls-files", "--stage", "-z"]);
    assert!(read_selected(root, &[PathBuf::from("selected")]).is_ok());
    assert!(read_selected(root, &[PathBuf::from("unselected")]).is_err());
    assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));
    let unrelated = git(root, &["ls-files", "--stage", "-z", "--", "unselected"]);
    let snap = read_selected(root, &[PathBuf::from("selected")]).unwrap();
    let result = record_cli::git::publish::replace_selected(
        root,
        &snap,
        &[record_cli::git::publish::PendingUpdate {
            path: PathBuf::from("selected"),
            file: Some(record_cli::git::publish::PendingFile {
                mode: 0o100644,
                bytes: b"selected update\n".to_vec(),
            }),
        }],
    )
    .unwrap();
    assert_eq!(result.changed_paths, [PathBuf::from("selected")]);
    assert_eq!(
        unrelated,
        git(root, &["ls-files", "--stage", "-z", "--", "unselected"])
    );
}

#[test]
fn managed_membership_from_nested_workspace_keeps_tracked_missing_and_excludes_ignored() {
    use record_cli::git::{GitError, list_repository_workspace_files};
    let dir = fixture();
    let root = dir.path();
    fs::create_dir_all(root.join("domain/owner")).unwrap();
    fs::create_dir_all(root.join("nested")).unwrap();
    fs::write(root.join("domain/owner/tracked.bin"), b"tracked").unwrap();
    git(root, &["add", "--", "domain/owner/tracked.bin"]);
    fs::write(root.join(".gitignore"), b"domain/owner/*.bin\n").unwrap();
    fs::write(root.join("domain/owner/ignored.bin"), b"ignore").unwrap();
    fs::write(root.join("domain/owner/live.txt"), b"include").unwrap();
    fs::remove_file(root.join("domain/owner/tracked.bin")).unwrap();
    let files =
        list_repository_workspace_files(&root.join("nested"), &[PathBuf::from("domain/owner")])
            .unwrap();
    assert_eq!(
        files,
        vec![
            PathBuf::from("domain/owner/live.txt"),
            PathBuf::from("domain/owner/tracked.bin")
        ]
    );
    let standalone = tempfile::tempdir().unwrap();
    assert!(matches!(
        list_repository_workspace_files(standalone.path(), &[PathBuf::from("domain")]),
        Err(GitError::NotRepository)
    ));
    fs::write(standalone.path().join(".git"), b"broken metadata").unwrap();
    assert!(!matches!(
        list_repository_workspace_files(standalone.path(), &[PathBuf::from("domain")]),
        Err(GitError::NotRepository)
    ));
}
#[test]
fn fixed_revision_membership_does_not_open_unselected_or_selected_blobs() {
    use record_cli::git::{list_revision_files, read_revision_file};
    let dir = fixture();
    let root = dir.path();
    let fixed = head(root).unwrap();
    let oid = String::from_utf8(git(root, &["rev-parse", "HEAD:selected"])).unwrap();
    let oid = oid.trim();
    fs::remove_file(root.join(".git/objects").join(&oid[..2]).join(&oid[2..])).unwrap();
    let entries = list_revision_files(root, &fixed, &[PathBuf::from("selected")]).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].path, PathBuf::from("selected"));
    assert_eq!(entries[0].oid, oid);
    assert!(read_revision_file(root, &fixed, Path::new("selected")).is_err());
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}
#[test]
fn head_probe_distinguishes_unborn_commit_and_corrupt_ref() {
    use record_cli::git::{GitError, HeadState, probe_head};
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git(root, &["init", "-q"]);
    git(root, &["config", "user.name", "Fixture"]);
    git(root, &["config", "user.email", "fixture@example.invalid"]);
    assert_eq!(probe_head(root).unwrap(), HeadState::Unborn);
    fs::write(root.join("file"), b"content\n").unwrap();
    git(root, &["add", "--", "file"]);
    git(root, &["commit", "-qm", "baseline"]);
    assert_eq!(
        probe_head(root).unwrap(),
        HeadState::Commit(head(root).unwrap())
    );
    let reference = String::from_utf8(git(root, &["symbolic-ref", "--quiet", "HEAD"])).unwrap();
    fs::write(
        root.join(".git").join(reference.trim()),
        format!("{}\n", "f".repeat(40)),
    )
    .unwrap();
    assert!(matches!(
        probe_head(root),
        Err(GitError::Failed { .. }) | Err(GitError::InvalidOutput(_))
    ));
    let outside = tempfile::tempdir().unwrap();
    assert!(matches!(
        probe_head(outside.path()),
        Err(GitError::NotRepository)
    ));
}
#[test]
fn stage_root_discovery_distinguishes_nonrepository_from_broken_git_metadata() {
    use record_cli::{
        domains::decision,
        git::GitError,
        source::{RelativePath, open_root},
        stage::index_scope::{IndexStageError, stage_index},
    };
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let path = RelativePath::new("decision-index.json").unwrap();
    let result = stage_index(
        &open_root(root).unwrap(),
        &path,
        &decision::Definition,
        &["240229-record".into()],
        |state| &state.name,
    );
    assert!(matches!(
        result,
        Err(IndexStageError::Git(GitError::NotRepository))
    ));
    fs::write(root.join(".git"), b"invalid git metadata").unwrap();
    let broken = stage_index(
        &open_root(root).unwrap(),
        &path,
        &decision::Definition,
        &["240229-record".into()],
        |state| &state.name,
    );
    assert!(
        matches!(broken, Err(IndexStageError::Git(error)) if !matches!(error, GitError::NotRepository))
    );
}
#[test]
fn stage_cli_does_not_treat_missing_git_executable_as_nonrepository() {
    let dir = tempfile::tempdir().unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args(["stage", "240229-record", "--scope", "index", "--root"])
        .arg(dir.path())
        .args(["--decisions-dir", "records", "--json"])
        .env("PATH", "")
        .current_dir(dir.path())
        .output()
        .unwrap();
    assert!(!output.status.success());
    let body: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(body["error"]["code"], "git-error");
}
