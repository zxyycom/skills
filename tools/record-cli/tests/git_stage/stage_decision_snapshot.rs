use super::stage_decision_fixture::dr_index_for;
use super::*;

#[test]
fn decision_unborn_all_stages_only_selected_of_two_published_records() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git(root, &["init", "-q"]);
    let a = include_str!("../fixtures/git-stage/documents/decision.md").to_owned();
    let b = a.replace("240229-record", "240229-other");
    fs::write(root.join("record.md"), &a).unwrap();
    fs::write(root.join("other.md"), &b).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[
            ("240229-record", "record.md", &a),
            ("240229-other", "other.md", &b),
        ]),
    )
    .unwrap();
    let pending_before = git(root, &["ls-files", "--stage", "-z"]);
    assert!(
        stage_decisions(
            &open_root(root).unwrap(),
            &RelativePath::new("decision-index.json").unwrap(),
            &["missing".into()],
            StageScope::All
        )
        .is_err()
    );
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), pending_before);
    stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::All,
    )
    .unwrap();
    assert_eq!(git(root, &["show", ":record.md"]), a.as_bytes());
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "other.md"]).is_empty());
    let index: serde_json::Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert!(index["entries"].get("240229-record").is_some());
    assert!(index["entries"].get("240229-other").is_none());
}

#[test]
fn decision_all_stages_synced_source_path_move_and_rejects_bad_destination() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    let original = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("before.md"), original).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[("240229-record", "before.md", original)]),
    )
    .unwrap();
    git(root, &["add", "--", "before.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "decision baseline"]);
    let updated = original.replace("Old title", "Moved title");
    fs::remove_file(root.join("before.md")).unwrap();
    fs::write(root.join("semantic-current.md"), &updated).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[("240229-record", "semantic-current.md", &updated)]),
    )
    .unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    fs::write(root.join("spare.md"), &updated).unwrap();
    fs::write(
        root.join("semantic-current.md"),
        updated.replace("240229-record", "240229-wrong"),
    )
    .unwrap();
    assert!(
        stage_decisions(
            &open_root(root).unwrap(),
            &RelativePath::new("decision-index.json").unwrap(),
            &["240229-record".into()],
            StageScope::All
        )
        .is_err()
    );
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
    fs::remove_file(root.join("spare.md")).unwrap();
    fs::write(root.join("record.md"), b"invalid unselected content").unwrap();
    fs::write(root.join("semantic-current.md"), &updated).unwrap();
    stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::All,
    )
    .unwrap();
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "before.md"]).is_empty());
    assert_eq!(
        git(root, &["show", ":semantic-current.md"]),
        updated.as_bytes()
    );
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "record.md"]).is_empty());
    assert_eq!(
        fs::read(root.join("record.md")).unwrap(),
        b"invalid unselected content"
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
    let index: serde_json::Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert_eq!(
        index["entries"]["240229-record"]["sourcePath"],
        "semantic-current.md"
    );
}

#[test]
fn decision_stage_addition_and_separate_scopes_preserve_other_pending() {
    use record_cli::{
        domains::decision::Definition,
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions, index_scope::stage_index},
    };
    let dir = fixture();
    let root = dir.path();
    let a = include_str!("../fixtures/git-stage/documents/decision.md").to_owned();
    fs::write(root.join("record.md"), &a).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[("240229-record", "record.md", &a)]),
    )
    .unwrap();
    git(root, &["add", "--", "record.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "baseline"]);
    let baseline_record = git(root, &["show", ":record.md"]);
    let b = a
        .replace("240229-record", "240229-new")
        .replace("Old title", "New record");
    let edited = a.replace("Old title", "Edited record");
    fs::write(root.join("record.md"), &edited).unwrap();
    fs::write(root.join("new.md"), &b).unwrap();
    let workspace = dr_index_for(&[
        ("240229-record", "record.md", &edited),
        ("240229-new", "new.md", &b),
    ]);
    fs::write(root.join("decision-index.json"), &workspace).unwrap();
    let handle = open_root(root).unwrap();
    let index_path = RelativePath::new("decision-index.json").unwrap();
    stage_decisions(
        &handle,
        &index_path,
        &["240229-new".into()],
        StageScope::All,
    )
    .unwrap();
    assert_eq!(git(root, &["show", ":new.md"]), b.as_bytes());
    assert_eq!(git(root, &["show", ":record.md"]), baseline_record);
    stage_index(
        &handle,
        &index_path,
        &Definition,
        &["240229-record".into()],
        |s| &s.name,
    )
    .unwrap();
    let pending_index = git(root, &["show", ":decision-index.json"]);
    assert_eq!(git(root, &["show", ":record.md"]), baseline_record);
    stage_decisions(
        &handle,
        &index_path,
        &["240229-record".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert_eq!(git(root, &["show", ":record.md"]), edited.as_bytes());
    assert_eq!(git(root, &["show", ":new.md"]), b.as_bytes());
    assert_eq!(git(root, &["show", ":decision-index.json"]), pending_index);
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}

#[test]
fn decision_all_stages_combined_addition_update_and_deletion() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    let a = include_str!("../fixtures/git-stage/documents/decision.md").to_owned();
    let old = a
        .replace("240229-record", "240229-old")
        .replace("Old title", "Retired");
    fs::write(root.join("record.md"), &a).unwrap();
    fs::write(root.join("old.md"), &old).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[
            ("240229-record", "record.md", &a),
            ("240229-old", "old.md", &old),
        ]),
    )
    .unwrap();
    git(
        root,
        &["add", "--", "record.md", "old.md", "decision-index.json"],
    );
    git(root, &["commit", "-qm", "baseline"]);
    let changed = a.replace("Old title", "Updated title");
    let added = a
        .replace("240229-record", "240229-new")
        .replace("Old title", "New title");
    fs::write(root.join("record.md"), &changed).unwrap();
    fs::write(root.join("new.md"), &added).unwrap();
    fs::remove_file(root.join("old.md")).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[
            ("240229-record", "record.md", &changed),
            ("240229-new", "new.md", &added),
        ]),
    )
    .unwrap();
    stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &[
            "240229-record".into(),
            "240229-new".into(),
            "240229-old".into(),
        ],
        StageScope::All,
    )
    .unwrap();
    assert_eq!(git(root, &["show", ":record.md"]), changed.as_bytes());
    assert_eq!(git(root, &["show", ":new.md"]), added.as_bytes());
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "old.md"]).is_empty());
    let index: serde_json::Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert_eq!(index["entries"].as_object().unwrap().len(), 2);
    assert_eq!(index["entries"]["240229-record"]["title"], "Updated title");
    assert_eq!(index["entries"]["240229-new"]["title"], "New title");
    assert_eq!(index["entries"]["240229-new"]["status"], "active");
    assert_eq!(index["entries"]["240229-new"]["alignment"], "aligned");
    assert_eq!(
        index["entries"]["240229-new"]["relations"],
        serde_json::json!([])
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}

#[test]
fn decision_stage_related_projection_keeps_unselected_pending_body() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    fs::create_dir(root.join("archive")).unwrap();
    let template = include_str!("../fixtures/git-stage/documents/decision.md");
    let b = template
        .replace("240229-record", "240229-prior")
        .replace("status: active", "status: archived");
    let a = template.replace(
        "relations: []",
        "relations:\n  - type: 修订\n    target: 240229-prior\n    summary: Reason",
    );
    fs::write(root.join("record.md"), &a).unwrap();
    fs::write(root.join("archive/prior.md"), &b).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[
            ("240229-record", "record.md", &a),
            ("240229-prior", "archive/prior.md", &b),
        ]),
    )
    .unwrap();
    git(
        root,
        &[
            "add",
            "--",
            "record.md",
            "archive/prior.md",
            "decision-index.json",
        ],
    );
    git(root, &["commit", "-qm", "related baseline"]);
    // Make the selected worktree source byte-identical to its Git baseline.
    // Git may have normalized the fixture on add, depending on host settings.
    fs::write(root.join("record.md"), git(root, &["show", ":record.md"])).unwrap();
    let edited = b.replace("Old title", "Prior edited");
    fs::write(root.join("archive/prior.md"), &edited).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[
            ("240229-record", "record.md", &a),
            ("240229-prior", "archive/prior.md", &edited),
        ]),
    )
    .unwrap();
    let handle = open_root(root).unwrap();
    let path = RelativePath::new("decision-index.json").unwrap();
    stage_decisions(&handle, &path, &["240229-prior".into()], StageScope::Domain).unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    stage_decisions(&handle, &path, &["240229-record".into()], StageScope::All).unwrap();
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
    assert_eq!(git(root, &["show", ":archive/prior.md"]), edited.as_bytes());
    stage_decisions(
        &handle,
        &path,
        &["240229-record".into(), "240229-prior".into()],
        StageScope::All,
    )
    .unwrap();
    let index: serde_json::Value =
        serde_json::from_slice(&git(root, &["show", ":decision-index.json"])).unwrap();
    assert_eq!(index["entries"]["240229-prior"]["title"], "Prior edited");
}
