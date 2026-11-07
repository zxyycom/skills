use super::*;
use crate::index::{IndexV4, Revision};
#[test]
fn rename_publishes_new_identity_and_removes_old() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("decisions");
    std::fs::create_dir(&c).unwrap();
    let id = "261106-old";
    let text = "---\ntitle: Example\nid: 261106-old\nstatus: active\nalignment: unaligned\ncreatedAt: 2026-11-06T12:00:00Z\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\nPurpose.\n\n## 背景\nBackground.\n\n## 决策\n- 采用：Decision.\n";
    let state = decision::parse_established(text.as_bytes(), id, "old.md")
        .unwrap()
        .state;
    let index = crate::index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::from([(
                    id.into(),
                    source_revision::fingerprint(Domain::Decision, id, "old.md", text),
                )]),
            },
            entries: BTreeMap::from([(id.into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    let index_bytes = crate::index::serialize_index(&index, &Definition).unwrap();
    std::fs::write(c.join("old.md"), text).unwrap();
    std::fs::write(c.join("decision-index.json"), &index_bytes).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = DecisionIdentityOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: id.into(),
        action: Action::Rename {
            target: "new".into(),
            confirm_recorded: false,
        },
    };
    let out = crate::transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.changed && out.committed);
    assert!(!c.join("old.md").exists());
    let renamed = std::fs::read_to_string(c.join("new.md")).unwrap();
    assert!(renamed.contains("261106-new"));
    let index = crate::index::parse_index(
        &std::fs::read(c.join("decision-index.json")).unwrap(),
        &Definition,
    )
    .unwrap();
    assert!(!index.index().entries.contains_key(id));
    assert_eq!(index.index().entries["261106-new"].source_path, "new.md");
}
