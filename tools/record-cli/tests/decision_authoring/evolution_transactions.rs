use super::*;
use std::fs;

#[test]
fn archived_successor_relation_replacement_preserves_lifecycle_and_body() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation};
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for name in ["old-a", "old-b"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261105-{name}"), "[]"),
        )
        .unwrap();
        assert_eq!(
            run_transaction(&root, &mut operation(name)).status,
            TxStatus::Ok
        );
    }
    fs::write(
        collection.join("mid.md"),
        candidate("261106-mid", "\n  - type: 修订\n    target: 261105-old-a"),
    )
    .unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("mid")).status,
        TxStatus::Ok
    );
    fs::write(
        collection.join("child.md"),
        candidate("261107-child", "\n  - type: 修订\n    target: 261106-mid"),
    )
    .unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("child")).status,
        TxStatus::Ok
    );
    let mid = collection.join("archive/mid.md");
    let before = fs::read_to_string(&mid).unwrap();
    let before_index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&before_index, &record_cli::domains::decision::Definition)
            .unwrap();
    let previous = parsed.index().entries["261106-mid"].clone();
    let mut op = operation("mid");
    op.publish_only = false;
    op.relations = DecisionRelationOverride::All(vec![Relation {
        summary_selector: None,
        kind: DecisionRelationKind::Replacement,
        target: "261105-old-b".into(),
        summary: Some("new reason".into()),
    }]);
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    let after = fs::read_to_string(&mid).unwrap();
    assert_eq!(
        before.split_once("\n---\n\n").unwrap().1,
        after.split_once("\n---\n\n").unwrap().1
    );
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    let mid = &parsed.index().entries["261106-mid"];
    assert_eq!(mid.status, "archived");
    assert_eq!(mid.alignment, previous.alignment);
    assert_eq!(mid.created_at, previous.created_at);
    assert_eq!(mid.relations.len(), 1);
    assert_eq!(mid.relations[0].target, "261105-old-b");
    assert_eq!(mid.relations[0].summary.as_deref(), Some("new reason"));
    assert_eq!(parsed.index().entries["261105-old-b"].status, "archived");
}

#[cfg(unix)]
#[test]
fn reactivate_rejects_archive_parent_symlink_without_external_write() {
    use std::os::unix::fs::symlink;
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    fs::write(
        collection.join("next.md"),
        candidate("261106-next", "\n  - type: 修订\n    target: 261105-old"),
    )
    .unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("next")).status,
        TxStatus::Ok
    );
    let outside = tempfile::tempdir().unwrap();
    let saved = outside.path().join("saved");
    fs::rename(collection.join("archive"), &saved).unwrap();
    symlink(&saved, collection.join("archive")).unwrap();
    let old = saved.join("old.md");
    let before = fs::read(&old).unwrap();
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args([
            "reactivate",
            "old",
            "--alignment",
            "unaligned",
            "--root",
            dir.path().to_str().unwrap(),
            "--decisions-dir",
            "decisions",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let body: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(body["error"]["code"], "source-read");
    assert!(
        body["error"]["message"]
            .as_str()
            .unwrap()
            .contains("outside of the filesystem")
    );
    assert_eq!(fs::read(&old).unwrap(), before);
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        index
    );
    assert!(
        fs::symlink_metadata(collection.join("archive"))
            .unwrap()
            .file_type()
            .is_symlink()
    );
}

#[test]
fn evolve_discards_unrelated_record_and_replaces_candidate_relations() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation};
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for name in ["old-a", "old-b", "discard"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261105-{name}"), "[]"),
        )
        .unwrap();
        assert_eq!(
            run_transaction(&root, &mut operation(name)).status,
            TxStatus::Ok
        );
    }
    fs::write(
        collection.join("bridge.md"),
        candidate(
            "261106-bridge",
            "\n  - type: 修订\n    target: 261105-old-a",
        ),
    )
    .unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("bridge")).status,
        TxStatus::Ok
    );
    let archived_before = fs::read(collection.join("archive/old-a.md")).unwrap();
    let orphan = collection.join("orphan.md");
    fs::write(
        &orphan,
        candidate(
            "261106-orphan",
            "\n  - type: 修订\n    target: 261105-discard",
        ),
    )
    .unwrap();
    let orphan_before = fs::read(&orphan).unwrap();
    fs::write(
        collection.join("next.md"),
        candidate(
            "261106-next",
            "\n  - type: 修订\n    target: 261105-discard",
        ),
    )
    .unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.discard = Some("discard".into());
    op.relations = DecisionRelationOverride::All(vec![
        Relation {
            summary_selector: None,
            kind: DecisionRelationKind::Revision,
            target: "261105-old-a".into(),
            summary: None,
        },
        Relation {
            summary_selector: None,
            kind: DecisionRelationKind::Replacement,
            target: "261105-old-b".into(),
            summary: Some("reason".into()),
        },
    ]);
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!collection.join("discard.md").exists());
    assert_eq!(
        fs::read(collection.join("archive/old-a.md")).unwrap(),
        archived_before
    );
    assert!(collection.join("archive/old-b.md").exists());
    assert_eq!(fs::read(&orphan).unwrap(), orphan_before);
    let index = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    let state = &parsed.index().entries["261106-next"];
    assert_eq!(state.status, "active");
    assert_eq!(
        state
            .relations
            .iter()
            .map(|edge| edge.target.as_str())
            .collect::<Vec<_>>(),
        vec!["261105-old-a", "261105-old-b"]
    );
    assert!(!parsed.index().entries.contains_key("261105-discard"));
    assert!(preflight(&root, &mut operation("orphan")).is_err());
    assert_eq!(fs::read(&orphan).unwrap(), orphan_before);
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        index
    );
}

#[test]
fn cli_set_relations_batches_sources_and_rejects_unknown_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    fs::create_dir(&collection).unwrap();
    let root = open_root(dir.path()).unwrap();
    for name in ["old", "first", "second"] {
        fs::write(
            collection.join(format!("{name}.md")),
            candidate(&format!("261105-{name}"), "[]"),
        )
        .unwrap();
        assert_eq!(
            run_transaction(&root, &mut operation(name)).status,
            TxStatus::Ok
        );
    }
    fs::write(
        collection.join("bridge.md"),
        candidate("261106-bridge", "\n  - type: 修订\n    target: 261105-old"),
    )
    .unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("bridge")).status,
        TxStatus::Ok
    );
    let run = |args: &[&str]| {
        std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .arg("set-relations")
            .args(args)
            .args([
                "--root",
                dir.path().to_str().unwrap(),
                "--decisions-dir",
                "decisions",
                "--json",
            ])
            .output()
            .unwrap()
    };
    let before = fs::read(collection.join("decision-index.json")).unwrap();
    let first = fs::read(collection.join("first.md")).unwrap();
    let second = fs::read(collection.join("second.md")).unwrap();
    let rejected = run(&[
        "--source",
        "first",
        "--relation",
        "修订=261105-old",
        "--source",
        "missing",
        "--relation",
        "修订=261105-old",
    ]);
    assert!(!rejected.status.success());
    assert_eq!(
        fs::read(collection.join("decision-index.json")).unwrap(),
        before
    );
    assert_eq!(fs::read(collection.join("first.md")).unwrap(), first);
    assert_eq!(fs::read(collection.join("second.md")).unwrap(), second);
    let committed = run(&[
        "--source",
        "first",
        "--relation",
        "修订=261105-old",
        "--source",
        "second",
        "--relation",
        "修订=261105-old",
    ]);
    assert!(
        committed.status.success(),
        "{}",
        String::from_utf8_lossy(&committed.stdout)
    );
    let bytes = fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&bytes, &record_cli::domains::decision::Definition).unwrap();
    for name in ["first", "second"] {
        let entry = &parsed.index().entries[&format!("261105-{name}")];
        assert_eq!(entry.relations.len(), 1);
        assert_eq!(entry.relations[0].target, "261105-old");
    }
}
