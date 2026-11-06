use crate::{
    domains::decision::{DecisionState, Definition},
    index::{IndexV4, Revision, ValidatedIndex, build_index},
    source_revision::{Domain, fingerprint},
};
use std::collections::BTreeMap;

pub(in crate::mutations) const ID: &str = "250102-one";

pub(in crate::mutations) fn sample(
    archived: bool,
) -> (&'static str, ValidatedIndex<DecisionState>) {
    let (text, path, status) = if archived {
        (
            "---\ntitle: Example title\nid: 250102-one\nstatus: archived\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## Purpose\n\nBody remains.\n",
            "archive/one.md",
            "archived",
        )
    } else {
        (
            "---\ntitle: Example title\nid: 250102-one\nstatus: active\nalignment: unaligned\ncreatedAt: 2025-01-02T00:00:00Z\npurpose: Some purpose\nbackground: Some background\ndecision: Some decision\ntags:\n  - tag\nrelations: []\n---\n\n## Purpose\n\nBody remains.\n",
            "one.md",
            "active",
        )
    };
    let digest = fingerprint(Domain::Decision, ID, path, text);
    let state = DecisionState {
        name: "one".into(),
        source_path: path.into(),
        title: "Example title".into(),
        status: status.into(),
        alignment: "unaligned".into(),
        created_at: "2025-01-02T00:00:00Z".into(),
        purpose: "Some purpose".into(),
        background: "Some background".into(),
        decision: "Some decision".into(),
        tags: vec!["tag".into()],
        relations: vec![],
    };
    let index = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: digest.clone(),
                entries: BTreeMap::from([(ID.into(), digest)]),
            },
            entries: BTreeMap::from([(ID.into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    (text, index)
}

pub(in crate::mutations) fn two_record_index(a: &str, b: &str) -> ValidatedIndex<DecisionState> {
    let state_a =
        crate::domains::decision::parse_established(a.as_bytes(), "250102-a", "archive/a.md")
            .unwrap()
            .state;
    let state_b = crate::domains::decision::parse_established(b.as_bytes(), "250102-b", "b.md")
        .unwrap()
        .state;
    build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: crate::source_revision::metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::from([
                    (
                        "250102-a".into(),
                        fingerprint(Domain::Decision, "250102-a", "archive/a.md", a),
                    ),
                    (
                        "250102-b".into(),
                        fingerprint(Domain::Decision, "250102-b", "b.md", b),
                    ),
                ]),
            },
            entries: BTreeMap::from([("250102-a".into(), state_a), ("250102-b".into(), state_b)]),
        },
        &Definition,
    )
    .unwrap()
}
