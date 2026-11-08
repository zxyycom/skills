use super::*;
#[test]
fn orders_resolved_relations_and_normalizes_summary() {
    let input = vec![
        Relation {
            summary_selector: None,
            kind: InvestigationRelationKind::Split,
            target: "z".into(),
            summary: Some("   ".into()),
        },
        Relation {
            summary_selector: None,
            kind: InvestigationRelationKind::Supplement,
            target: "a".into(),
            summary: Some("  reason  ".into()),
        },
    ];
    let result = normalize_relations(&input).unwrap();
    assert_eq!(result[0].target, "a");
    assert_eq!(result[0].summary.as_deref(), Some("reason"));
    assert_eq!(result[1].summary, None);
    assert!(matches!(
        normalize_relations(&[input[0].clone(), input[0].clone()]),
        Err(NormalizeError::DuplicateTarget(_))
    ));
}

#[test]
fn summary_trims_whitespace_and_rejects_internal_newlines_and_overlength() {
    let relation = |summary: String| Relation {
        summary_selector: None,
        kind: InvestigationRelationKind::Supplement,
        target: "a".into(),
        summary: Some(summary),
    };
    let result = normalize_relations(&[relation("\u{feff}\u{2003}reason\u{a0}".into())]).unwrap();
    assert_eq!(result[0].summary.as_deref(), Some("reason"));
    assert!(normalize_relations(&[relation("x".repeat(40))]).is_ok());
    let non_bmp = "😀".repeat(40);
    assert_eq!(
        normalize_relations(&[relation(format!("  {non_bmp}  "))]).unwrap()[0]
            .summary
            .as_deref(),
        Some(non_bmp.as_str())
    );
    assert!(matches!(
        normalize_relations(&[relation("😀".repeat(41))]),
        Err(NormalizeError::InvalidSummary(_))
    ));
    assert_eq!(
        normalize_relations(&[relation("\n  ".into())]).unwrap()[0].summary,
        None
    );
    assert_eq!(
        normalize_relations(&[relation("\rreason\n".into())]).unwrap()[0]
            .summary
            .as_deref(),
        Some("reason")
    );
    for summary in ["x".repeat(41), "one\ntwo".into()] {
        assert!(matches!(
            normalize_relations(&[relation(summary)]),
            Err(NormalizeError::InvalidSummary(_))
        ));
    }
}
