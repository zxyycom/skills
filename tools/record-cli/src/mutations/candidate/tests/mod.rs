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
