use record_cli::{
    mutations::identity::investigation::{Action, InvestigationIdentityOperation},
    source::{self, RelativePath},
    transaction::{self, RecoveryStatus},
};
use std::path::Path;
fn report(id: &str, resource: bool) -> String {
    format!(
        "---\ntitle: \"Example\"\nid: \"{id}\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"example\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n依据\n\n## 调查结果与边界\n结果\n{}",
        if resource {
            format!("\n## 随附资源\n- [evidence](./_resources/{id}/nested/file.txt)\n")
        } else {
            String::new()
        }
    )
}
fn op(action: Action) -> InvestigationIdentityOperation {
    InvestigationIdentityOperation {
        collection: RelativePath::new("investigations").unwrap(),
        index_path: RelativePath::new("investigations/investigation-index.json").unwrap(),
        selector: "261106-old".into(),
        action,
    }
}
fn run(
    root: &Path,
    op: &mut InvestigationIdentityOperation,
) -> transaction::TransactionOutcome<record_cli::mutations::identity::investigation::PreparedIdentity>
{
    let root = source::open_root(root).unwrap();
    transaction::run_transaction(&root, &RelativePath::new("identity.lock").unwrap(), op)
}
#[test]
fn candidate_first_collection_rename_discard_and_resource_modes() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old/nested")).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", true)).unwrap();
    std::fs::write(c.join("_resources/261106-old/nested/file.txt"), b"evidence").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(
            c.join("_resources/261106-old"),
            std::fs::Permissions::from_mode(0o750),
        )
        .unwrap();
    }
    let result = run(
        dir.path(),
        &mut op(Action::Rename {
            target: "new".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        }),
    );
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed);
    assert_eq!(result.value.as_ref().unwrap().impact.resource_references, 1);
    assert_eq!(
        std::fs::read(c.join("_resources/261106-new/nested/file.txt")).unwrap(),
        b"evidence"
    );
    assert!(!c.join("_resources/261106-old").exists());
    assert!(
        std::fs::read_to_string(c.join("_candidate.new"))
            .unwrap()
            .contains("_resources/261106-new/nested/file.txt")
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(c.join("_resources/261106-new"))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o750
        );
    }
    let mut discard = op(Action::Discard {
        confirm_recorded: false,
        delete_owned_resources: false,
    });
    discard.selector = "261106-new".into();
    let out = run(dir.path(), &mut discard);
    assert!(!out.committed);
    assert!(c.join("_candidate.new").exists());
    discard.action = Action::Discard {
        confirm_recorded: false,
        delete_owned_resources: true,
    };
    let out = run(dir.path(), &mut discard);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert_eq!(out.outcome, RecoveryStatus::Committed);
    assert_eq!(
        out.value.as_ref().unwrap().deleted_resource_ids,
        ["261106-new/nested/file.txt"]
    );
    assert!(!c.join("_candidate.new").exists());
    assert!(!c.join("_resources/261106-new").exists());
    assert!(!c.join("investigation-index.json").exists());
}
#[test]
fn candidate_noop_does_not_validate_incomplete_body_or_touch_unselected_candidate() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir(&c).unwrap();
    let text = "---\ntitle: \"A\"\nid: \"261106-old\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"example\"\nrelations: []\n---\n";
    std::fs::write(c.join("_candidate.old"), text).unwrap();
    std::fs::write(c.join("_candidate.other"), "garbage").unwrap();
    let out = run(
        dir.path(),
        &mut op(Action::Rename {
            target: "old".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        }),
    );
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(!out.changed);
    assert_eq!(
        std::fs::read_to_string(c.join("_candidate.old")).unwrap(),
        text
    );
}
fn publish_fixture(c: &Path, reports: &[(&str, &str, String)]) {
    use record_cli::{
        domains::investigation::{self, Definition},
        index::{self, IndexV4, Revision},
        source_revision::{self, Domain},
    };
    let mut entries = std::collections::BTreeMap::new();
    let mut revisions = std::collections::BTreeMap::new();
    for (id, path, text) in reports {
        std::fs::write(c.join(path), text).unwrap();
        entries.insert(
            (*id).to_owned(),
            investigation::parse_established(text.as_bytes(), id, path)
                .unwrap()
                .state,
        );
        revisions.insert(
            (*id).to_owned(),
            source_revision::fingerprint(Domain::Investigation, id, path, text),
        );
    }
    let index = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Investigation),
                entries: revisions,
            },
            entries,
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(
        c.join("investigation-index.json"),
        index::serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
}
#[test]
fn published_rename_updates_referrer_and_discard_rejects_references() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir(&c).unwrap();
    let old = report("261106-old", false);
    let successor = report("261106-next", false).replace(
        "relations: []",
        "relations:\n  - type: \"复查\"\n    target: \"261106-old\"\n    summary: \"Reason\"",
    );
    publish_fixture(
        &c,
        &[
            ("261106-old", "old.md", old),
            ("261106-next", "next.md", successor),
        ],
    );
    let result = run(
        dir.path(),
        &mut op(Action::Discard {
            confirm_recorded: false,
            delete_owned_resources: false,
        }),
    );
    assert!(!result.committed);
    assert_eq!(result.errors[0].target.as_deref(), Some("261106-old"));
    assert!(
        result.errors[0]
            .reason
            .as_deref()
            .unwrap()
            .contains("261106-next")
    );
    assert!(c.join("old.md").exists());
    let result = run(
        dir.path(),
        &mut op(Action::Rename {
            target: "new".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        }),
    );
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed);
    assert_eq!(
        result.value.as_ref().unwrap().impact.established_relations,
        1
    );
    assert_eq!(result.value.as_ref().unwrap().impact.candidate_relations, 0);
    assert!(
        std::fs::read_to_string(c.join("next.md"))
            .unwrap()
            .contains("target: \"261106-new\"")
    );
    assert!(c.join("new.md").exists());
    assert!(!c.join("old.md").exists());
}
#[test]
fn resource_freshness_detects_payload_drift_after_preparation() {
    use record_cli::transaction::TransactionOperation;
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old/nested")).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", true)).unwrap();
    std::fs::write(c.join("_resources/261106-old/nested/file.txt"), b"first").unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut operation = op(Action::Rename {
        target: "new".into(),
        confirm_recorded_report: false,
        confirm_recorded_candidate: false,
    });
    let plan = operation.prepare(&root).unwrap();
    std::fs::write(c.join("_resources/261106-old/nested/file.txt"), b"other").unwrap();
    assert!(operation.fresh(&root, &plan).is_err());
    assert!(c.join("_candidate.old").exists());
    assert!(!c.join("_candidate.new").exists());
}
#[test]
fn git_recorded_candidate_requires_explicit_confirmation() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", false)).unwrap();
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
    git(&["add", "investigations/_candidate.old"]);
    git(&[
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "fixture",
    ]);
    let discard = std::process::Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["discard", "261106-old", "--root"])
        .arg(dir.path())
        .args(["--investigations-dir", "investigations", "--json"])
        .output()
        .unwrap();
    assert!(!discard.status.success());
    let failure: serde_json::Value = serde_json::from_slice(&discard.stdout).unwrap();
    assert_eq!(
        failure["result"]["requiresRecordedDeletionConfirmation"],
        true
    );
    assert_eq!(failure["result"]["committed"], false);
    assert!(c.join("_candidate.old").exists());
    let mut operation = op(Action::Rename {
        target: "new".into(),
        confirm_recorded_report: false,
        confirm_recorded_candidate: false,
    });
    let out = run(dir.path(), &mut operation);
    assert!(!out.committed);
    assert_eq!(out.errors[0].target.as_deref(), Some("261106-old"));
    assert!(
        out.errors[0]
            .recovery
            .as_deref()
            .unwrap()
            .contains("--rename-recorded-candidate")
    );
    assert!(c.join("_candidate.old").exists());
    operation.action = Action::Rename {
        target: "new".into(),
        confirm_recorded_report: true,
        confirm_recorded_candidate: false,
    };
    let wrong_confirmation = run(dir.path(), &mut operation);
    assert!(!wrong_confirmation.committed);
    assert!(c.join("_candidate.old").exists());
    operation.action = Action::Rename {
        target: "new".into(),
        confirm_recorded_report: false,
        confirm_recorded_candidate: true,
    };
    let out = run(dir.path(), &mut operation);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
}
#[test]
fn legacy_candidate_same_path_identity_update_commits() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("_candidate.old"), report("old", false)).unwrap();
    let mut operation = op(Action::Rename {
        target: "261106-old".into(),
        confirm_recorded_report: false,
        confirm_recorded_candidate: false,
    });
    operation.selector = "old".into();
    let out = run(dir.path(), &mut operation);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(
        std::fs::read_to_string(c.join("_candidate.old"))
            .unwrap()
            .contains("id: \"261106-old\"")
    );
}
#[test]
fn malformed_head_index_never_becomes_empty_history() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir(&c).unwrap();
    std::fs::write(c.join("investigation-index.json"), "invalid").unwrap();
    let git = |args: &[&str]| {
        let out = std::process::Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(args)
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stderr)
        );
    };
    git(&["init", "-q"]);
    git(&["add", "investigations/investigation-index.json"]);
    git(&[
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "fixture",
    ]);
    std::fs::remove_file(c.join("investigation-index.json")).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", false)).unwrap();
    let out = run(
        dir.path(),
        &mut op(Action::Discard {
            confirm_recorded: true,
            delete_owned_resources: true,
        }),
    );
    assert!(!out.committed);
    assert!(out.errors.iter().any(|e| e.code == "history-index"));
    assert!(c.join("_candidate.old").exists());
}

#[path = "investigation_identity/cli_resources.rs"]
mod cli_resources;
