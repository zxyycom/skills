use super::*;

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
        transaction::preflight,
    };
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
        let result = run_transaction(&root, &mut op);
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
