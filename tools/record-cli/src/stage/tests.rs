use super::*;
use crate::index::{IndexV4, RelationGraph, Revision};
use std::collections::BTreeMap;

struct Definition;
impl crate::index::sealed::Sealed for Definition {}
impl DomainDefinition for Definition {
    type State = serde_json::Value;
    fn namespace(&self) -> &'static str {
        "fixture"
    }
    fn definition_version(&self) -> u32 {
        1
    }
    fn validate(&self, _: &mut IndexV4<Self::State>) -> Result<(), IndexError> {
        Ok(())
    }
    fn graph(&self, _: &IndexV4<Self::State>) -> Result<RelationGraph, IndexError> {
        Ok(RelationGraph {
            nodes: vec![],
            outgoing: BTreeMap::new(),
            incoming: BTreeMap::new(),
        })
    }
}
fn index(entries: &[(&str, &str)], metadata: &str) -> ValidatedIndex<serde_json::Value> {
    build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "fixture".into(),
            definition_version: 1,
            metadata: serde_json::json!({"value": metadata}),
            source_revision: Revision {
                metadata: "meta".into(),
                entries: entries
                    .iter()
                    .map(|(id, value)| ((*id).into(), (*value).into()))
                    .collect(),
            },
            entries: entries
                .iter()
                .map(|(id, value)| ((*id).into(), serde_json::json!(value)))
                .collect(),
        },
        &Definition,
    )
    .unwrap()
}
#[test]
fn compose_preserves_pending_unselected_and_refreshes_add_delete() {
    let p = index(&[("a", "p-a"), ("b", "p-b"), ("c", "p-c")], "same");
    let w = index(&[("a", "w-a"), ("c", "w-c"), ("d", "w-d")], "same");
    let bytes = compose_index(
        &Definition,
        StageScope::Index,
        IndexInputs {
            head: Some(&p),
            worktree: &w,
            pending: Some(&p),
        },
        &["a".into(), "b".into(), "d".into()],
    )
    .unwrap()
    .unwrap();
    let result = crate::index::parse_index(&bytes, &Definition).unwrap();
    assert_eq!(
        result.index().entries,
        BTreeMap::from([
            ("a".into(), serde_json::json!("w-a")),
            ("c".into(), serde_json::json!("p-c")),
            ("d".into(), serde_json::json!("w-d"))
        ])
    );
    assert_eq!(result.index().source_revision.entries["c"], "p-c");
}
#[test]
fn compose_rejects_collection_change_and_pending_deletion() {
    let h = index(&[("a", "h")], "head");
    let w = index(&[("a", "w")], "work");
    assert!(
        compose_index(
            &Definition,
            StageScope::All,
            IndexInputs {
                head: Some(&h),
                worktree: &w,
                pending: Some(&w)
            },
            &["a".into()]
        )
        .is_err()
    );
    assert!(
        compose_index(
            &Definition,
            StageScope::Index,
            IndexInputs {
                head: Some(&w),
                worktree: &w,
                pending: None
            },
            &["a".into()]
        )
        .is_err()
    );
    assert!(
        compose_index(
            &Definition,
            StageScope::Domain,
            IndexInputs {
                head: Some(&w),
                worktree: &w,
                pending: None
            },
            &["a".into()]
        )
        .unwrap()
        .is_none()
    );
}
