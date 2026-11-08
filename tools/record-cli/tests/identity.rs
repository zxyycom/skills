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
    let text = include_str!("fixtures/identity/decisions/original.md");
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
    std::fs::copy(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/identity/decisions/original.md"),
        collection.join("original.md"),
    )
    .unwrap();
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
fn initialize_git(path: &std::path::Path) {
    git(path, &["init", "-q"]);
    git(path, &["config", "user.name", "Fixture"]);
    git(path, &["config", "user.email", "fixture@example.invalid"]);
}
fn commit_baseline(path: &std::path::Path) {
    git(path, &["add", "decisions"]);
    git(path, &["commit", "-qm", "baseline"]);
}
fn commit_fixture(path: &std::path::Path) {
    initialize_git(path);
    commit_baseline(path);
}

#[path = "identity/candidate.rs"]
mod candidate;
#[path = "identity/cli.rs"]
mod cli;
#[path = "identity/established.rs"]
mod established;

#[path = "identity/candidate_discard.rs"]
mod candidate_discard;
#[path = "identity/candidate_publication.rs"]
mod candidate_publication;
#[path = "identity/formal_lifecycle.rs"]
mod formal_lifecycle;
#[path = "identity/formal_rename.rs"]
mod formal_rename;
#[path = "identity/pending.rs"]
mod pending;
