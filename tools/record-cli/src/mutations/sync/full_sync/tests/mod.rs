use super::*;
use crate::domains::decision::{DecisionState, Definition};
use crate::index::{IndexV4, Revision, build_index};
use std::collections::BTreeMap;
#[test]
fn missing_invalid_equal_and_preview_are_distinct_without_claiming_writes() {
    let hash = format!("sha256:{}", "a".repeat(64));
    let index = build_index(
        IndexV4::<DecisionState> {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: hash,
                entries: BTreeMap::new(),
            },
            entries: BTreeMap::new(),
        },
        &Definition,
    )
    .unwrap();
    assert!(matches!(
        compare(&index, &Definition, None, Mode::Check),
        Err(ComparisonError::Missing)
    ));
    assert!(matches!(
        compare(&index, &Definition, Some(b"bad"), Mode::Check),
        Err(ComparisonError::Invalid(_))
    ));
    assert_eq!(
        compare(&index, &Definition, None, Mode::Preview).unwrap(),
        Disposition::Previewed
    );
    let bytes = match compare(&index, &Definition, None, Mode::Write).unwrap() {
        Disposition::NeedsWrite(bytes) => bytes,
        other => panic!("unexpected {other:?}"),
    };
    assert_eq!(
        compare(&index, &Definition, Some(&bytes), Mode::Check).unwrap(),
        Disposition::Current
    );
    let crlf = String::from_utf8(bytes).unwrap().replace('\n', "\r\n");
    assert_eq!(
        compare(&index, &Definition, Some(crlf.as_bytes()), Mode::Write).unwrap(),
        Disposition::Unchanged
    );
}
