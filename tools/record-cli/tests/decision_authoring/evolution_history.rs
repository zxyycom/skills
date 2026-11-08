use super::*;
use std::fs;

fn git(root: &std::path::Path, args: &[&str]) {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn grouped_final_relation_requires_git_history_confirmation() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation, RelationGroup};
    let dir = tempfile::tempdir().unwrap();
    assert!(
        std::process::Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(["init", "-q"])
            .status()
            .unwrap()
            .success()
    );
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    let path = collection.join("next.md");
    let original = candidate("261106-next", "[]");
    fs::write(&path, &original).unwrap();
    let before = fs::read(collection.join("decision-index.json")).unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.relations = DecisionRelationOverride::Groups(vec![RelationGroup {
        source: "next".into(),
        relations: vec![Relation {
            summary_selector: None,
            kind: DecisionRelationKind::Revision,
            target: "261105-old".into(),
            summary: None,
        }],
    }]);
    let error = preflight(&root, &mut op)
        .err()
        .expect("unrecorded group target must require confirmation");
    assert!(
        format!("{error:?}").contains("HistoryConfirmationRequired"),
        "{error:?}"
    );
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    assert_eq!(fs::read(&path).unwrap(), original.as_bytes());
    op.keep_unrecorded_history = true;
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(collection.join("archive/old.md").exists());
}

#[test]
fn confirmed_recorded_discard_and_empty_successor_commit_together() {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-q"]);
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    git(dir.path(), &["add", "decisions"]);
    git(
        dir.path(),
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
    fs::write(collection.join("next.md"), candidate("261106-next", "[]")).unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.discard = Some("old".into());
    op.delete_recorded = true;
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(!collection.join("old.md").exists());
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert!(!parsed.index().entries.contains_key("261105-old"));
    assert!(parsed.index().entries["261106-next"].relations.is_empty());
    assert_eq!(parsed.index().entries["261106-next"].status, "active");
}

#[test]
fn recorded_discard_confirmation_does_not_confirm_unrecorded_relation_history() {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-q"]);
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    fs::write(
        collection.join("discard.md"),
        candidate("261105-discard", "[]"),
    )
    .unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("discard")).status,
        TxStatus::Ok
    );
    git(dir.path(), &["add", "decisions"]);
    git(
        dir.path(),
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
    fs::write(collection.join("prior.md"), candidate("261105-prior", "[]")).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("prior")).status,
        TxStatus::Ok
    );
    fs::write(
        collection.join("next.md"),
        candidate("261106-next", "\n  - type: 修订\n    target: 261105-prior"),
    )
    .unwrap();
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.discard = Some("discard".into());
    op.delete_recorded = true;
    let error = preflight(&root, &mut op)
        .err()
        .expect("unrecorded predecessor requires separate confirmation");
    assert!(
        format!("{error:?}").contains("HistoryConfirmationRequired"),
        "{error:?}"
    );
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        index
    );
    assert!(collection.join("discard.md").exists());
    assert!(collection.join("prior.md").exists());
    op.keep_unrecorded_history = true;
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!collection.join("discard.md").exists());
    assert!(collection.join("archive/prior.md").exists());
}
