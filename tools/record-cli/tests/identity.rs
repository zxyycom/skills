use record_cli::{
    domains::decision::{self, Definition},
    index::{self, IndexV4, Revision},
    mutations::identity::decision::{Action, DecisionIdentityOperation},
    source::{self, RelativePath},
    source_revision::{self, Domain},
    transaction,
};
use std::collections::BTreeMap;
fn fixture() -> (tempfile::TempDir, source::Root) {
    let dir = tempfile::tempdir().unwrap();
    let collection = dir.path().join("decisions");
    std::fs::create_dir(&collection).unwrap();
    let id = "261106-original";
    let text = "---\ntitle: Example # retained comment\nid: 261106-original\nstatus: active\nalignment: unaligned\ncreatedAt: 2026-11-06T12:00:00Z\npurpose: Purpose\nbackground: Background\ndecision: Decision\ntags:\n  - example\nrelations: []\n---\n\n## 目的\nPurpose.\n\n## 背景\nBackground.\n\n## 决策\n- 采用：Decision.\n";
    let state = decision::parse_established(text.as_bytes(), id, "original.md")
        .unwrap()
        .state;
    let index = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::from([(
                    id.into(),
                    source_revision::fingerprint(Domain::Decision, id, "original.md", text),
                )]),
            },
            entries: BTreeMap::from([(id.into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    std::fs::write(collection.join("original.md"), text).unwrap();
    std::fs::write(
        collection.join("decision-index.json"),
        index::serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    let root = source::open_root(dir.path()).unwrap();
    (dir, root)
}
fn operation(action: Action) -> DecisionIdentityOperation {
    DecisionIdentityOperation {
        collection: RelativePath::new("decisions").unwrap(),
        index_path: RelativePath::new("decisions/decision-index.json").unwrap(),
        selector: "original".into(),
        action,
    }
}
fn git(path: &std::path::Path, args: &[&str]) {
    let out = std::process::Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[path = "identity/candidate.rs"]
mod candidate;
#[path = "identity/cli.rs"]
mod cli;
#[path = "identity/established.rs"]
mod established;

#[path = "identity/pending.rs"]
mod pending;
