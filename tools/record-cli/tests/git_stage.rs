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
fn commit_fixture(root: &Path) {
    git(root, &["init", "-q"]);
    git(root, &["config", "user.name", "Fixture"]);
    git(root, &["config", "user.email", "fixture@example.invalid"]);
    git(root, &["add", "--all"]);
    git(root, &["commit", "-qm", "baseline"]);
}
fn raw_git_fixture(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/git-stage")
        .join(name)
}
fn raw_document(name: &str) -> PathBuf {
    raw_git_fixture("documents").join(name)
}
fn fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let raw = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/git-stage/baseline");
    for name in ["selected", "unselected"] {
        fs::copy(raw.join(name), root.join(name)).unwrap();
    }
    commit_fixture(root);
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
