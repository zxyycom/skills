use super::*;
use crate::source::RelativePath;
struct Drift(DecisionSyncOperation);
impl TransactionOperation<PreparedSync> for Drift {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSync>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let path = root.path().join("decisions/one.md");
        let mut text = std::fs::read_to_string(&path).unwrap();
        text.push_str("\nConcurrent edit.\n");
        std::fs::write(path, text).unwrap();
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
#[test]
fn full_sync_preflight_fresh_and_published_index_are_distinct() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let text = "---\ntitle: Example title\nid: 250102-one\nstatus: active\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n";
    std::fs::write(collection.join("one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = DecisionSyncOperation {
        directory: "decisions".into(),
    };
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.state, "previewed");
    assert!(!preview.changed);
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        b"broken"
    );
    let mut drifting = Drift(operation);
    let failed = crate::transaction::run_transaction(&root, &lock, &mut drifting);
    assert!(!failed.errors.is_empty());
    assert!(!failed.changed);
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        b"broken"
    );
    assert!(
        std::fs::read_to_string(collection.join("one.md"))
            .unwrap()
            .contains("Concurrent edit.")
    );
    std::fs::write(collection.join("one.md"), text).unwrap();
    operation = drifting.0;
    let written = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(written.errors.is_empty(), "{:?}", written.errors);
    assert!(written.changed && written.committed);
    assert_eq!(
        written.verification,
        crate::transaction::VerificationStatus::Passed
    );
    assert_eq!(written.value.unwrap().result(true).state, "written");
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.state, "unchanged");
    let unchanged = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(unchanged.errors.is_empty(), "{:?}", unchanged.errors);
    assert!(!unchanged.changed && !unchanged.committed);
    std::fs::remove_file(collection.join("decision-index.json")).unwrap();
    let created = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(created.errors.is_empty(), "{:?}", created.errors);
    assert!(created.changed && created.committed);
}

#[cfg(unix)]
#[test]
fn fresh_compares_source_bytes_and_mode_not_replaced_inode() {
    use std::os::unix::fs::{MetadataExt, PermissionsExt};

    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let path = collection.join("one.md");
    let text = "---\ntitle: Example title\nid: 250102-one\nstatus: active\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## 目的\n\nSome purpose.\n\n## 背景\n\nSome background.\n\n## 决策\n\n- 采用: Some decision.\n";
    std::fs::write(&path, text).unwrap();
    std::fs::write(collection.join("decision-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = DecisionSyncOperation {
        directory: "decisions".into(),
    };
    let plan = operation.prepare(&root).unwrap();
    let old = std::fs::metadata(&path).unwrap();
    let replacement = dir.path().join("replacement");
    std::fs::write(&replacement, text).unwrap();
    std::fs::set_permissions(&replacement, old.permissions()).unwrap();
    std::fs::rename(&replacement, &path).unwrap();
    assert_ne!(old.ino(), std::fs::metadata(&path).unwrap().ino());
    operation.fresh(&root, &plan).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(old.mode() ^ 0o100)).unwrap();
    assert!(operation.fresh(&root, &plan).is_err());
    std::fs::set_permissions(&path, old.permissions()).unwrap();
    std::fs::write(&path, format!("{text}\nChanged body.\n")).unwrap();
    assert!(operation.fresh(&root, &plan).is_err());
}
