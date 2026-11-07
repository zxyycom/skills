use super::*;

pub(super) fn run(context: MutationContext<'_>, intent: DecisionCommand) -> i32 {
    match intent {
        DecisionCommand::Reactivate {
            selector,
            alignment,
            preflight,
        } => reactivate(context, selector, alignment, preflight),
        DecisionCommand::Archive {
            selectors,
            keep_unrecorded_history,
        } => archive(context, selectors, keep_unrecorded_history),
        DecisionCommand::MarkAligned { selector } => mark_aligned(context, selector),
        _ => unreachable!("only lifecycle commands are routed here"),
    }
}

fn reactivate(
    context: MutationContext<'_>,
    selector: String,
    alignment: crate::mutations::contract::Alignment,
    preflight: bool,
) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        collection,
        index_path,
        ..
    } = context;
    let mut operation = crate::mutations::decision::lifecycle::operation::ReactivateOperation {
        collection,
        index_path,
        selector,
        alignment,
    };
    if preflight {
        match crate::transaction::preflight(&root, &mut operation) {
            Ok(plan) => {
                let mut body = lifecycle_details(plan.value);
                body["preflight"] = true.into();
                body["changed"] = false.into();
                emit_success(command, json, false, &body, &[])
            }
            Err(error) => print_transaction_error(command, json, error),
        }
    } else {
        let result = crate::transaction::run_transaction(&root, &mut operation);
        output_transaction(command, json, result, lifecycle_details)
    }
}

fn archive(
    context: MutationContext<'_>,
    selectors: Vec<String>,
    keep_unrecorded_history: bool,
) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        collection,
        index_path,
        ..
    } = context;
    let mut operation = crate::mutations::decision::lifecycle::operation::ArchiveOperation {
        collection,
        index_path,
        selectors,
        keep_unrecorded_history,
    };
    let result = crate::transaction::run_transaction(&root, &mut operation);
    output_lifecycle_transaction(command, json, result, |prepared| {
        lifecycle_details(prepared.lifecycle)
    })
}

fn mark_aligned(context: MutationContext<'_>, selector: String) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        collection,
        index_path,
        ..
    } = context;
    let mut operation = crate::mutations::decision::lifecycle::operation::MarkAlignedOperation {
        collection,
        index_path,
        selector,
    };
    let result = crate::transaction::run_transaction(&root, &mut operation);
    output_lifecycle_transaction(command, json, result, lifecycle_details)
}

fn output_lifecycle_transaction<T>(
    command: &str,
    json: bool,
    mut result: crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> serde_json::Value,
) -> i32 {
    if result
        .errors
        .iter()
        .any(|diagnostic| diagnostic.target.is_some())
    {
        let (_, mut body) = transaction_body(&mut result, |_| serde_json::Value::Null);
        body["scope"] = "Decision Markdown files and derived decision index".into();
        if json {
            println!("{}", transaction_failure_envelope(command, &result, body));
        } else {
            show_selection_diagnostics(&result.errors);
        }
        return 1;
    }
    output_transaction(command, json, result, success)
}
