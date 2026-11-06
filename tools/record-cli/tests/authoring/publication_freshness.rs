use super::*;

#[test]
fn publication_fresh_rejects_changed_selected_body_before_writing() {
    use record_cli::{
        mutations::authoring::investigation_publish::{
            InvestigationPublishOperation, PreparedPublication,
        },
        source::Root,
        transaction::{Plan, TransactionOperation, TxError},
    };
    struct ConcurrentEdit(InvestigationPublishOperation);
    impl TransactionOperation<PreparedPublication> for ConcurrentEdit {
        fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedPublication>, TxError> {
            self.0.prepare(root)
        }
        fn fresh(&mut self, root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
            let path = root.path().join("reports/_candidate.261106-report");
            let mut bytes = std::fs::read(&path).unwrap();
            bytes.extend_from_slice(b"late edit\n");
            std::fs::write(path, bytes).unwrap();
            self.0.fresh(root, plan)
        }
        fn verify(&mut self, root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
            self.0.verify(root, plan)
        }
        fn verify_recovered(
            &mut self,
            root: &Root,
            plan: &Plan<PreparedPublication>,
        ) -> Result<(), TxError> {
            self.0.verify_recovered(root, plan)
        }
    }
    let fixture = tempfile::tempdir().unwrap();
    let directory = fixture.path().join("reports");
    std::fs::create_dir(&directory).unwrap();
    let doc = "---\ntitle: \"Report title\"\nid: \"261106-report\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"What happened?\"\ntags:\n  - \"test\"\nrelations: []\n---\n\n## 形成时背景\n背景。\n\n## 调查目的\n目的。\n\n## 调查范围与依据\n依据。\n\n## 调查结果与边界\n结果。\n";
    let candidate = directory.join("_candidate.261106-report");
    std::fs::write(&candidate, doc).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = ConcurrentEdit(InvestigationPublishOperation {
        collection: RelativePath::new("reports").unwrap(),
        selectors: vec!["report".into()],
    });
    let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut op);
    assert_eq!(result.status, TxStatus::Error);
    assert!(!result.changed && !result.committed);
    assert!(
        std::fs::read_to_string(candidate)
            .unwrap()
            .ends_with("late edit\n")
    );
    assert!(!directory.join("261106-report.md").exists());
    assert!(!directory.join("investigation-index.json").exists());
}

fn indexed_formal_fixture(variant: &str) -> tempfile::TempDir {
    use record_cli::{
        domains::investigation::{self, Definition},
        index::{IndexV4, Revision, build_index, serialize_index},
        source_revision::{Domain, fingerprint, metadata_fingerprint},
    };
    use std::collections::BTreeMap;
    let fixture = tempfile::tempdir().unwrap();
    let dir = fixture.path().join("reports");
    std::fs::create_dir_all(dir.join("_resources/261106-owner")).unwrap();
    std::fs::create_dir_all(dir.join("_resources/261106-new")).unwrap();
    std::fs::write(dir.join("_resources/261106-owner/shared.txt"), b"shared").unwrap();
    std::fs::write(
        dir.join("_resources/261106-new/unreferenced.txt"),
        b"leave untouched",
    )
    .unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        "missing-target",
        dir.join("_resources/261106-new/unsafe-link"),
    )
    .unwrap();
    let formal = ready_report(
        "261106-owner",
        "relations: []",
        "\n## 随附资源\n- [missing](./_resources/261106-owner/missing.txt)\n- [shared](./_resources/261106-owner/shared.txt)\n",
    );
    let state = investigation::parse_established(formal.as_bytes(), "261106-owner", "owner.md")
        .unwrap()
        .state;
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: metadata_fingerprint(Domain::Investigation),
                entries: BTreeMap::from([(
                    "261106-owner".into(),
                    fingerprint(Domain::Investigation, "261106-owner", "owner.md", &formal),
                )]),
            },
            entries: BTreeMap::from([("261106-owner".into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(
        dir.join("investigation-index.json"),
        serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    match variant {
        "corrupt" => std::fs::write(dir.join("owner.md"), [0xff, 0xfe]).unwrap(),
        "stale" => std::fs::write(dir.join("owner.md"), b"modified outside index").unwrap(),
        #[cfg(unix)]
        "symlink" => std::os::unix::fs::symlink("does-not-exist", dir.join("owner.md")).unwrap(),
        _ => {}
    }
    let candidate = ready_report(
        "261106-new",
        "relations:\n  - type: \"补充\"\n    target: \"261106-owner\"",
        if variant == "missing" {
            ""
        } else {
            "\n## 随附资源\n- [shared](./_resources/261106-owner/shared.txt)\n"
        },
    );
    std::fs::write(dir.join("_candidate.261106-new"), candidate).unwrap();
    fixture
}

#[test]
fn publication_uses_formal_index_not_unselected_bodies_or_unreferenced_resources() {
    use record_cli::{
        mutations::authoring::investigation_publish::InvestigationPublishOperation,
        mutations::authoring::investigation_publish::PreparedPublication,
        source::Root,
        transaction::{Plan, TransactionOperation, TxError, preflight},
    };
    struct RemoveFormal {
        inner: InvestigationPublishOperation,
        remove: bool,
    }
    impl TransactionOperation<PreparedPublication> for RemoveFormal {
        fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedPublication>, TxError> {
            self.inner.prepare(root)
        }
        fn fresh(&mut self, root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
            if self.remove {
                std::fs::remove_file(root.path().join("reports/owner.md")).unwrap();
            }
            self.inner.fresh(root, plan)
        }
        fn verify(&mut self, root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
            self.inner.verify(root, plan)
        }
        fn verify_recovered(
            &mut self,
            root: &Root,
            plan: &Plan<PreparedPublication>,
        ) -> Result<(), TxError> {
            self.inner.verify_recovered(root, plan)
        }
    }
    let variants = if cfg!(unix) {
        vec!["missing", "corrupt", "stale", "symlink"]
    } else {
        vec!["missing", "corrupt", "stale"]
    };
    for variant in variants {
        let fixture = indexed_formal_fixture(variant);
        let dir = fixture.path().join("reports");
        let root = open_root(fixture.path()).unwrap();
        let mut op = InvestigationPublishOperation {
            collection: RelativePath::new("reports").unwrap(),
            selectors: vec!["new".into()],
        };
        let preview = preflight(&root, &mut op).unwrap();
        assert!(
            preview
                .value
                .warnings
                .iter()
                .any(|w| w.contains("unreferenced.txt")),
            "{variant}"
        );
        #[cfg(unix)]
        assert!(
            preview
                .value
                .warnings
                .iter()
                .any(|w| w.contains("unsafe-link"))
        );
        let mut operation = RemoveFormal {
            inner: op,
            remove: variant == "stale",
        };
        let result = run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut operation);
        assert_eq!(
            result.status,
            TxStatus::Ok,
            "{variant}: {:?}",
            result.errors
        );
        assert!(result.committed);
        assert_eq!(
            std::fs::read(dir.join("_resources/261106-new/unreferenced.txt")).unwrap(),
            b"leave untouched"
        );
        assert!(!dir.join("_resources/261106-owner/missing.txt").exists());
    }
}
