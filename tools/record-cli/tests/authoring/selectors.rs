use super::*;

#[test]
fn publication_selector_normalizes_suffix_and_preserves_ambiguity() {
    use record_cli::{
        mutations::authoring::investigation_publish::InvestigationPublishOperation,
        transaction::preflight,
    };
    let fixture = tempfile::tempdir().unwrap();
    let dir = fixture.path().join("reports");
    std::fs::create_dir(&dir).unwrap();
    let first = ready_report("261106-foo", "relations: []", "");
    let second = first
        .replace("261106-foo", "261105-foo")
        .replace("2026-11-06", "2026-11-05");
    std::fs::write(dir.join("_candidate.261106-foo"), &first).unwrap();
    std::fs::write(dir.join("_candidate.261105-foo"), &second).unwrap();
    let root = open_root(fixture.path()).unwrap();
    let mut op = InvestigationPublishOperation {
        collection: RelativePath::new("reports").unwrap(),
        selectors: vec!["foo.md".into()],
    };
    assert!(preflight(&root, &mut op).is_err());
    op.selectors = vec!["261106-foo.MD".into()];
    assert_eq!(
        preflight(&root, &mut op).unwrap().value.ids,
        vec!["261106-foo"]
    );
    std::fs::remove_file(dir.join("_candidate.261105-foo")).unwrap();
    for selector in ["foo.md", "foo.MD", "261106-foo.md"] {
        op.selectors = vec![selector.into()];
        assert_eq!(
            preflight(&root, &mut op).unwrap().value.ids,
            vec!["261106-foo"],
            "{selector}"
        );
    }
}
fn input_with_relations(decision_domain: bool, targets: &[&str]) -> NewInput {
    use record_cli::mutations::contract::{
        DecisionRelationKind, InvestigationRelationKind, Relation,
    };
    if decision_domain {
        let mut input = decision();
        if let NewInput::Decision { relations, .. } = &mut input {
            *relations = targets
                .iter()
                .map(|target| Relation {
                    kind: DecisionRelationKind::Revision,
                    target: (*target).into(),
                    summary: None,
                })
                .collect();
        }
        input
    } else {
        NewInput::Investigation {
            title: "Investigation title".into(),
            question: "A real question?".into(),
            tags: vec!["test".into()],
            relations: targets
                .iter()
                .map(|target| Relation {
                    kind: InvestigationRelationKind::Supplement,
                    target: (*target).into(),
                    summary: None,
                })
                .collect(),
            formed_at: None,
        }
    }
}

#[test]
fn new_relation_selectors_normalize_suffix_and_reject_ambiguous_names() {
    use record_cli::domains;
    for decision_domain in [true, false] {
        let fixture = tempfile::tempdir().unwrap();
        let dir = fixture.path().join("records");
        std::fs::create_dir(&dir).unwrap();
        let root = open_root(fixture.path()).unwrap();
        let lock = RelativePath::new(".lock").unwrap();
        let input = || input_with_relations(decision_domain, &[]);
        let create = |selector: &str, day: &str, input: NewInput| {
            let mut op = NewOperation::at(
                RelativePath::new("records").unwrap(),
                selector.into(),
                input,
                day.into(),
            )
            .unwrap();
            run_transaction(&root, &lock, &mut op)
        };
        assert_eq!(
            create("foo", "2026-11-06T12:00:00Z", input()).status,
            TxStatus::Ok
        );
        let rel = input_with_relations(decision_domain, &["foo.mD", "261231-future.MD"]);
        let result = create("new", "2026-11-06T12:00:00Z", rel);
        assert_eq!(result.status, TxStatus::Ok, "{:?}", result.errors);
        let path = if decision_domain {
            "261106-new.md"
        } else {
            "_candidate.261106-new"
        };
        let bytes = std::fs::read(dir.join(path)).unwrap();
        let relations = if decision_domain {
            domains::decision::parse_frontmatter(&bytes, "261106-new")
                .unwrap()
                .relations
        } else {
            domains::investigation::parse_frontmatter(&bytes, "261106-new")
                .unwrap()
                .relations
        };
        assert!(relations.iter().any(|r| r.target == "261106-foo"));
        assert!(relations.iter().any(|r| r.target == "261231-future"));
        let (original, legacy) = if decision_domain {
            ("261106-foo.md", "legacy.md")
        } else {
            ("_candidate.261106-foo", "_candidate.legacy")
        };
        let legacy_text = std::fs::read_to_string(dir.join(original))
            .unwrap()
            .replace("261106-foo", "foo");
        std::fs::write(dir.join(legacy), legacy_text).unwrap();
        let legacy_ambiguous = input_with_relations(decision_domain, &["foo.MD"]);
        let legacy_result = create("legacy-ambiguous", "2026-11-06T12:00:00Z", legacy_ambiguous);
        assert_eq!(legacy_result.status, TxStatus::Error);
        assert!(!legacy_result.changed);
        std::fs::remove_file(dir.join(legacy)).unwrap();
        assert_eq!(
            create("foo", "2026-11-05T12:00:00Z", input()).status,
            TxStatus::Ok
        );
        let ambiguous = input_with_relations(decision_domain, &["foo.MD"]);
        let result = create("ambiguous", "2026-11-06T12:00:00Z", ambiguous);
        assert_eq!(result.status, TxStatus::Error);
        assert!(!result.changed);
    }
}
