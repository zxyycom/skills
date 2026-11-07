use super::*;
#[test]
fn allocates_canonical_domain_paths_and_rejects_conflicts() {
    let id = CandidateIdentity {
        id: "261106-example".into(),
    };
    let mut ids = HashSet::new();
    let mut paths = HashSet::new();
    assert_eq!(
        plan_creation(Domain::Decision, &id, &ids, &paths)
            .unwrap()
            .source_path,
        "261106-example.md"
    );
    let ir = plan_creation(Domain::Investigation, &id, &ids, &paths).unwrap();
    assert_eq!(ir.source_path, "_candidate.261106-example");
    paths.insert(ir.source_path.clone());
    assert_eq!(
        plan_creation(Domain::Investigation, &id, &ids, &paths),
        Err(CandidatePlanError::PathConflict(ir.source_path))
    );
    ids.insert(id.id.clone());
    assert_eq!(
        plan_creation(Domain::Decision, &id, &ids, &paths),
        Err(CandidatePlanError::IdentityConflict(id.id))
    );
}

#[test]
fn identity_keeps_kebab_boundaries() {
    for (id, valid) in [
        ("a-12", true),
        ("", false),
        ("-a", false),
        ("a-", false),
        ("a--b", false),
        ("A", false),
        ("é", false),
    ] {
        let result = plan_creation(
            Domain::Decision,
            &CandidateIdentity { id: id.into() },
            &HashSet::new(),
            &HashSet::new(),
        );
        assert_eq!(result.is_ok(), valid, "{id}");
    }
}
