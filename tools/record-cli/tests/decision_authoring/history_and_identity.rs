use super::*;

#[test]
fn unrecorded_git_predecessor_requires_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    assert!(
        std::process::Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(["init", "-q"])
            .status()
            .unwrap()
            .success()
    );
    std::fs::write(c.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    std::fs::write(
        c.join("new.md"),
        candidate(
            "261106-new",
            "\n  - type: 修订\n    target: 261105-old\n    summary: Reason",
        ),
    )
    .unwrap();
    let mut op = operation("new");
    let before = std::fs::read(c.join("decision-index.json")).unwrap();
    let err = preflight(&root, &mut op).err().unwrap();
    assert!(err.message.contains("HistoryConfirmationRequired"));
    assert_eq!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        before
    );
    assert!(!c.join("archive").exists());
    op.keep_unrecorded_history = true;
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
}
#[test]
fn recorded_predecessor_is_identified_from_head_index() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let git = |args: &[&str]| {
        let result = std::process::Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(args)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
    };
    git(&["init", "-q"]);
    std::fs::write(c.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    git(&["add", "decisions"]);
    git(&[
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "baseline",
    ]);
    std::fs::write(
        c.join("new.md"),
        candidate(
            "261106-new",
            "\n  - type: 修订\n    target: 261105-old\n    summary: Reason",
        ),
    )
    .unwrap();
    let result = run_transaction(&root, &mut operation("new"));
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(c.join("archive/old.md").exists());
}
#[test]
fn legacy_name_ambiguity_rejects_every_selector_role_without_writes() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation, RelationGroup};
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    for (path, id) in [
        ("legacy.md", "foo"),
        ("dated.md", "260101-foo"),
        ("next.md", "261106-next"),
    ] {
        std::fs::write(c.join(path), candidate(id, "[]")).unwrap();
    }
    let root = open_root(dir.path()).unwrap();
    let snapshots: Vec<_> = ["legacy.md", "dated.md", "next.md"]
        .into_iter()
        .map(|name| (name, std::fs::read(c.join(name)).unwrap()))
        .collect();
    for role in ["publish", "successor", "discard", "group", "target"] {
        let mut op = operation(if role == "publish" || role == "successor" {
            "foo.MD"
        } else {
            "261106-next"
        });
        if role != "publish" {
            op.publish_only = false;
        }
        match role {
            "discard" => op.discard = Some("foo.md".into()),
            "group" => {
                op.relations = DecisionRelationOverride::Groups(vec![RelationGroup {
                    source: "foo.MD".into(),
                    relations: vec![],
                }])
            }
            "target" => {
                op.relations = DecisionRelationOverride::All(vec![Relation {
                    summary_selector: None,
                    kind: DecisionRelationKind::Revision,
                    target: "foo.md".into(),
                    summary: None,
                }])
            }
            _ => {}
        }
        let error = preflight(&root, &mut op).err().expect(role);
        assert_eq!(error.code, "selector", "{role}");
        assert!(
            error.message.contains("Ambiguous"),
            "{role}: {}",
            error.message
        );
        let result = run_transaction(&root, &mut op);
        assert_eq!(result.status, TxStatus::Error, "{role}");
        assert!(!result.committed && !result.changed, "{role}");
        for (name, before) in &snapshots {
            assert_eq!(
                &std::fs::read(c.join(name)).unwrap(),
                before,
                "{role} {name}"
            );
        }
        assert!(!c.join("decision-index.json").exists(), "{role}");
        assert!(!c.join("archive").exists(), "{role}");
    }
    let preview = preflight(&root, &mut operation("260101-foo.MD")).unwrap();
    assert_eq!(preview.value.established, ["260101-foo"]);
    for invalid in [
        "../260101-foo.md",
        "decisions/260101-foo.md",
        "260101-foo.md.md",
    ] {
        let mut op = operation(invalid);
        assert_eq!(preflight(&root, &mut op).err().unwrap().code, "selector");
        let result = run_transaction(&root, &mut op);
        assert_eq!(result.status, TxStatus::Error);
        assert!(!result.committed && !result.changed);
        for (name, before) in &snapshots {
            assert_eq!(&std::fs::read(c.join(name)).unwrap(), before);
        }
        assert!(!c.join("decision-index.json").exists());
    }
}
