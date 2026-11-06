use super::*;

fn is_investigation_source(
    path: &crate::source::RelativePath,
    index: &crate::source::RelativePath,
    collection: &std::path::Path,
) -> bool {
    path != index
        && path
            .as_path()
            .strip_prefix(collection)
            .is_ok_and(|relative| {
                !relative
                    .components()
                    .any(|component| component.as_os_str() == "_resources")
            })
}

fn project_identity(
    value: crate::mutations::identity::investigation::PreparedIdentity,
    preflight: bool,
) -> serde_json::Value {
    let old_name = crate::domains::name_from_id(&value.old_id);
    let new_name = value.new_id.as_deref().map(crate::domains::name_from_id);
    let mut body = serde_json::json!({"preflight":preflight,"oldId":value.old_id,"newId":value.new_id,
        "oldPath":value.old_path,"newPath":value.new_path,"candidate":value.candidate,"affectedIds":value.affected_ids,
        "affectedRelationCount":value.affected_relation_count,"ownerMoved":value.owner_moved,"noChange":value.no_change});
    if new_name.is_some() {
        body["oldName"] = old_name.into();
        body["newName"] = serde_json::json!(new_name);
        body["oldSourcePath"] = body["oldPath"].clone();
        body["newSourcePath"] = body["newPath"].clone();
        body["affectedCandidateRelationCount"] = value.impact.candidate_relations.into();
        body["affectedEstablishedRelationCount"] = value.impact.established_relations.into();
        body["affectedResourceReferenceCount"] = value.impact.resource_references.into();
        body[if preflight {
            "plannedResourceOwnerMove"
        } else {
            "resourceOwnerMoved"
        }] = value.owner_moved.into();
        body["affectedCountsScope"] = "selected-and-rewritten".into();
        body["planOutcome"] = if preflight { "preflight" } else { "ready" }.into();
    } else {
        body["id"] = value.old_id.into();
        body[if preflight {
            "plannedDeletedResourceIds"
        } else {
            "deletedResourceIds"
        }] = serde_json::json!(value.deleted_resource_ids);
        body["requiresRecordedDeletionConfirmation"] = false.into();
    }
    body
}

fn project_planned_identity(
    plan: crate::mutations::identity::investigation::PreparedIdentity,
) -> serde_json::Value {
    let mut planned = project_identity(plan, false);
    if let Some(ids) = planned
        .as_object_mut()
        .and_then(|object| object.remove("deletedResourceIds"))
    {
        planned["plannedDeletedResourceIds"] = ids;
    }
    if let Some(moved) = planned
        .as_object_mut()
        .and_then(|object| object.remove("ownerMoved"))
    {
        planned["ownerMove"] = moved;
    }
    planned
}

pub(super) fn output_investigation_identity(
    context: ExecutionContext<'_>,
    operation: crate::mutations::identity::investigation::InvestigationIdentityOperation,
    preflight: bool,
) -> i32 {
    if preflight {
        investigation_identity_preflight(context, operation)
    } else {
        investigation_identity_commit(context, operation)
    }
}

fn investigation_identity_preflight(
    context: ExecutionContext<'_>,
    mut operation: crate::mutations::identity::investigation::InvestigationIdentityOperation,
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
    let collection = operation.collection.as_path().to_path_buf();
    let is_source = |path: &crate::source::RelativePath| {
        is_investigation_source(path, &index_path, &collection)
    };
    let project = |value| project_identity(value, preflight);
    match crate::transaction::preflight(root, &mut operation) {
        Ok(plan) => {
            let paths = plan
                .writes
                .iter()
                .filter(|write| is_source(&write.path))
                .map(|write| write.path.as_path().to_string_lossy().replace('\\', "/"))
                .collect::<Vec<_>>();
            let index_change = plan.writes.iter().any(|write| write.path == index_path);
            let mut body = project(plan.value);
            body["status"] = "ok".into();
            body["changed"] = false.into();
            body["outcome"] = "preflight".into();
            body["errors"] = serde_json::json!([]);
            body["indexPath"] = index_display.into();
            if let Some(moved) = body
                .as_object_mut()
                .and_then(|value| value.remove("ownerMoved"))
            {
                body["plannedOwnerMove"] = moved;
            }
            body["plannedSourcePaths"] = serde_json::json!(paths);
            body["plannedIndexChange"] = index_change.into();
            emit_success(command, json, false, &body, &[])
        }
        Err(error) => {
            let confirmation = error.code == "recorded-deletion-confirmation-required";
            let mut error = transaction_error(error);
            if confirmation {
                error = error
                    .with_partial(&serde_json::json!({"requiresRecordedDeletionConfirmation":true}))
                    .expect("confirmation result serializes");
            }
            print_error(command, json, error, 1)
        }
    }
}

fn investigation_identity_commit(
    context: ExecutionContext<'_>,
    mut operation: crate::mutations::identity::investigation::InvestigationIdentityOperation,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
        lock,
    } = context;
    let preflight = false;
    let index_path = operation.index_path.clone();
    let collection = operation.collection.as_path().to_path_buf();
    let is_source = |path: &crate::source::RelativePath| {
        is_investigation_source(path, &index_path, &collection)
    };
    let project = |value| project_identity(value, preflight);
    let mut result = crate::transaction::run_transaction(root, lock, &mut operation);
    let (verified, mut body) =
        identity_transaction_body(&mut result, &index_path, is_source, project);
    if verified {
        emit_success(command, json, false, &body, &[])
    } else {
        if result
            .errors
            .iter()
            .any(|error| error.code == "recorded-deletion-confirmation-required")
        {
            body["requiresRecordedDeletionConfirmation"] = true.into();
        }
        if let Some(plan) = result.planned_value.take() {
            body["plannedIdentity"] = project_planned_identity(plan);
        }
        print_transaction_failure(command, json, &result, body)
    }
}
