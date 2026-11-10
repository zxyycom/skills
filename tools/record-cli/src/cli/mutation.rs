use super::*;
use crate::mutations::contract::{DecisionCommand, InvestigationCommand, ReviewPhase};

mod decision;
mod investigation;

struct MutationContext<'a> {
    command: &'a str,
    json: bool,
    directory: String,
    root: crate::source::Root,
    collection: crate::source::RelativePath,
    index_path: crate::source::RelativePath,
    index_display: String,
}

fn unsupported_mutation(context: MutationContext<'_>) -> i32 {
    print_error(
        context.command,
        context.json,
        crate::protocol::CommandError::new(
            "not-implemented",
            "mutation is not implemented and no files were written",
        ),
        1,
    )
}

fn emit_sync_preflight<T: serde::Serialize>(
    command: &str,
    json: bool,
    result: Result<T, crate::transaction::TxError>,
    warnings: impl Fn(&T) -> &[String],
) -> i32 {
    match result {
        Ok(result) => emit_success(command, json, false, &result, warnings(&result)),
        Err(error) => print_transaction_error(command, json, error),
    }
}

fn selected_failure_state(diagnostics: &[crate::protocol::Diagnostic]) -> Option<&'static str> {
    if diagnostics
        .iter()
        .any(|item| item.code.contains(".selector-"))
    {
        Some("selection-invalid")
    } else if diagnostics
        .iter()
        .any(|item| item.code == "investigation-report.selected-sync-invalid")
    {
        Some("source-invalid")
    } else if diagnostics.iter().any(|item| {
        matches!(
            item.code.as_str(),
            "decision-records.sync-index-failed"
                | "state-index.selected-baseline-invalid"
                | "state-index.index-write-failed"
        )
    }) {
        Some("selected-baseline-invalid")
    } else {
        None
    }
}

struct SelectedSyncContext<'a> {
    selectors: &'a [String],
    mutation_scope: &'static str,
    report_count: Option<usize>,
    failure_state: &'static str,
    selected_ids: Vec<String>,
    index_path: String,
    is_investigation: bool,
}

fn selected_failure_body(
    context: &SelectedSyncContext<'_>,
    outcome: &str,
    state: Option<&str>,
) -> serde_json::Value {
    let mut result = serde_json::json!({"scope":"selected", "selectors":context.selectors, "selectedIds":context.selected_ids, "mutation":{"scope":context.mutation_scope, "outcome":outcome}});
    if let Some(state) = state {
        result["state"] = state.into();
    }
    if context.is_investigation {
        result["indexPath"] = context.index_path.clone().into();
    } else {
        result["indexRelativePath"] = context.index_path.clone().into();
    }
    if let Some(count) = context.report_count {
        result["reportCount"] = count.into();
    }
    result
}

fn show_selection_diagnostics(diagnostics: &[crate::protocol::Diagnostic]) {
    for item in diagnostics {
        eprintln!("{}: {}", item.code, item.message);
        if let Some(target) = &item.target {
            eprintln!("  target: {target}");
        }
        if let Some(recovery) = &item.recovery {
            eprintln!("  recovery: {recovery}");
        }
    }
}

fn emit_selected_sync_preflight<T: serde::Serialize>(
    command: &str,
    json: bool,
    selection: SelectedSyncContext<'_>,
    result: Result<T, crate::transaction::TxError>,
    warnings: impl Fn(&T) -> &[String],
) -> i32 {
    match result {
        Err(error) if selected_failure_state(&error.diagnostics).is_some() => {
            if json {
                let state = selection.failure_state;
                let mut body = selected_failure_body(&selection, "no-change", Some(state));
                body["changed"] = false.into();
                body["changedIds"] = serde_json::json!([]);
                body["errors"] = error
                    .diagnostics
                    .iter()
                    .map(|item| item.reason.as_deref().unwrap_or(&item.message))
                    .collect::<Vec<_>>()
                    .into();
                println!(
                    "{}",
                    serde_json::json!({"version":2, "command":command, "ok":false, "error":{"code":error.code,"message":error.message}, "diagnostics":error.diagnostics, "result":body})
                );
            } else {
                show_selection_diagnostics(&error.diagnostics);
            }
            1
        }
        other => emit_sync_preflight(command, json, other, warnings),
    }
}

fn output_selected_sync_transaction<T>(
    command: &str,
    json: bool,
    selection: SelectedSyncContext<'_>,
    mut result: crate::transaction::TransactionOutcome<T>,
    project: impl FnOnce(T, bool) -> (serde_json::Value, Vec<String>),
) -> i32 {
    if result.status != crate::transaction::TxStatus::Ok {
        return output_selected_sync_failure(command, json, selection, &mut result);
    }
    let committed = result.committed;
    output_transaction_warnings(command, json, result, |prepared| {
        project(prepared, committed)
    })
}

fn output_selected_sync_failure<T>(
    command: &str,
    json: bool,
    selection: SelectedSyncContext<'_>,
    result: &mut crate::transaction::TransactionOutcome<T>,
) -> i32 {
    let structured = selected_failure_state(&result.errors).is_some();
    let state = structured.then_some(selection.failure_state);
    for diagnostic in result.errors.iter_mut() {
        if diagnostic.reason.is_none() {
            diagnostic.reason = Some(diagnostic.message.clone());
        }
        if diagnostic.recovery.is_none() {
            diagnostic.recovery = Some("Inspect the actual index, sources, and reported paths before deciding whether to retry.".into());
        }
    }
    let (_, mut body) = transaction_body(result, |_| serde_json::Value::Null);
    let outcome = if result.changed || !result.unknown_paths.is_empty() {
        "partial-or-unknown"
    } else {
        "no-change"
    };
    let mut selected = selected_failure_body(&selection, outcome, state);
    if !result.changed && result.unknown_paths.is_empty() {
        selected["changedIds"] = serde_json::json!([]);
    }
    if let (Some(body), Some(selection)) = (body.as_object_mut(), selected.as_object()) {
        body.extend(selection.clone());
    }
    if json {
        println!("{}", transaction_failure_envelope(command, result, body));
    } else {
        show_selection_diagnostics(&result.errors);
    }
    1
}

fn run_sync_transaction<T, O: crate::transaction::TransactionOperation<T>>(
    context: ExecutionContext<'_>,
    operation: &mut O,
    project: impl FnOnce(T, bool) -> (serde_json::Value, Vec<String>),
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
    } = context;
    let result = crate::transaction::run_transaction(root, operation);
    let committed = result.committed;
    output_transaction_warnings(command, json, result, |prepared| {
        project(prepared, committed)
    })
}

fn author_new(
    context: MutationContext<'_>,
    selector: String,
    input: crate::mutations::authoring::NewInput,
    preview: Option<crate::mutations::contract::Alignment>,
) -> i32 {
    let MutationContext {
        command,
        json,
        root,
        collection,
        ..
    } = context;
    output_new(
        ExecutionContext {
            command,
            json,
            root: &root,
        },
        collection,
        selector,
        input,
        preview,
    )
}

enum ContextError {
    Source(crate::source::SourceError),
    Path(crate::source::SourceError),
}

fn prepare_context<'a>(
    command: &'a str,
    invocation: &crate::cli::arguments::mutation::MutationInvocation,
) -> Result<MutationContext<'a>, ContextError> {
    use crate::{cli::arguments::mutation::MutationCommand, source::RelativePath};
    let root = crate::source::open_root(std::path::Path::new(&invocation.root))
        .map_err(ContextError::Source)?;
    let collection = RelativePath::new(&invocation.directory).map_err(ContextError::Path)?;
    let index_name = match &invocation.command {
        MutationCommand::Decision(_) => "decision-index.json",
        MutationCommand::Investigation(_) => "investigation-index.json",
    };
    let index_path =
        RelativePath::new(collection.as_path().join(index_name)).map_err(ContextError::Path)?;
    let index_display = root
        .path()
        .join(index_path.as_path())
        .to_string_lossy()
        .into_owned();
    Ok(MutationContext {
        command,
        json: invocation.json,
        directory: invocation.directory.clone(),
        root,
        collection,
        index_path,
        index_display,
    })
}

pub(super) fn dispatch_mutation(
    command: &str,
    invocation: crate::cli::arguments::mutation::MutationInvocation,
) -> i32 {
    use crate::cli::arguments::mutation::MutationCommand;
    let context = match prepare_context(command, &invocation) {
        Ok(context) => context,
        Err(error) => {
            let (code, error, exit) = match error {
                ContextError::Source(error) => ("source-error", error, 1),
                ContextError::Path(error) => ("invalid-path", error, 2),
            };
            return print_error(
                command,
                invocation.json,
                crate::protocol::CommandError::new(code, error.to_string()),
                exit,
            );
        }
    };
    match invocation.command {
        MutationCommand::Decision(operation) => decision::run(context, operation),
        MutationCommand::Investigation(operation) => {
            let policy = match super::investigation_config::load(
                context.root.path(),
                invocation.config.as_deref(),
            ) {
                Ok(config) => config.policy,
                Err(error) => return print_error(command, invocation.json, error, 1),
            };
            investigation::run(context, operation, policy)
        }
    }
}
