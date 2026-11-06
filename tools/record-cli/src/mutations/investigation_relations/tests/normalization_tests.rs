use super::*;
#[test]
fn orders_resolved_relations_and_normalizes_summary() {
    let input = vec![
        Relation {
            kind: InvestigationRelationKind::Split,
            target: "z".into(),
            summary: Some("   ".into()),
        },
        Relation {
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
