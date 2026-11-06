use super::*;

fn fixture_index(domain: &str) -> (&'static str, serde_json::Value) {
    let hash = format!("sha256:{}", "a".repeat(64));
    let (name, state) = if domain == "decisions" {
        (
            "decision-index.json",
            serde_json::json!({"name":"record","sourcePath":"record.md","title":"Title","status":"active","alignment":"aligned","createdAt":"2024-02-29T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":["test"],"relations":[]}),
        )
    } else {
        (
            "investigation-index.json",
            serde_json::json!({"name":"record","sourcePath":"record.md","title":"Title","formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["test"],"relations":[],"resourceIds":[]}),
        )
    };
    let index = serde_json::json!({"schemaVersion":4,"namespace":domain,"definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-record":hash}},"entries":{"240229-record":state}});
    (name, index)
}

fn historical_missing_fixture(
    domain: &str,
    candidate: bool,
) -> (tempfile::TempDir, &'static str, serde_json::Value) {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    git(root, &["init", "-q"]);
    git(root, &["config", "user.name", "Fixture"]);
    git(root, &["config", "user.email", "fixture@example.invalid"]);
    fs::create_dir(root.join("records")).unwrap();
    let historical_name = if domain == "decisions" && candidate {
        "draft.md"
    } else if domain == "decisions" {
        "archive/old.md"
    } else if candidate {
        "_candidate.240229-draft"
    } else {
        "old-report.md"
    };
    if historical_name.starts_with("archive/") {
        fs::create_dir(root.join("records/archive")).unwrap();
    }
    let historical = if candidate {
        b"---\nstatus: candidate\n---\n".as_slice()
    } else {
        b"---\nstatus: active\n---\n".as_slice()
    };
    fs::write(root.join("records").join(historical_name), historical).unwrap();
    git(root, &["add", "--", "records"]);
    git(root, &["commit", "-qm", "historical namespace"]);
    if !candidate {
        let spec = format!("HEAD:records/{historical_name}");
        let oid = String::from_utf8(git(root, &["rev-parse", &spec])).unwrap();
        let oid = oid.trim();
        fs::remove_file(root.join(".git/objects").join(&oid[..2]).join(&oid[2..])).unwrap();
    }
    let (index_name, index) = fixture_index(domain);
    fs::write(
        root.join("records").join(index_name),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    git(root, &["add", "--", &format!("records/{index_name}")]);
    (dir, index_name, index)
}

#[test]
fn historical_missing_index_is_not_treated_as_empty_for_ambiguous_or_formal_members() {
    use record_cli::{
        domains::{decision, investigation},
        source::{RelativePath, open_root},
        stage::{
            StageScope, decision_scope::stage_decisions, index_scope::stage_index,
            investigation_scope::stage_investigations,
        },
    };
    for domain in ["decisions", "investigations"] {
        for candidate in [false, true] {
            let (dir, index_name, index) = historical_missing_fixture(domain, candidate);
            let root = dir.path();
            let before = git(root, &["ls-files", "--stage", "-z"]);
            let root_handle = open_root(root).unwrap();
            let path = RelativePath::new(format!("records/{index_name}")).unwrap();
            if domain == "investigations" && candidate {
                assert!(
                    stage_index(
                        &root_handle,
                        &path,
                        &investigation::Definition,
                        &["240229-record".into()],
                        |state| &state.name
                    )
                    .is_ok()
                );
            } else {
                for scope in [StageScope::Index, StageScope::All, StageScope::Domain] {
                    let result = if domain == "decisions" {
                        if scope == StageScope::Index {
                            stage_index(
                                &root_handle,
                                &path,
                                &decision::Definition,
                                &["240229-record".into()],
                                |state| &state.name,
                            )
                        } else {
                            stage_decisions(&root_handle, &path, &["240229-record".into()], scope)
                        }
                    } else if scope == StageScope::Index {
                        stage_index(
                            &root_handle,
                            &path,
                            &investigation::Definition,
                            &["240229-record".into()],
                            |state| &state.name,
                        )
                    } else {
                        stage_investigations(&root_handle, &path, &["240229-record".into()], scope)
                    };
                    let error = result.unwrap_err();
                    assert_eq!(error.code(), "historical-index-missing");
                    assert!(
                        matches!(&error, record_cli::stage::index_scope::IndexStageError::HistoricalIndexMissing { namespace_indeterminate } if *namespace_indeterminate == (domain == "decisions"))
                    );
                    assert!(error.pending_outcome().is_none());
                    assert_eq!(before, git(root, &["ls-files", "--stage", "-z"]));
                }
                fs::write(
                    root.join("records").join(index_name),
                    b"invalid pending index",
                )
                .unwrap();
                git(root, &["add", "--", &format!("records/{index_name}")]);
                fs::write(
                    root.join("records").join(index_name),
                    serde_json::to_vec(&index).unwrap(),
                )
                .unwrap();
                let corrupt_pending = git(root, &["ls-files", "--stage", "-z"]);
                let domain_result = if domain == "decisions" {
                    stage_decisions(
                        &root_handle,
                        &path,
                        &["240229-record".into()],
                        StageScope::Domain,
                    )
                } else {
                    stage_investigations(
                        &root_handle,
                        &path,
                        &["240229-record".into()],
                        StageScope::Domain,
                    )
                };
                assert_eq!(
                    domain_result.unwrap_err().code(),
                    "historical-index-missing"
                );
                assert_eq!(corrupt_pending, git(root, &["ls-files", "--stage", "-z"]));
            }
        }
    }
}
#[test]
fn historical_empty_namespace_without_index_allows_selected_index_stage() {
    use record_cli::{
        domains::{decision, investigation},
        source::{RelativePath, open_root},
        stage::index_scope::stage_index,
    };
    for domain in ["decisions", "investigations"] {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        git(root, &["init", "-q"]);
        git(root, &["config", "user.name", "Fixture"]);
        git(root, &["config", "user.email", "fixture@example.invalid"]);
        fs::create_dir(root.join("records")).unwrap();
        fs::write(root.join("records/.keep"), b"empty namespace\n").unwrap();
        git(root, &["add", "--", "records/.keep"]);
        git(root, &["commit", "-qm", "empty baseline"]);
        let (name, index) = fixture_index(domain);
        fs::write(
            root.join("records").join(name),
            serde_json::to_vec(&index).unwrap(),
        )
        .unwrap();
        git(root, &["add", "--", &format!("records/{name}")]);
        let root_handle = open_root(root).unwrap();
        let path = RelativePath::new(format!("records/{name}")).unwrap();
        let result = if domain == "decisions" {
            stage_index(
                &root_handle,
                &path,
                &decision::Definition,
                &["240229-record".into()],
                |state| &state.name,
            )
        } else {
            stage_index(
                &root_handle,
                &path,
                &investigation::Definition,
                &["240229-record".into()],
                |state| &state.name,
            )
        };
        assert!(result.is_ok(), "{result:?}");
    }
}
