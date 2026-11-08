use super::*;
#[test]
fn changes_only_selected_relation_and_validates_before() {
    let text = "---\ntitle: \"Example title\"\nid: \"260828-same\"\nformedAt: \"2026-08-28T12:00:00+00:00\"\nquestion: \"Example question?\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\nBody unchanged.\n";
    let review = SourceReview {
        source_id: "260828-same".into(),
        action: ReviewAction::Replace,
        before: vec![],
        after: vec![Relation {
            summary_selector: None,
            kind: InvestigationRelationKind::Supplement,
            target: "260827-old".into(),
            summary: None,
        }],
    };
    let sources = HashMap::from([("260828-same".into(), text.as_bytes().to_vec())]);
    let edits = render_replacements(std::slice::from_ref(&review), &sources).unwrap();
    let output = std::str::from_utf8(&edits[0].after).unwrap();
    assert!(output.contains("  - type: \"补充\"\n    target: \"260827-old\""));
    assert!(output.ends_with("\nBody unchanged.\n"));
    let mut stale = review;
    stale.before = stale.after.clone();
    stale.after.clear();
    assert_eq!(
        render_replacements(&[stale], &sources),
        Err(RenderError::SourceRelationsChanged("260828-same".into()))
    );
}
