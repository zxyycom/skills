use super::*;
use crate::domains::investigation::{Definition, InvestigationState};
use crate::index::{IndexV4, Revision, build_index};
use std::collections::BTreeMap;

#[test]
fn unchanged_preparation_rechecks_source_and_keeps_index_projection() {
    let text = "---\ntitle: \"Example title\"\nid: \"260828-same\"\nformedAt: \"2026-08-28T12:00:00+00:00\"\nquestion: \"Example question?\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\nBody unchanged.\n";
    let id = "260828-same";
    let state = InvestigationState {
        formed_at: "2026-08-28T12:00:00+00:00".into(),
        name: "same".into(),
        question: "Example question?".into(),
        relations: vec![],
        resource_ids: vec![],
        source_path: "same.md".into(),
        tags: vec!["tag".into()],
        title: "Example title".into(),
    };
    let hash = crate::source_revision::fingerprint(
        crate::source_revision::Domain::Investigation,
        id,
        "same.md",
        text,
    );
    let baseline = build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "investigations".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: hash.clone(),
                entries: BTreeMap::from([(id.into(), hash.clone())]),
            },
            entries: BTreeMap::from([(id.into(), state.clone())]),
        },
        &Definition,
    )
    .unwrap();
    let review = vec![SourceReview {
        source_id: id.into(),
        action: ReviewAction::Unchanged,
        before: vec![],
        after: vec![],
    }];
    let sources = HashMap::from([(id.into(), text.as_bytes().to_vec())]);
    let prepared = prepare_replacements(&baseline, &review, &sources).unwrap();
    assert!(prepared.edits.is_empty());
    assert_eq!(prepared.index.index().entries[id], state);
    let stale_sources = HashMap::from([(id.into(), format!("{text}changed").into_bytes())]);
    assert!(matches!(
        prepare_replacements(&baseline, &review, &stale_sources),
        Err(PreparationError::StaleSource(_))
    ));
}
