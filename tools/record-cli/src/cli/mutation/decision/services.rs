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
            &crate::domains::decision::Definition,
            &selectors,
            |state| &state.name,
        )
    } else {
        crate::stage::decision_scope::stage_decisions(&root, &index_path, &selectors, scope)
    };
    output_stage(
        StageOutput {
            command,
            json,
            domain: Domain::Decision,
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
        ..
    } = context;
    let mut operation =
        crate::mutations::sync::decision_selected_sync::SelectedDecisionSyncOperation::new(
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
                mutation_scope: "Derived decision index",
                report_count: None,
                failure_state: operation.observed_failure_state(),
                selected_ids: operation.observed_selected_ids(),
                index_path: "decision-index.json".into(),
                is_investigation: false,
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
                mutation_scope: "Derived decision index",
                report_count: None,
                failure_state: operation.observed_failure_state(),
                selected_ids: operation.observed_selected_ids(),
                index_path: "decision-index.json".into(),
                is_investigation: false,
            },
            result,
            |prepared, committed| {
                let sync = prepared.result(committed);
                (serde_json::json!(&sync), sync.warnings)
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
    let mut operation = crate::mutations::sync::decision_sync::DecisionSyncOperation { directory };
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
                (serde_json::json!(&sync), sync.warnings)
            },
        )
    }
}

pub(super) fn evolution(context: MutationContext<'_>, intent: DecisionCommand) -> i32 {
    use crate::mutations::authoring::decision::DecisionEvolutionOperation;
    use crate::mutations::contract::{DecisionRelationOverride, Successor};
    let (operation, preflight) = match intent {
        DecisionCommand::Publish {
            selector,
            alignment,
            keep_unrecorded_history,
            preflight,
        } => (
            DecisionEvolutionOperation {
                collection: context.collection.clone(),
                successors: vec![Successor {
                    selector,
                    alignment,
                }],
                relations: DecisionRelationOverride::Preserve,
                discard: None,
                delete_recorded: false,
                keep_unrecorded_history,
                publish_only: true,
                timestamp: captured_utc(),
            },
            preflight,
        ),
        DecisionCommand::Evolve {
            successors,
            discard,
            relations,
            delete_recorded,
            keep_unrecorded_history,
            preflight,
        } => (
            DecisionEvolutionOperation {
                collection: context.collection.clone(),
                successors,
                relations,
                discard,
                delete_recorded,
                keep_unrecorded_history,
                publish_only: false,
                timestamp: captured_utc(),
            },
            preflight,
        ),
        _ => unreachable!("only evolution commands are routed here"),
    };
    let MutationContext {
        command,
        json,
        root,
        ..
    } = context;
    output_evolution(
        ExecutionContext {
            command,
            json,
            root: &root,
        },
        operation,
        preflight,
    )
}

pub(super) fn identity(context: MutationContext<'_>, intent: DecisionCommand) -> i32 {
    let (selector, action, preflight) = match intent {
        DecisionCommand::Rename {
            source,
            target,
            rename_recorded,
            preflight,
        } => (
            source,
            crate::mutations::identity::decision::Action::Rename {
                target,
                confirm_recorded: preflight || rename_recorded,
            },
            preflight,
        ),
        DecisionCommand::Discard {
            selector,
            delete_recorded,
        } => (
            selector,
            crate::mutations::identity::decision::Action::Discard {
                confirm_recorded: delete_recorded,
            },
            false,
        ),
        _ => unreachable!("only identity commands are routed here"),
    };
    let MutationContext {
        command,
        json,
        root,
        collection,
        index_path,
        ..
    } = context;
    let operation = crate::mutations::identity::decision::DecisionIdentityOperation {
        collection,
        index_path,
        selector,
        action,
    };
    output_decision_identity(
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
        crate::mutations::contract::RelationGroup<crate::mutations::contract::DecisionRelationKind>,
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
    let mut operation = crate::mutations::decision_relations::DecisionRelationsOperation {
        collection,
        index_path,
        groups,
    };
    if preflight {
        match crate::transaction::preflight(&root, &mut operation) {
            Ok(plan) => {
                let review =
                    crate::mutations::relations::review(plan.value.review, ReviewPhase::Preflight);
                let source_ids: Vec<_> =
                    review.sources.iter().map(|s| s.source_id.clone()).collect();
                let body = serde_json::json!({"preflight":true,"changed":false,"indexPath":index_display,"sourceIds":source_ids,"relationReview":review});
                emit_success(command, json, false, &body, &[])
            }
            Err(error) => print_transaction_error(command, json, error),
        }
    } else {
        let result = crate::transaction::run_transaction(&root, &mut operation);
        output_transaction(command, json, result, |prepared| {
            let review =
                crate::mutations::relations::review(prepared.review, ReviewPhase::Prepared);
            let source_ids: Vec<_> = review.sources.iter().map(|s| s.source_id.clone()).collect();
            serde_json::json!({"preflight":false,"indexPath":index_display,"sourceIds":source_ids,"relationReview":review})
        })
    }
}
