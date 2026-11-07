use super::*;
use crate::{domains::decision::Definition, index::serialize_index};
struct FailBeforeIndex<O>(O, usize);
impl<O: TransactionOperation<PreparedLifecycle>> TransactionOperation<PreparedLifecycle>
    for FailBeforeIndex<O>
{
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedLifecycle>, TxError> {
        self.0.prepare(root)
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if index == self.1 {
            Err(failure("injected", "before index"))
        } else {
            Ok(())
        }
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedLifecycle>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedLifecycle>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedLifecycle>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
#[test]
fn private_mark_aligned_preflight_and_transaction() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let (text, index) = crate::mutations::tests::decision_fixture::sample(false);
    let id = crate::mutations::tests::decision_fixture::ID;
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = MarkAlignedOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: "one".into(),
    };
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    let preview = crate::transaction::preflight(&root, &mut operation).unwrap();
    assert_eq!(preview.writes.len(), 2);
    assert_eq!(
        std::fs::read(collection.join("one.md")).unwrap(),
        text.as_bytes()
    );
    let mut failing = FailBeforeIndex(operation, 1);
    let failed = crate::transaction::run_transaction(&root, &lock, &mut failing);
    assert!(!failed.errors.is_empty());
    assert!(!failed.committed);
    assert_eq!(
        failed.outcome,
        crate::transaction::RecoveryStatus::RolledBack
    );
    assert_eq!(
        std::fs::read(collection.join("one.md")).unwrap(),
        text.as_bytes()
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        index_bytes
    );
    let mut operation = failing.0;
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.cleanup_errors.is_empty());
    assert!(result.committed && result.changed);
    assert_eq!(
        result.verification,
        crate::transaction::VerificationStatus::Passed
    );
    let index = std::fs::read(collection.join("decision-index.json")).unwrap();
    let parsed = crate::index::parse_index(&index, &Definition).unwrap();
    assert_eq!(parsed.index().entries[id].alignment, "aligned");
    let text_after = std::fs::read_to_string(collection.join("one.md")).unwrap();
    assert!(text_after.contains("Body remains."));
    let rejected = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert_eq!(
        rejected.errors[0].code,
        "decision-records.lifecycle-invalid"
    );
    assert!(
        rejected.errors[0]
            .reason
            .as_deref()
            .unwrap()
            .contains("one.md")
    );
    assert!(rejected.errors[0].recovery.is_some());
    assert!(!rejected.changed);
}
#[test]
fn private_reactivate_moves_source_and_publishes_index() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir_all(collection.join("archive")).unwrap();
    let (text, index) = crate::mutations::tests::decision_fixture::sample(true);
    let id = crate::mutations::tests::decision_fixture::ID;
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("archive/one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    let mut operation = ReactivateOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: "one".into(),
        alignment: Alignment::Aligned,
    };
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    assert_eq!(
        crate::transaction::preflight(&root, &mut operation)
            .unwrap()
            .writes
            .len(),
        3
    );
    assert!(!collection.join("one.md").exists());
    let mut failing = FailBeforeIndex(operation, 2);
    let failed = crate::transaction::run_transaction(&root, &lock, &mut failing);
    assert!(!failed.errors.is_empty());
    assert!(!failed.committed);
    assert_eq!(
        failed.outcome,
        crate::transaction::RecoveryStatus::RolledBack
    );
    assert!(!collection.join("one.md").exists());
    assert_eq!(
        std::fs::read(collection.join("archive/one.md")).unwrap(),
        text.as_bytes()
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        index_bytes
    );
    let mut operation = failing.0;
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(
        result.cleanup_errors.is_empty(),
        "{:?}",
        result.cleanup_errors
    );
    assert!(result.committed && result.changed);
    assert_eq!(
        result.verification,
        crate::transaction::VerificationStatus::Passed
    );
    assert!(!collection.join("archive/one.md").exists());
    assert!(collection.join("one.md").is_file());
    let index = std::fs::read(collection.join("decision-index.json")).unwrap();
    let parsed = crate::index::parse_index(&index, &Definition).unwrap();
    assert_eq!(parsed.index().entries[id].alignment, "aligned");
    assert_eq!(parsed.index().entries[id].status, "active");
}
struct FailArchive(ArchiveOperation);
struct RivalArchive(ArchiveOperation);
impl TransactionOperation<PreparedArchive> for RivalArchive {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedArchive>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedArchive>) -> Result<(), TxError> {
        let directory = root.path().join("decisions/archive");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("rival"), b"untouched").unwrap();
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedArchive>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedArchive>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
impl TransactionOperation<PreparedArchive> for FailArchive {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedArchive>, TxError> {
        self.0.prepare(root)
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if index == 2 {
            Err(failure("injected", "before index"))
        } else {
            Ok(())
        }
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedArchive>) -> Result<(), TxError> {
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedArchive>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedArchive>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
fn archive_fixture() -> (tempfile::TempDir, Root, &'static str, Vec<u8>) {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let (text, index) = crate::mutations::tests::decision_fixture::sample(false);
    let index_bytes = serialize_index(&index, &Definition).unwrap();
    std::fs::write(collection.join("one.md"), text).unwrap();
    std::fs::write(collection.join("decision-index.json"), &index_bytes).unwrap();
    let root = crate::source::open_root(dir.path()).unwrap();
    (dir, root, text, index_bytes)
}
#[test]
fn private_archive_outside_git_and_precommit_recovery() {
    let (dir, root, text, index_bytes) = archive_fixture();
    let collection = dir.path().join("decisions");
    let operation = ArchiveOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selectors: vec!["one".into()],
        keep_unrecorded_history: false,
    };
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    let mut failing = FailArchive(operation);
    assert_eq!(
        crate::transaction::preflight(&root, &mut failing)
            .unwrap()
            .writes
            .len(),
        3
    );
    assert!(!collection.join("archive").exists());
    let mut rival = RivalArchive(failing.0);
    let rejected = crate::transaction::run_transaction(&root, &lock, &mut rival);
    assert!(!rejected.errors.is_empty());
    assert!(!rejected.changed && !rejected.committed);
    assert_eq!(
        std::fs::read(collection.join("archive/rival")).unwrap(),
        b"untouched"
    );
    assert_eq!(
        std::fs::read(collection.join("one.md")).unwrap(),
        text.as_bytes()
    );
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        index_bytes
    );
    std::fs::remove_file(collection.join("archive/rival")).unwrap();
    std::fs::remove_dir(collection.join("archive")).unwrap();
    let mut failing = FailArchive(rival.0);
    let failed = crate::transaction::run_transaction(&root, &lock, &mut failing);
    assert!(!failed.errors.is_empty());
    assert!(!failed.committed);
    assert_eq!(
        failed.outcome,
        crate::transaction::RecoveryStatus::PartialOrUnknown
    );
    assert!(
        failed
            .unknown_paths
            .contains(&RelativePath::new("decisions/archive").unwrap())
    );
    assert_eq!(
        std::fs::read(collection.join("one.md")).unwrap(),
        text.as_bytes()
    );
    assert!(!collection.join("archive/one.md").exists());
    assert_eq!(
        std::fs::read(collection.join("decision-index.json")).unwrap(),
        index_bytes
    );
    std::fs::remove_dir(collection.join("archive")).unwrap();
}
#[test]
fn private_archive_checks_unborn_history_and_freshness_before_success() {
    let (dir, root, _text, _index_bytes) = archive_fixture();
    let collection = dir.path().join("decisions");
    let lock = RelativePath::new(".decision-index.json.mutation.lock").unwrap();
    let initialized = std::process::Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(initialized.success());
    let mut operation = ArchiveOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selectors: vec!["one".into()],
        keep_unrecorded_history: false,
    };
    let unconfirmed = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert_eq!(
        unconfirmed.errors[0].code,
        "decision-records.unrecorded-history"
    );
    assert!(
        unconfirmed.errors[0]
            .target
            .as_deref()
            .unwrap()
            .contains("one")
    );
    assert!(
        unconfirmed.errors[0]
            .recovery
            .as_deref()
            .unwrap()
            .contains("--keep-unrecorded-history")
    );
    assert!(!unconfirmed.changed);
    operation.keep_unrecorded_history = true;
    std::fs::create_dir(collection.join("archive")).unwrap();
    let prepared = operation.prepare(&root).unwrap();
    std::fs::rename(collection.join("archive"), collection.join("old-archive")).unwrap();
    std::fs::create_dir(collection.join("archive")).unwrap();
    operation.fresh(&root, &prepared).unwrap();
    std::fs::write(collection.join("archive/one.md"), b"new member").unwrap();
    assert!(operation.fresh(&root, &prepared).is_err());
    std::fs::remove_file(collection.join("archive/one.md")).unwrap();
    std::fs::remove_dir(collection.join("archive")).unwrap();
    std::fs::rename(collection.join("old-archive"), collection.join("archive")).unwrap();
    std::fs::remove_dir(collection.join("archive")).unwrap();
    let result = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed && result.changed);
    assert!(!collection.join("one.md").exists());
    assert!(collection.join("archive/one.md").is_file());
}
