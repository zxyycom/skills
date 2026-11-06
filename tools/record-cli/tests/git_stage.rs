use record_cli::git::{head, read_pending, read_revision_file, read_selected};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}
fn fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git(root, &["init", "-q"]);
    git(root, &["config", "user.name", "Fixture"]);
    git(root, &["config", "user.email", "fixture@example.invalid"]);
    fs::write(root.join("selected"), b"head\n").unwrap();
    fs::write(root.join("unselected"), b"head unrelated\n").unwrap();
    git(root, &["add", "--", "selected", "unselected"]);
    git(root, &["commit", "-qm", "baseline"]);
    fs::write(root.join("selected"), b"pending\n").unwrap();
    fs::write(root.join("unselected"), b"other pending\n").unwrap();
    git(root, &["add", "--", "selected", "unselected"]);
    fs::write(root.join("selected"), b"worktree\n").unwrap();
    dir
}

#[path = "git_stage/publish_git.rs"]
mod publish_git;
#[path = "git_stage/read_git.rs"]
mod read_git;
#[path = "git_stage/stage_decision.rs"]
mod stage_decision;
#[path = "git_stage/stage_history.rs"]
mod stage_history;
#[path = "git_stage/stage_index.rs"]
mod stage_index;
#[path = "git_stage/stage_investigation_resources.rs"]
mod stage_investigation_resources;
#[path = "git_stage/stage_investigation_sources.rs"]
mod stage_investigation_sources;
