use super::*;
use crate::source_revision::fingerprint;
use crate::transaction::{Plan, TransactionOperation};
use crate::{
    index::{self, IndexV4, Revision, build_index, serialize_index},
    source_revision::metadata_fingerprint,
};
struct OtherOwnerChanges(SelectedInvestigationSyncOperation);
impl TransactionOperation<PreparedSelected> for OtherOwnerChanges {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSelected>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSelected>) -> Result<(), TxError> {
        std::fs::write(
            root.path()
                .join("investigations/_resources/unselected/new.txt"),
            b"other owner",
        )
        .unwrap();
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSelected>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedSelected>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
struct OwnerAppears(SelectedInvestigationSyncOperation);
impl TransactionOperation<PreparedSelected> for OwnerAppears {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedSelected>, TxError> {
        self.0.prepare(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedSelected>) -> Result<(), TxError> {
        std::fs::create_dir(root.path().join("investigations/_resources/260828-new")).unwrap();
        self.0.fresh(root, plan)
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedSelected>) -> Result<(), TxError> {
        self.0.verify(root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedSelected>,
    ) -> Result<(), TxError> {
        self.0.verify_recovered(root, plan)
    }
}
#[test]
fn selected_sync_preserves_unrelated_source_and_requires_old_owner_absence() {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("investigations");
    std::fs::create_dir_all(collection.join("_resources/unselected")).unwrap();
    std::fs::write(
        collection.join("_resources/unselected/note.txt"),
        b"unselected",
    )
    .unwrap();
    let a = include_str!(
        "../../../../../investigation-report/tests/fixtures/rename-noop/docs/investigations/same.md"
    )
    .to_owned();
    let b = a
        .replace("260828-same", "260827-other")
        .replace("2026-08-28", "2026-08-27");
    let state_a = domains::investigation::parse_established(a.as_bytes(), "260828-same", "same.md")
        .unwrap()
        .state;
    let state_b =
        domains::investigation::parse_established(b.as_bytes(), "260827-other", "other.md")
            .unwrap()
            .state;
    let revision_b = fingerprint(Domain::Investigation, "260827-other", "other.md", &b);
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: metadata_fingerprint(Domain::Investigation),
                entries: BTreeMap::from([
                    (
                        "260828-same".into(),
                        fingerprint(Domain::Investigation, "260828-same", "same.md", &a),
                    ),
                    ("260827-other".into(), revision_b.clone()),
                ]),
            },
            entries: BTreeMap::from([
                ("260828-same".into(), state_a),
                ("260827-other".into(), state_b),
            ]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(collection.join("same.md"), format!("{a}\nSelected edit.\n")).unwrap();
    std::fs::write(
        collection.join("other.md"),
        format!("{b}\nUnselected edit.\n"),
    )
    .unwrap();
    std::fs::write(
        collection.join("investigation-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let lock = RelativePath::new(".investigation-index.json.mutation.lock").unwrap();
    let missing =
        SelectedInvestigationSyncOperation::new("investigations".into(), vec!["missing".into()]);
    assert!(missing.preflight(&root).is_err());
    assert_eq!(missing.observed_baseline_count(), Some(2));
    let absent = SelectedInvestigationSyncOperation::new("absent".into(), vec!["missing".into()]);
    let failure = absent.preflight(&root).unwrap_err();
    assert_eq!(
        failure.diagnostics[0].code,
        "state-index.selected-baseline-invalid"
    );
    assert_eq!(
        failure.diagnostics[0].target.as_deref(),
        Some("investigation-index.json")
    );
    assert!(failure.diagnostics[0].recovery.is_some());
    assert_eq!(absent.observed_baseline_count(), None);
    let operation = SelectedInvestigationSyncOperation::new(
        "investigations".into(),
        vec!["260828-same".into()],
    );
    let preview = operation.preflight(&root).unwrap();
    assert_eq!(preview.coverage.checked_ids, vec!["260828-same"]);
    assert_eq!(preview.state, "previewed");
    let mut changing = OtherOwnerChanges(operation);
    let result = crate::transaction::run_transaction(&root, &lock, &mut changing);
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.changed && result.committed);
    let mut operation = changing.0;
    let loaded = index::parse_index(
        &std::fs::read(collection.join("investigation-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert_eq!(
        loaded.index().source_revision.entries["260827-other"],
        revision_b
    );
    std::fs::write(
        collection.join("same.md"),
        a.replace("260828-same", "260828-new"),
    )
    .unwrap();
    assert!(operation.preflight(&root).is_err());
    operation.selectors = vec!["260828-same".into(), "260828-new.MD".into()];
    let renamed = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(renamed.errors.is_empty(), "{:?}", renamed.errors);
    assert!(renamed.committed);
    std::fs::remove_file(collection.join("same.md")).unwrap();
    std::fs::create_dir(collection.join("_resources/260828-new")).unwrap();
    operation.selectors = vec!["260828-new".into()];
    assert_eq!(
        operation.preflight(&root).unwrap_err().code,
        "resource-owner-present"
    );
    std::fs::remove_dir(collection.join("_resources/260828-new")).unwrap();
    std::fs::create_dir(collection.join("_resources/260828-NEW")).unwrap();
    assert_eq!(
        operation.preflight(&root).unwrap_err().code,
        "resource-owner-present"
    );
    std::fs::remove_dir(collection.join("_resources/260828-NEW")).unwrap();
    let before = std::fs::read(collection.join("investigation-index.json")).unwrap();
    let mut appearing = OwnerAppears(operation);
    let rejected = crate::transaction::run_transaction(&root, &lock, &mut appearing);
    assert!(!rejected.errors.is_empty());
    assert!(!rejected.changed);
    assert_eq!(
        std::fs::read(collection.join("investigation-index.json")).unwrap(),
        before
    );
    std::fs::remove_dir(collection.join("_resources/260828-new")).unwrap();
    let mut operation = appearing.0;
    let deleted = crate::transaction::run_transaction(&root, &lock, &mut operation);
    assert!(deleted.errors.is_empty(), "{:?}", deleted.errors);
    assert!(deleted.committed);
}
