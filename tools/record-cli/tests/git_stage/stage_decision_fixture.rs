pub(super) fn dr_index_for(docs: &[(&str, &str, &str)]) -> Vec<u8> {
    use record_cli::{
        domains::decision::{self, Definition},
        index::{self, IndexV4, Revision},
        source_revision::{self, Domain},
    };
    use std::collections::BTreeMap;
    let mut entries = BTreeMap::new();
    let mut revisions = BTreeMap::new();
    for &(id, path, text) in docs {
        entries.insert(
            id.into(),
            decision::parse_established(text.as_bytes(), id, path)
                .unwrap()
                .state,
        );
        revisions.insert(
            id.into(),
            source_revision::fingerprint(Domain::Decision, id, path, text),
        );
    }
    let index = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: revisions,
            },
            entries,
        },
        &Definition,
    )
    .unwrap();
    index::serialize_index(&index, &Definition).unwrap()
}
