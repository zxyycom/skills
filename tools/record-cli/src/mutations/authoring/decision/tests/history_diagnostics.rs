use super::*;
use crate::transaction::{TxStatus, preflight};
use std::path::Path;

fn git(root: &Path, args: &[&str]) {
    let result = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
}
fn publish_old(root: &crate::source::Root, collection: &Path) {
    std::fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let result = run_transaction(root, &mut operation("old"));
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
}
fn commit(root: &Path) {
    git(root, &["add", "."]);
    git(
        root,
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "baseline",
        ],
    );
}
fn missing_index_baseline(root: &Path, collection: &Path) {
    std::fs::copy(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/history-invalid/decisions/other.txt"),
        collection.join("other.md"),
    )
    .unwrap();
    git(root, &["init", "-q"]);
    git(root, &["config", "user.name", "Fixture"]);
    git(root, &["config", "user.email", "fixture@example.invalid"]);
    commit(root);
}

#[test]
fn unrecorded_relation_reports_target_reason_and_explicit_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    git(dir.path(), &["init", "-q"]);
    let root = crate::source::open_root(dir.path()).unwrap();
    publish_old(&root, &collection);
    std::fs::write(
        collection.join("new.md"),
        candidate(
            "261106-new",
            "\n  - type: 修订\n    target: 261105-old\n    summary: Reason",
        ),
    )
    .unwrap();
    let before = std::fs::read(collection.join("decision-index.json")).unwrap();
    let old_before = std::fs::read(collection.join("old.md")).unwrap();
    let candidate_before = std::fs::read(collection.join("new.md")).unwrap();
    let error = preflight(&root, &mut operation("new")).err().unwrap();
    assert_eq!(error.code, "evolution");
    assert_eq!(error.diagnostics.len(), 1);
    let diagnostic = &error.diagnostics[0];
    assert_eq!(
        diagnostic.target.as_deref(),
        Some("Decision history for 261105-old")
    );
    assert_eq!(diagnostic.path.as_deref(), Some("decisions/old.md"));
    assert!(diagnostic.reason.as_deref().unwrap().contains("修订"));
    assert!(
        diagnostic
            .recovery
            .as_deref()
            .unwrap()
            .contains("--keep-unrecorded-history")
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    assert!(!collection.join("archive").exists());
    assert_eq!(
        std::fs::read(collection.join("old.md")).unwrap(),
        old_before
    );
    assert_eq!(
        std::fs::read(collection.join("new.md")).unwrap(),
        candidate_before
    );
    let mut confirmed = operation("new");
    confirmed.keep_unrecorded_history = true;
    let outcome = run_transaction(&root, &mut confirmed);
    assert!(
        outcome.committed && outcome.errors.is_empty(),
        "{:?}",
        outcome.errors
    );
    assert!(!collection.join("old.md").exists());
    assert!(collection.join("archive/old.md").exists());
    let index: serde_json::Value =
        serde_json::from_slice(&std::fs::read(collection.join("decision-index.json")).unwrap())
            .unwrap();
    assert_eq!(index["entries"]["261105-old"]["status"], "archived");
    assert_eq!(
        index["entries"]["261106-new"]["relations"][0]["target"],
        "261105-old"
    );
}

#[test]
fn recorded_discard_requires_specific_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    git(dir.path(), &["init", "-q"]);
    let root = crate::source::open_root(dir.path()).unwrap();
    publish_old(&root, &collection);
    commit(dir.path());
    std::fs::write(collection.join("new.md"), candidate("261106-new", "[]")).unwrap();
    let mut op = operation("new");
    op.publish_only = false;
    op.discard = Some("261105-old".into());
    let before = std::fs::read(collection.join("old.md")).unwrap();
    let error = preflight(&root, &mut op).err().unwrap();
    assert_eq!(error.code, "history-confirmation");
    let diagnostic = &error.diagnostics[0];
    assert_eq!(
        diagnostic.target.as_deref(),
        Some("Decision history for 261105-old")
    );
    assert!(
        diagnostic
            .recovery
            .as_deref()
            .unwrap()
            .contains("--delete-recorded")
    );
    assert_eq!(std::fs::read(collection.join("old.md")).unwrap(), before);
}

#[test]
fn unreadable_historical_baseline_is_not_a_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    missing_index_baseline(dir.path(), &collection);
    std::fs::remove_file(collection.join("other.md")).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    publish_old(&root, &collection);
    std::fs::write(
        collection.join("new.md"),
        candidate(
            "261106-new",
            "\n  - type: 修订\n    target: 261105-old\n    summary: Reason",
        ),
    )
    .unwrap();
    let error = preflight(&root, &mut operation("new")).err().unwrap();
    assert_eq!(error.code, "history");
    let diagnostic = &error.diagnostics[0];
    assert_eq!(
        diagnostic.target.as_deref(),
        Some("Decision history baseline")
    );
    assert!(
        diagnostic
            .recovery
            .as_deref()
            .unwrap()
            .contains("trusted historical index")
    );
    assert!(
        !diagnostic
            .recovery
            .as_deref()
            .unwrap()
            .contains("--keep-unrecorded-history")
    );
    assert!(!collection.join("archive").exists());
}

#[test]
fn unready_candidate_identifies_selected_source_and_correction() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let original = candidate("261106-new", "[]").replace("Purpose.", "");
    std::fs::write(collection.join("new.md"), &original).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let error = preflight(&root, &mut operation("new")).err().unwrap();
    assert_eq!(error.code, "candidate-unready");
    let diagnostic = &error.diagnostics[0];
    assert_eq!(
        diagnostic.target.as_deref(),
        Some("Decision candidate 261106-new")
    );
    assert_eq!(diagnostic.path.as_deref(), Some("decisions/new.md"));
    assert!(
        diagnostic
            .reason
            .as_deref()
            .unwrap()
            .contains("empty section: 目的")
    );
    assert!(diagnostic.reason.as_deref().unwrap().contains("not ready"));
    assert!(diagnostic.recovery.is_some());
    assert_eq!(
        std::fs::read_to_string(collection.join("new.md")).unwrap(),
        original
    );
    assert!(!collection.join("decision-index.json").exists());
}
