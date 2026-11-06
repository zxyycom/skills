use super::*;
#[test]
fn event_budget_does_not_admit_partial_event() {
    let unit = Unit {
        group: Arc::new(EventGroup {
            kind: Kind::Split,
            record_ids: vec!["b".into(), "c".into()],
        }),
        trace_ids: vec!["b".into()],
    };
    let result = select(
        "a",
        RequestedDirection::Predecessors,
        SelectionLimits {
            depth: None,
            max_records: 2,
        },
        |id, _| {
            if id == "a" {
                vec![unit.clone()]
            } else {
                vec![]
            }
        },
        |id, _| if id == "a" { vec!["b".into()] } else { vec![] },
    );
    assert_eq!(result.trace_ids, ["a"]);
    assert!(result.context_ids.is_empty());
    assert_eq!(result.blocked_event.unwrap().required_max_records, 3);
    assert_eq!(result.frontier[0].next_ids, ["b"]);
    assert_eq!(result.stopped_by, [Reason::MaxRecords]);
}
#[test]
fn context_can_be_promoted_and_depth_boundary_is_reported() {
    let result = select(
        "a",
        RequestedDirection::Predecessors,
        SelectionLimits {
            depth: Some(1),
            max_records: 4,
        },
        |id, _| {
            if id == "a" {
                vec![
                    Unit {
                        group: Arc::new(EventGroup {
                            kind: Kind::Split,
                            record_ids: vec!["b".into(), "c".into()],
                        }),
                        trace_ids: vec!["b".into()],
                    },
                    Unit {
                        group: Arc::new(EventGroup {
                            kind: Kind::Ordinary,
                            record_ids: vec!["c".into()],
                        }),
                        trace_ids: vec!["c".into()],
                    },
                ]
            } else {
                vec![]
            }
        },
        |id, _| if id == "c" { vec!["d".into()] } else { vec![] },
    );
    assert_eq!(result.trace_ids, ["a", "b", "c"]);
    assert!(result.context_ids.is_empty());
    assert_eq!(result.frontier[0].from_id, "c");
    assert_eq!(result.stopped_by, [Reason::Depth]);
}
#[test]
fn order_is_utf16_not_unicode_scalar_order() {
    assert_eq!(compare_text("𐀀", "\u{e000}"), Ordering::Less);
}
