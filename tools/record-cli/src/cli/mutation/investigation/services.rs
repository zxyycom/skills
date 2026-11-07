use super::*;

pub(super) fn stage(
    context: MutationContext<'_>,
    selectors: Vec<String>,
    scope: crate::stage::StageScope,
) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        index_path,
        index_display,
        ..
    } = context;
    let result = if scope == crate::stage::StageScope::Index {
        crate::stage::index_scope::stage_index(
            &root,
            &index_path,
            &crate::domains::investigation::Definition,
            &selectors,
            |state| &state.name,
        )
    } else {
        crate::stage::investigation_scope::stage_investigations(
            &root,
            &index_path,
            &selectors,
            scope,
        )
    };
    output_stage(
        StageOutput {
            command,
            json,
            domain: Domain::Investigation,
            index_path: &index_path,
            index_display: &index_display,
            scope,
        },
        result,
    )
}

pub(super) fn sync_index(
    context: MutationContext<'_>,
    selectors: Vec<String>,
    preflight: bool,
) -> i32 {
    if selectors.is_empty() {
        sync_all(context, preflight)
    } else {
        sync_selected(context, selectors, preflight)
    }
}

fn sync_selected(context: MutationContext<'_>, selectors: Vec<String>, preflight: bool) -> i32 {
    let MutationContext {
        command,
        json,
        directory,
        root,
        index_display,
        ..
    } = context;
    let mut operation =
        crate::mutations::sync::investigation_selected_sync::SelectedInvestigationSyncOperation::new(
            directory,
            selectors.clone(),
        );
    if preflight {
        let result = operation.preflight(&root);
        emit_selected_sync_preflight(
            command,
            json,
            SelectedSyncContext {
                selectors: &selectors,
                mutation_scope: "investigation report index collection",
                report_count: operation.observed_baseline_count(),
                failure_state: operation.observed_failure_state(),
                selected_ids: operation.observed_selected_ids(),
                index_path: index_display.clone(),
                is_investigation: true,
            },
            result,
            |result| &result.warnings,
        )
    } else {
        let result = crate::transaction::run_transaction(&root, &mut operation);
        output_selected_sync_transaction(
            command,
            json,
            SelectedSyncContext {
                selectors: &selectors,
                mutation_scope: "investigation report index collection",
                report_count: operation.observed_baseline_count(),
                failure_state: operation.observed_failure_state(),
                selected_ids: operation.observed_selected_ids(),
                index_path: index_display.clone(),
                is_investigation: true,
            },
            result,
            |prepared, committed| {
                let sync = prepared.result(committed);
                (
                    serde_json::to_value(&sync).expect("typed sync result must serialize"),
                    sync.warnings,
                )
            },
        )
    }
}

fn sync_all(context: MutationContext<'_>, preflight: bool) -> i32 {
    let MutationContext {
        command,
        json,
        directory,
        root,
        ..
    } = context;
    let mut operation =
        crate::mutations::sync::investigation_sync::InvestigationSyncOperation { directory };
    if preflight {
        emit_sync_preflight(command, json, operation.preflight(&root), |result| {
            &result.warnings
        })
    } else {
        run_sync_transaction(
            ExecutionContext {
                command,
                json,
                root: &root,
            },
            &mut operation,
            |prepared, committed| {
                let sync = prepared.result(committed);
                (
                    serde_json::to_value(&sync).expect("typed sync result must serialize"),
                    sync.warnings,
                )
            },
        )
    }
}

pub(super) fn publish(
    context: MutationContext<'_>,
    selectors: Vec<String>,
    preflight: bool,
) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        collection,
        ..
    } = context;
    let mut operation =
        crate::mutations::authoring::investigation_publish::InvestigationPublishOperation {
            collection,
            selectors,
        };
    if preflight {
        match crate::transaction::preflight(&root, &mut operation) {
            Ok(plan) => {
                let review =
                    crate::mutations::relations::review(plan.value.review, ReviewPhase::Preflight);
                let body = serde_json::json!({"preflight":true,"changed":false,"publishedIds":plan.value.ids,"relationReview":review,"warnings":plan.value.warnings});
                emit_success(command, json, false, &body, &plan.value.warnings)
            }
            Err(error) => print_transaction_error(command, json, error),
        }
    } else {
        let result = crate::transaction::run_transaction(&root, &mut operation);
        output_transaction_warnings(command, json, result, |prepared| {
            let review =
                crate::mutations::relations::review(prepared.review, ReviewPhase::Prepared);
            (
                serde_json::json!({"preflight":false,"publishedIds":prepared.ids,"relationReview":review,"warnings":prepared.warnings}),
                prepared.warnings,
            )
        })
    }
}

struct IdentityRequest {
    selector: String,
    action: crate::mutations::identity::investigation::Action,
    preflight: bool,
}

fn identity_request(intent: InvestigationCommand) -> IdentityRequest {
    let (selector, action, preflight) = match intent {
        InvestigationCommand::Rename {
            source,
            target,
            rename_recorded_report,
            rename_recorded_candidate,
            preflight,
        } => (
            source,
            crate::mutations::identity::investigation::Action::Rename {
                target,
                confirm_recorded_report: preflight || rename_recorded_report,
                confirm_recorded_candidate: preflight || rename_recorded_candidate,
            },
            preflight,
        ),
        InvestigationCommand::Discard {
            selector,
            delete_recorded,
            delete_owned_resources,
        } => (
            selector,
            crate::mutations::identity::investigation::Action::Discard {
                confirm_recorded: delete_recorded,
                delete_owned_resources,
            },
            false,
        ),
        _ => unreachable!("only identity commands are routed here"),
    };
    IdentityRequest {
        selector,
        action,
        preflight,
    }
}

pub(super) fn identity(context: MutationContext<'_>, intent: InvestigationCommand) -> i32 {
    let IdentityRequest {
        selector,
        action,
        preflight,
    } = identity_request(intent);
    let MutationContext {
        command,
        json,
        root,
        collection,
        index_path,
        ..
    } = context;
    let operation = crate::mutations::identity::investigation::InvestigationIdentityOperation {
        collection,
        index_path,
        selector,
        action,
    };
    output_investigation_identity(
        ExecutionContext {
            command,
            json,
            root: &root,
        },
        operation,
        preflight,
    )
}

pub(super) fn set_relations(
    context: MutationContext<'_>,
    groups: Vec<
        crate::mutations::contract::RelationGroup<
            crate::mutations::contract::InvestigationRelationKind,
        >,
    >,
    preflight: bool,
) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        collection,
        index_path,
        index_display,
        ..
    } = context;
    let mut operation = crate::mutations::investigation_operation::SetRelationsOperation {
        collection,
        index_path,
        groups,
    };
    if preflight {
        match crate::transaction::preflight(&root, &mut operation) {
            Ok(plan) => {
                let review =
                    crate::mutations::relations::review(plan.value.review, ReviewPhase::Preflight);
                let source_ids: Vec<_> = review
                    .sources
                    .iter()
                    .map(|source| source.source_id.clone())
                    .collect();
                let value = serde_json::json!({"preflight":true,"changed":false,"indexPath":index_display,"sourceIds":source_ids,"errors":[],"relationReview":review});
                emit_success(command, json, false, &value, &[])
            }
            Err(error) => print_transaction_error(command, json, error),
        }
    } else {
        let result = crate::transaction::run_transaction(&root, &mut operation);
        output_transaction(command, json, result, |prepared| {
            let review =
                crate::mutations::relations::review(prepared.review, ReviewPhase::Prepared);
            let source_ids: Vec<_> = review
                .sources
                .iter()
                .map(|source| source.source_id.clone())
                .collect();
            serde_json::json!({"preflight":false,"indexPath":index_display,"sourceIds":source_ids,"relationReview":review})
        })
    }
}
