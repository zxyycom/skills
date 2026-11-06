use super::*;
use crate::source::RelativePath;
struct ResourceChange {
    operation: InvestigationSyncOperation,
    replace: bool,
}
impl TransactionOperation<PreparedSync> for ResourceChange {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSync>, TxError> {
        self.operation.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        let file = root
            .path()
            .join("investigations/_resources/260828-same/file.txt");
        if self.replace {
            std::fs::rename(&file, file.with_extension("backup")).unwrap();
        }
        std::fs::write(
            &file,
            b"resource content changed in place with different length",
        )
        .unwrap();
        self.operation.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        self.operation.verify(root, plan)
    }
    fn verify_recovered(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        self.operation.verify_recovered(root, plan)
    }
}
#[test]
fn full_sync_tracks_resources_without_treating_in_place_bytes_as_index_revision() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir_all(collection.join("_resources/260828-same")).unwrap();
    let text = format!(
        "{}\n## 随附资源\n- [evidence](./_resources/260828-same/file.txt)\n",
        include_str!(
            "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
        )
    );
    std::fs::write(collection.join("same.md"), &text).unwrap();
    std::fs::write(collection.join("_resources/260828-same/file.txt"), b"old").unwrap();
    std::fs::write(collection.join("investigation-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".investigation-index.json.mutation.lock").unwrap();
    let operation = InvestigationSyncOperation {
        directory: "investigations".into(),
    };
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.state, "previewed");
    assert!(!preview.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        b"broken"
    );
    let mut changing = ResourceChange {
        operation,
        replace: false,
    };
    let written = crate::transaction::run_transaction(&root, &lock, &mut changing);
    assert!(written.errors.is_empty(), "{:?}", written.errors);
    assert!(written.changed && written.committed);
    assert_eq!(
        written.verification,
        crate::transaction::VerificationStatus::Passed
    );
    let before_index = std::fs::read(collection.join("investigation-index.json")).unwrap();
    std::fs::write(
        collection.join("same.md"),
        format!("{text}\nAdditional content.\n"),
    )
    .unwrap();
    changing.replace = true;
    let rejected = crate::transaction::run_transaction(&root, &lock, &mut changing);
    assert!(!rejected.errors.is_empty());
    assert!(!rejected.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        before_index
    );
}
struct ResourceRootAppears(InvestigationSyncOperation);
impl TransactionOperation<PreparedSync> for ResourceRootAppears {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSync>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        std::fs::create_dir(root.path().join("investigations/_resources")).unwrap();
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
fn resource_root_appearance_between_prepare_and_fresh_blocks_publication() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    let text = include_str!(
        "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
    );
    std::fs::write(collection.join("same.md"), text).unwrap();
    std::fs::write(collection.join("investigation-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".investigation-index.json.mutation.lock").unwrap();
    let mut operation = ResourceRootAppears(InvestigationSyncOperation {
        directory: "investigations".into(),
    });
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(!result.errors.is_empty());
    assert!(!result.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        b"broken"
    );
}
struct IgnoreDuringFresh(InvestigationSyncOperation);
impl TransactionOperation<PreparedSync> for IgnoreDuringFresh {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSync>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSync>) -> Result<(), TxError> {
        std::fs::write(
            root.path().join(".gitignore"),
            "investigations/_resources/\n",
        )
        .unwrap();
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
fn git_visibility_change_during_fresh_does_not_publish() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir_all(collection.join("_resources/260828-same")).unwrap();
    let text = format!(
        "{}\n## 随附资源\n- [evidence](./_resources/260828-same/file.txt)\n",
        include_str!(
            "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
        )
    );
    std::fs::write(collection.join("same.md"), text).unwrap();
    std::fs::write(
        collection.join("_resources/260828-same/file.txt"),
        b"visible",
    )
    .unwrap();
    std::fs::write(collection.join("investigation-index.json"), b"broken").unwrap();
    let status = std::process::Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(status.success());
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".investigation-index.json.mutation.lock").unwrap();
    let mut operation = IgnoreDuringFresh(InvestigationSyncOperation {
        directory: "investigations".into(),
    });
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(!result.errors.is_empty());
    assert!(!result.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        b"broken"
    );
}
#[test]
fn unreferenced_unsafe_resource_root_is_warning_with_stable_membership_proof() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir(&collection).unwrap();
    std::fs::write(collection.join("same.md"), include_str!("../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md")).unwrap();
    std::fs::write(collection.join("_resources"), b"not a directory").unwrap();
    std::fs::write(collection.join("investigation-index.json"), b"broken").unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".investigation-index.json.mutation.lock").unwrap();
    let mut operation = InvestigationSyncOperation {
        directory: "investigations".into(),
    };
    let preview = operation.preflight(&root).unwrap();
    assert!(
        preview
            .warnings
            .iter()
            .any(|warning| warning.contains("unsafe"))
    );
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
}
