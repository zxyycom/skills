use super::*;
use crate::index::{IndexV4, RelationGraph, Revision};
use std::collections::BTreeMap;

struct Definition;
impl crate::index::sealed::Sealed for Definition {}
impl DomainDefinition for Definition {
    type State = serde_json::Value;
    fn namespace(&self) -> &'static str {
        "fixture"
    }
    fn definition_version(&self) -> u32 {
        1
    }
    fn validate(&self, _: &mut IndexV4<Self::State>) -> Result<(), IndexError> {
        Ok(())
    }
    fn graph(&self, _: &IndexV4<Self::State>) -> Result<RelationGraph, IndexError> {
        Ok(RelationGraph {
            nodes: vec![],
            outgoing: BTreeMap::new(),
            incoming: BTreeMap::new(),
        })
    }
}
fn index(entries: &[(&str, &str)], metadata: &str) -> ValidatedIndex<serde_json::Value> {
    build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "fixture".into(),
            definition_version: 1,
            metadata: serde_json::json!({"value": metadata}),
            source_revision: Revision {
                metadata: "meta".into(),
                entries: entries
                    .iter()
                    .map(|(id, value)| ((*id).into(), (*value).into()))
                    .collect(),
            },
            entries: entries
                .iter()
                .map(|(id, value)| ((*id).into(), serde_json::json!(value)))
                .collect(),
        },
        &Definition,
    )
    .unwrap()
}
#[test]
fn compose_preserves_pending_unselected_and_refreshes_add_delete() {
    let p = index(&[("a", "p-a"), ("b", "p-b"), ("c", "p-c")], "same");
    let w = index(&[("a", "w-a"), ("c", "w-c"), ("d", "w-d")], "same");
    let bytes = compose_index(
        &Definition,
        StageScope::Index,
        IndexInputs {
            head: Some(&p),
            worktree: &w,
            pending: Some(&p),
        },
        &["a".into(), "b".into(), "d".into()],
    )
    .unwrap()
    .unwrap();
    let result = crate::index::parse_index(&bytes, &Definition).unwrap();
    assert_eq!(
        result.index().entries,
        BTreeMap::from([
            ("a".into(), serde_json::json!("w-a")),
            ("c".into(), serde_json::json!("p-c")),
            ("d".into(), serde_json::json!("w-d"))
        ])
    );
    assert_eq!(result.index().source_revision.entries["c"], "p-c");
}
#[test]
fn compose_rejects_collection_change_and_pending_deletion() {
    let h = index(&[("a", "h")], "head");
    let w = index(&[("a", "w")], "work");
    assert!(
        compose_index(
            &Definition,
            StageScope::All,
            IndexInputs {
                head: Some(&h),
                worktree: &w,
                pending: Some(&w)
            },
            &["a".into()]
        )
        .is_err()
    );
    assert!(
        compose_index(
            &Definition,
            StageScope::Index,
            IndexInputs {
                head: Some(&w),
                worktree: &w,
                pending: None
            },
            &["a".into()]
        )
        .is_err()
    );
    assert!(
        compose_index(
            &Definition,
            StageScope::Domain,
            IndexInputs {
                head: Some(&w),
                worktree: &w,
                pending: None
            },
            &["a".into()]
        )
        .unwrap()
        .is_none()
    );
}

#[test]
fn publication_distinguishes_read_failure_and_drift_without_writes() {
    use std::{path::PathBuf, process::Command};

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path();
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(path)
            .args(["init", "-q"])
            .status()
            .unwrap()
            .success()
    );
    let root = crate::source::open_root(path).unwrap();
    let selected = PathBuf::from("selected");
    let pending = crate::git::read_selected(path, std::slice::from_ref(&selected)).unwrap();
    let empty = publication::SourcePublication {
        root: &root,
        revision: None,
        pending: &pending,
        updates: &[],
    };
    let read = empty
        .publish(|| Ok(()), || Err(FreshnessError::Read))
        .unwrap_err();
    assert!(matches!(read, index_scope::IndexStageError::Selection(_)));
    let drift = empty
        .publish(|| Ok(()), || Err(FreshnessError::Drift))
        .unwrap_err();
    assert!(matches!(drift, index_scope::IndexStageError::Drift));
    assert!(!path.join(".git/index.lock").exists());
}

#[test]
fn publication_keeps_committed_paths_when_verification_fails() {
    use crate::git::publish::{PendingFile, PendingUpdate};
    use std::{fs, path::PathBuf, process::Command};
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path();
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(path)
            .args(["init", "-q"])
            .status()
            .unwrap()
            .success()
    );
    let root = crate::source::open_root(path).unwrap();
    let selected = PathBuf::from("selected");
    let pending = crate::git::read_selected(path, std::slice::from_ref(&selected)).unwrap();
    let updates = [PendingUpdate {
        path: selected.clone(),
        file: Some(PendingFile {
            mode: 0o100644,
            bytes: b"published\n".to_vec(),
        }),
    }];
    let publication = publication::SourcePublication {
        root: &root,
        revision: None,
        pending: &pending,
        updates: &updates,
    };
    let error = publication
        .publish(|| Ok(()), || Err(FreshnessError::Read))
        .unwrap_err();
    assert!(
        matches!(error, index_scope::IndexStageError::CommittedUnverified { changed_paths } if changed_paths == vec![selected])
    );
    let result = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["show", ":selected"])
        .output()
        .unwrap();
    assert!(result.status.success());
    assert_eq!(result.stdout, b"published\n");
    assert!(!path.join(".git/index.lock").exists());
    assert!(!fs::exists(path.join("selected")).unwrap());
}
