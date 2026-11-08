use super::stage_decision_fixture::dr_index_for;
use super::*;

#[test]
fn decision_domain_rejects_unlocated_pending_then_uses_restored_pending_index() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    let empty = dr_index_for(&[]);
    fs::write(root.join("decision-index.json"), &empty).unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    git(root, &["commit", "-qm", "empty baseline"]);
    let doc = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("unusual.md"), doc).unwrap();
    git(root, &["add", "--", "unusual.md"]);
    fs::remove_file(root.join("unusual.md")).unwrap();
    let prior = git(root, &["ls-files", "--stage", "-z"]);
    let stage = || {
        stage_decisions(
            &open_root(root).unwrap(),
            &RelativePath::new("decision-index.json").unwrap(),
            &["240229-record".into()],
            StageScope::Domain,
        )
    };
    assert!(stage().is_err());
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), prior);
    let locator = dr_index_for(&[("240229-record", "unusual.md", doc)]);
    fs::write(root.join("decision-index.json"), &locator).unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    fs::write(root.join("decision-index.json"), &empty).unwrap();
    stage().unwrap();
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "unusual.md"]).is_empty());
    assert_eq!(git(root, &["show", ":decision-index.json"]), locator);
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}

#[test]
fn decision_domain_uses_pending_locator_and_rejects_wrong_old_identity() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    let doc = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("head-old.md"), doc).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[("240229-record", "head-old.md", doc)]),
    )
    .unwrap();
    git(root, &["add", "--", "head-old.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "head location"]);
    git(root, &["rm", "--cached", "-q", "--", "head-old.md"]);
    fs::write(
        root.join("staged-old.md"),
        doc.replace("240229-record", "240229-wrong"),
    )
    .unwrap();
    git(root, &["add", "--", "staged-old.md"]);
    let pending_index = dr_index_for(&[("240229-record", "staged-old.md", doc)]);
    fs::write(root.join("decision-index.json"), &pending_index).unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    fs::remove_file(root.join("head-old.md")).unwrap();
    fs::remove_file(root.join("staged-old.md")).unwrap();
    fs::write(root.join("current.md"), doc).unwrap();
    let workspace_index = dr_index_for(&[("240229-record", "current.md", doc)]);
    fs::write(root.join("decision-index.json"), &workspace_index).unwrap();
    let stage = || {
        stage_decisions(
            &open_root(root).unwrap(),
            &RelativePath::new("decision-index.json").unwrap(),
            &["240229-record".into()],
            StageScope::Domain,
        )
    };
    let before = git(root, &["ls-files", "--stage", "-z"]);
    assert!(stage().is_err());
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
    fs::write(root.join("staged-old.md"), doc).unwrap();
    git(root, &["add", "--", "staged-old.md"]);
    fs::remove_file(root.join("staged-old.md")).unwrap();
    stage().unwrap();
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "staged-old.md"]).is_empty());
    assert_eq!(git(root, &["show", ":current.md"]), doc.as_bytes());
    assert_eq!(git(root, &["show", ":decision-index.json"]), pending_index);
    assert_eq!(
        fs::read(root.join("decision-index.json")).unwrap(),
        workspace_index
    );
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}

#[test]
fn decision_domain_stages_selected_deletion_without_rewriting_pending_index() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    let dir = fixture();
    let root = dir.path();
    let doc = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("record.md"), doc).unwrap();
    let original = dr_index_for(&[("240229-record", "record.md", doc)]);
    fs::write(root.join("decision-index.json"), &original).unwrap();
    git(root, &["add", "--", "record.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "baseline"]);
    fs::remove_file(root.join("record.md")).unwrap();
    fs::write(root.join("decision-index.json"), dr_index_for(&[])).unwrap();
    stage_decisions(
        &open_root(root).unwrap(),
        &RelativePath::new("decision-index.json").unwrap(),
        &["240229-record".into()],
        StageScope::Domain,
    )
    .unwrap();
    assert!(git(root, &["ls-files", "--stage", "-z", "--", "record.md"]).is_empty());
    assert_eq!(git(root, &["show", ":decision-index.json"]), original);
    assert_eq!(git(root, &["show", ":unselected"]), b"other pending\n");
}

#[cfg(unix)]
#[test]
fn decision_stage_rejects_missing_or_symlink_destination_without_pending_write() {
    use record_cli::{
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions},
    };
    use std::os::unix::fs::symlink;
    let dir = fixture();
    let root = dir.path();
    let external = tempfile::tempdir().unwrap();
    let doc = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("before.md"), doc).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[("240229-record", "before.md", doc)]),
    )
    .unwrap();
    git(root, &["add", "--", "before.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "baseline"]);
    fs::remove_file(root.join("before.md")).unwrap();
    fs::write(
        root.join("decision-index.json"),
        dr_index_for(&[("240229-record", "current.md", doc)]),
    )
    .unwrap();
    fs::write(external.path().join("target.md"), doc).unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    for scope in [StageScope::All, StageScope::Domain] {
        let stage = || {
            stage_decisions(
                &open_root(root).unwrap(),
                &RelativePath::new("decision-index.json").unwrap(),
                &["240229-record".into()],
                scope,
            )
        };
        assert!(stage().is_err());
        assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
        symlink(external.path().join("target.md"), root.join("current.md")).unwrap();
        assert!(stage().is_err());
        assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
        assert_eq!(
            fs::read_to_string(external.path().join("target.md")).unwrap(),
            doc
        );
        assert!(
            fs::symlink_metadata(root.join("current.md"))
                .unwrap()
                .file_type()
                .is_symlink()
        );
        fs::remove_file(root.join("current.md")).unwrap();
    }
}

#[test]
fn decision_stage_rejects_incompatible_pending_metadata_for_index_and_all() {
    use record_cli::{
        domains::decision::Definition,
        source::{RelativePath, open_root},
        stage::{StageScope, decision_scope::stage_decisions, index_scope::stage_index},
    };
    let dir = fixture();
    let root = dir.path();
    let doc = include_str!("../fixtures/git-stage/documents/decision.md");
    fs::write(root.join("record.md"), doc).unwrap();
    let baseline = dr_index_for(&[("240229-record", "record.md", doc)]);
    fs::write(root.join("decision-index.json"), &baseline).unwrap();
    git(root, &["add", "--", "record.md", "decision-index.json"]);
    git(root, &["commit", "-qm", "baseline"]);
    let mut pending: serde_json::Value = serde_json::from_slice(&baseline).unwrap();
    pending["sourceRevision"]["metadata"] =
        serde_json::Value::String(format!("sha256:{}", "b".repeat(64)));
    fs::write(
        root.join("decision-index.json"),
        serde_json::to_vec(&pending).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", "decision-index.json"]);
    fs::write(root.join("decision-index.json"), &baseline).unwrap();
    let before = git(root, &["ls-files", "--stage", "-z"]);
    let handle = open_root(root).unwrap();
    let path = RelativePath::new("decision-index.json").unwrap();
    assert!(
        stage_index(
            &handle,
            &path,
            &Definition,
            &["240229-record".into()],
            |s| &s.name
        )
        .is_err()
    );
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
    assert!(stage_decisions(&handle, &path, &["240229-record".into()], StageScope::All).is_err());
    assert_eq!(git(root, &["ls-files", "--stage", "-z"]), before);
}
