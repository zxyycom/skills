use super::*;

fn project_decision_identity(
    value: crate::mutations::identity::decision::PreparedIdentity,
    preflight: bool,
) -> serde_json::Value {
    let old_name = crate::domains::name_from_id(&value.old_id);
    let new_name = value.new_id.as_deref().map(crate::domains::name_from_id);
    let mut body = serde_json::json!({"preflight":preflight,"oldId":value.old_id,"newId":value.new_id,
        "oldPath":value.old_path,"newPath":value.new_path,"candidate":value.candidate,
        "affectedIds":value.affected_ids,"affectedRelationCount":value.affected_relation_count,"noChange":value.no_change});
    if new_name.is_some() {
        body["oldName"] = old_name.into();
        body["newName"] = serde_json::json!(new_name);
        body["oldSourcePath"] = body["oldPath"].clone();
        body["newSourcePath"] = body["newPath"].clone();
        body["affectedCandidateRelationCount"] = value.impact.candidate_relations.into();
        body["affectedEstablishedRelationCount"] = value.impact.established_relations.into();
        body["affectedCountsScope"] = "selected-and-rewritten".into();
        body["planOutcome"] = if preflight { "preflight" } else { "ready" }.into();
    }
    body
}

pub(super) fn output_decision_identity(
    context: ExecutionContext<'_>,
    operation: crate::mutations::identity::decision::DecisionIdentityOperation,
    preflight: bool,
) -> i32 {
    if preflight {
        decision_identity_preflight(context, operation)
    } else {
        decision_identity_commit(context, operation)
    }
}

fn decision_identity_preflight(
    context: ExecutionContext<'_>,
    mut operation: crate::mutations::identity::decision::DecisionIdentityOperation,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
        ..
    } = context;
    let preflight = true;
    let index_path = operation.index_path.clone();
    let index_display = index_path.as_path().to_string_lossy().replace('\\', "/");
    let project = |value| project_decision_identity(value, preflight);
    match crate::transaction::preflight(root, &mut operation) {
        Ok(plan) => {
            let paths = plan
                .writes
                .iter()
                .filter(|write| write.path != index_path)
                .map(|write| write.path.as_path().to_string_lossy().replace('\\', "/"))
                .collect::<Vec<_>>();
            let index_change = plan.writes.iter().any(|write| write.path == index_path);
            let mut body = project(plan.value);
            body["status"] = "ok".into();
            body["changed"] = false.into();
            body["outcome"] = "preflight".into();
            body["errors"] = serde_json::json!([]);
            body["indexPath"] = index_display.into();
            body["plannedSourcePaths"] = serde_json::json!(paths);
            body["plannedIndexChange"] = index_change.into();
            emit_success(command, json, false, &body, &[])
        }
        Err(error) => print_transaction_error(command, json, error),
    }
}

fn decision_identity_commit(
    context: ExecutionContext<'_>,
    mut operation: crate::mutations::identity::decision::DecisionIdentityOperation,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
    } = context;
    let preflight = false;
    let index_path = operation.index_path.clone();
    let project = |value| project_decision_identity(value, preflight);
    let mut result = crate::transaction::run_transaction(root, &mut operation);
    let (verified, mut body) = identity_transaction_body(
        &mut result,
        &index_path,
        |path| path != &index_path,
        project,
    );
    if verified {
        emit_success(command, json, false, &body, &[])
    } else {
        if let Some(plan) = result.planned_value.take() {
            body["plannedIdentity"] = project_decision_identity(plan, false);
        }
        print_transaction_failure(command, json, &result, body)
    }
}
