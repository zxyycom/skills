use super::*;

#[test]
fn first_publish_preflight_and_unselected_invalid_body() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("decisions")).unwrap();
    let c = dir.path().join("decisions");
    let original = candidate("261106-one", "[]").replace(
        "title: Example title",
        "title: Example title # retained header comment",
    );
    std::fs::write(c.join("one.md"), &original).unwrap();
    let mut other = candidate("261106-other", "[]").into_bytes();
    other.extend_from_slice(&[0xff]);
    std::fs::write(c.join("other.md"), &other).unwrap();
    let root = open_root(dir.path()).unwrap();
    let mut op = operation("261106-one.md");
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.established, vec!["261106-one"]);
    assert_eq!(
        std::fs::read(c.join("one.md")).unwrap(),
        original.as_bytes()
    );
    assert!(!c.join("decision-index.json").exists());
    op.successors[0].selector = "261106-one.MD".into();
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert_eq!(std::fs::read(c.join("other.md")).unwrap(), other);
    let text = std::fs::read_to_string(c.join("one.md")).unwrap();
    assert!(text.contains("status: active"));
    assert!(text.contains("- 采用：Decision."));
    assert!(text.contains("title: Example title # retained header comment"));
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert_eq!(
        parsed.index().source_revision.entries["261106-one"],
        record_cli::source_revision::fingerprint(
            record_cli::source_revision::Domain::Decision,
            "261106-one",
            "one.md",
            &text
        )
    );
}
#[test]
fn publish_successor_archives_predecessor_in_new_directory() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    let mut old = operation("old");
    assert_eq!(run_transaction(&root, &mut old).status, TxStatus::Ok);
    let next = candidate(
        "261106-next",
        "\n  - type: 修订\n    target: 261105-old\n    summary: A reason",
    );
    std::fs::write(c.join("next.md"), next).unwrap();
    let mut op = operation("next");
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.archived, vec!["261105-old"]);
    assert!(!c.join("archive").exists());
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(!c.join("old.md").exists());
    assert!(c.join("archive/old.md").exists());
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert_eq!(parsed.index().entries["261105-old"].status, "archived");
    assert_eq!(
        parsed.index().entries["261106-next"].relations[0].target,
        "261105-old"
    );
}
#[test]
fn split_requires_complete_successor_graph_and_fails_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    let relations = "\n  - type: 拆分\n    target: 261105-old\n    summary: A reason";
    std::fs::write(c.join("first.md"), candidate("261106-first", relations)).unwrap();
    std::fs::write(c.join("second.md"), candidate("261106-second", relations)).unwrap();
    let before = std::fs::read(c.join("decision-index.json")).unwrap();
    let mut op = operation("first");
    assert!(preflight(&root, &mut op).is_err());
    assert_eq!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        before
    );
    assert!(c.join("old.md").exists());
    op.publish_only = false;
    op.successors.push(Successor {
        selector: "second".into(),
        alignment: Alignment::Aligned,
    });
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.review.len(), 2);
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    assert!(c.join("archive/old.md").exists());
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert_eq!(parsed.index().entries["261105-old"].status, "archived");
    for (id, alignment) in [("261106-first", "unaligned"), ("261106-second", "aligned")] {
        let state = &parsed.index().entries[id];
        assert_eq!(state.status, "active");
        assert_eq!(state.alignment, alignment);
        assert_eq!(state.relations.len(), 1);
        assert_eq!(state.relations[0].relation_type, "拆分");
        assert_eq!(state.relations[0].target, "261105-old");
        assert!(
            preview
                .value
                .review
                .iter()
                .any(|review| review.source_id == id)
        );
    }
}
#[test]
fn unchanged_evolution_still_uses_preflight_and_no_commit() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("one.md"), candidate("261106-one", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    let mut op = operation("one");
    assert_eq!(run_transaction(&root, &mut op).status, TxStatus::Ok);
    let before = std::fs::read(c.join("decision-index.json")).unwrap();
    op.publish_only = false;
    let preview = preflight(&root, &mut op).unwrap();
    assert!(preview.writes.is_empty());
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!result.changed);
    assert!(!result.committed);
    assert_eq!(
        std::fs::read(c.join("decision-index.json")).unwrap(),
        before
    );
}
#[test]
fn grouped_relations_bind_to_successors_and_discard_candidate() {
    use record_cli::mutations::contract::{DecisionRelationKind, Relation, RelationGroup};
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let root = open_root(dir.path()).unwrap();
    for (name, id) in [("old-one", "261105-old-one"), ("old-two", "261105-old-two")] {
        std::fs::write(c.join(format!("{name}.md")), candidate(id, "[]")).unwrap();
        assert_eq!(
            run_transaction(&root, &mut operation(name)).status,
            TxStatus::Ok
        );
    }
    for (name, id) in [
        ("first", "261106-first"),
        ("second", "261106-second"),
        ("discarded", "261106-discarded"),
    ] {
        std::fs::write(c.join(format!("{name}.md")), candidate(id, "[]")).unwrap();
    }
    let mut op = operation("first.md");
    op.publish_only = false;
    op.successors.push(Successor {
        selector: "261106-second.MD".into(),
        alignment: Alignment::Aligned,
    });
    op.discard = Some("discarded.MD".into());
    op.relations = DecisionRelationOverride::Groups(vec![
        RelationGroup {
            source: "first.MD".into(),
            relations: vec![Relation {
                summary_selector: Some("261105-old-one".into()),
                kind: DecisionRelationKind::Split,
                target: "old-one.md".into(),
                summary: Some("  first=second  ".into()),
            }],
        },
        RelationGroup {
            source: "261106-second.md".into(),
            relations: vec![Relation {
                summary_selector: None,
                kind: DecisionRelationKind::Split,
                target: "261105-old-one.MD".into(),
                summary: Some("second reason".into()),
            }],
        },
    ]);
    let preview = preflight(&root, &mut op).unwrap();
    assert_eq!(preview.value.review.len(), 2);
    assert!(c.join("discarded.md").exists());
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(!c.join("discarded.md").exists());
    let index = std::fs::read(c.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    let first = &parsed.index().entries["261106-first"].relations[0];
    let second = &parsed.index().entries["261106-second"].relations[0];
    assert_eq!(
        (&*first.target, first.summary.as_deref()),
        ("261105-old-one", Some("first=second"))
    );
    assert_eq!(
        (&*second.target, second.summary.as_deref()),
        ("261105-old-one", Some("second reason"))
    );
    let snapshot = record_cli::index::QuerySnapshot::new(parsed);
    let trace = record_cli::queries::decision::project_trace(
        &snapshot,
        &record_cli::queries::options::TraceOptions {
            selector: "first".into(),
            direction: record_cli::queries::trace::RequestedDirection::Predecessors,
            depth: Some(1),
            max_records: 5,
        },
    )
    .unwrap();
    let trace = serde_json::to_value(trace).unwrap();
    assert_eq!(
        trace["entries"]["261106-first"]["relations"][0]["summary"],
        "first=second"
    );
}

#[cfg(unix)]
#[test]
fn cli_publish_write_failure_preserves_existing_source() {
    use std::os::unix::process::CommandExt;
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let original = candidate("261106-one", "[]");
    let source = c.join("one.md");
    std::fs::write(&source, &original).unwrap();
    let mut command = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"));
    command
        .args([
            "publish",
            "261106-one",
            "--alignment",
            "unaligned",
            "--root",
        ])
        .arg(dir.path())
        .args(["--decisions-dir", "decisions", "--json"]);
    // Fail the first file write while leaving JSON output usable.
    unsafe {
        command.pre_exec(|| {
            libc::signal(libc::SIGXFSZ, libc::SIG_IGN);
            let limit = libc::rlimit {
                rlim_cur: 0,
                rlim_max: 0,
            };
            if libc::setrlimit(libc::RLIMIT_FSIZE, &limit) != 0 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }
    let output = command.output().unwrap();
    assert_eq!(
        output.status.code(),
        Some(1),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let json: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(json["ok"], false);
    assert!(json["error"]["code"].is_string());
    assert_eq!(json["result"]["committed"], false);
    assert!(!json["diagnostics"].as_array().unwrap().is_empty());
    assert_eq!(std::fs::read_to_string(source).unwrap(), original);
    assert!(!c.join("decision-index.json").exists());
}

#[test]
fn evolution_discards_established_only_when_final_successor_graph_is_valid() {
    use record_cli::mutations::contract::DecisionRelationOverride;
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    std::fs::write(collection.join("old.md"), candidate("261105-old", "[]")).unwrap();
    let root = open_root(dir.path()).unwrap();
    assert_eq!(
        run_transaction(&root, &mut operation("old")).status,
        TxStatus::Ok
    );
    std::fs::write(
        collection.join("next.md"),
        candidate("261106-next", "\n  - type: 修订\n    target: 261105-old"),
    )
    .unwrap();
    let before_index = std::fs::read(collection.join("decision-index.json")).unwrap();
    let before_old = std::fs::read(collection.join("old.md")).unwrap();
    let before_next = std::fs::read(collection.join("next.md")).unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.discard = Some("old".into());
    assert!(preflight(&root, &mut op).is_err());
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        before_index
    );
    assert_eq!(
        std::fs::read(collection.join("old.md")).unwrap(),
        before_old
    );
    assert_eq!(
        std::fs::read(collection.join("next.md")).unwrap(),
        before_next
    );
    op.relations = DecisionRelationOverride::All(vec![]);
    let result = run_transaction(&root, &mut op);
    assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
    assert!(result.committed);
    let index = std::fs::read(collection.join("decision-index.json")).unwrap();
    let parsed =
        record_cli::index::parse_index(&index, &record_cli::domains::decision::Definition).unwrap();
    assert!(!parsed.index().entries.contains_key("261105-old"));
    assert!(parsed.index().entries["261106-next"].relations.is_empty());
    assert!(!collection.join("old.md").exists());
    assert!(
        std::fs::read_to_string(collection.join("next.md"))
            .unwrap()
            .contains("status: active")
    );
}

#[test]
fn evolution_rejects_discard_of_its_own_successor_without_writes() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let path = collection.join("next.md");
    std::fs::write(&path, candidate("261106-next", "[]")).unwrap();
    let before = std::fs::read(&path).unwrap();
    let root = open_root(dir.path()).unwrap();
    let mut op = operation("next");
    op.publish_only = false;
    op.discard = Some("261106-next".into());
    let error = match preflight(&root, &mut op) {
        Err(error) => error,
        Ok(_) => panic!("discarded successor accepted"),
    };
    assert_eq!(error.code, "discard");
    assert_eq!(std::fs::read(path).unwrap(), before);
    assert!(!collection.join("decision-index.json").exists());
}
