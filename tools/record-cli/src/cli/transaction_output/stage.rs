use super::*;
mod diagnostics;
use diagnostics::stage_diagnostic;

pub(in crate::cli) struct StageOutput<'a> {
    pub command: &'a str,
    pub json: bool,
    pub domain: Domain,
    pub index_path: &'a crate::source::RelativePath,
    pub index_display: &'a str,
    pub scope: crate::stage::StageScope,
}

pub(in crate::cli) fn output_stage(
    output: StageOutput<'_>,
    result: Result<
        crate::stage::index_scope::IndexStageResult,
        crate::stage::index_scope::IndexStageError,
    >,
) -> i32 {
    let scope = match output.scope {
        crate::stage::StageScope::Index => "index",
        crate::stage::StageScope::All => "all",
        crate::stage::StageScope::Domain => "domain",
    };
    match result {
        Ok(result) => stage_success(output, scope, result),
        Err(error) => stage_failure(output, scope, error),
    }
}

fn stage_success(
    output: StageOutput<'_>,
    scope: &str,
    result: crate::stage::index_scope::IndexStageResult,
) -> i32 {
    let StageOutput {
        command,
        json,
        domain,
        index_path,
        index_display,
        ..
    } = output;
    let paths = |values: Vec<std::path::PathBuf>| {
        values
            .into_iter()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect::<Vec<_>>()
    };
    let changed = !result.changed_paths.is_empty();
    let mut body = serde_json::json!({"status":"ok","scope":scope,"selectedIds":result.selected_ids,"writtenPaths":paths(result.changed_paths),"preservedPendingPaths":paths(result.preserved_pending_paths),"callerOwnedPaths":paths(result.caller_owned_paths)});
    if let Some(object) = body.as_object_mut() {
        if domain == Domain::Decision {
            object.insert("command".into(), "stage".into());
            object.insert(
                "indexRelativePath".into(),
                index_path
                    .as_path()
                    .to_string_lossy()
                    .replace('\\', "/")
                    .into(),
            );
            object.insert("pendingFileCount".into(), result.pending_file_count.into());
        } else {
            object.insert("indexPath".into(), index_display.into());
            object.insert("namespace".into(), "investigations".into());
            object.insert("changed".into(), changed.into());
            object.insert(
                "state".into(),
                if changed { "staged" } else { "unchanged" }.into(),
            );
            object.insert("diagnostics".into(), serde_json::json!([]));
        }
    }
    emit_success(command, json, false, &body, &[])
}

fn stage_failure(
    output: StageOutput<'_>,
    scope: &str,
    error: crate::stage::index_scope::IndexStageError,
) -> i32 {
    let diagnostic = stage_diagnostic(&output, &error);
    let StageOutput { command, json, .. } = output;
    let code = error.code();
    let message = format!("{error:?}");
    let mut body = stage_failure_body(scope, &error);
    add_failure_context(&mut body, &output, &error);
    let mut detail = serde_json::json!({"code":code,"message":message});
    if let Some(recovery) = diagnostic
        .as_ref()
        .and_then(|d| d.recovery.as_deref())
        .or_else(|| error.recovery())
    {
        detail["recovery"] = recovery.into();
    }
    if json {
        println!(
            "{}",
            serde_json::json!({"version":2,"command":command,"ok":false,"error":detail,"diagnostics":diagnostic.iter().collect::<Vec<_>>(),"result":body})
        );
    } else {
        eprintln!("{code}: {message}\n{body}");
        if let Some(diagnostic) = diagnostic {
            eprintln!(
                "{}: {}",
                diagnostic.target.as_deref().unwrap_or("selection"),
                diagnostic.reason.as_deref().unwrap_or(&diagnostic.message)
            );
            if let Some(recovery) = diagnostic.recovery {
                eprintln!("{recovery}");
            }
        } else if let Some(recovery) = error.recovery() {
            eprintln!("{recovery}");
        }
    }
    1
}
fn add_failure_context(
    body: &mut serde_json::Value,
    output: &StageOutput<'_>,
    error: &crate::stage::index_scope::IndexStageError,
) {
    if matches!(
        error,
        crate::stage::index_scope::IndexStageError::SelectorUnresolved { .. }
    ) {
        add_selection_context(body, output);
    } else if matches!(
        error,
        crate::stage::index_scope::IndexStageError::SelectedSource { .. }
    ) {
        add_selection_context(body, output);
        if output.domain == Domain::Investigation {
            body["state"] = "domain-stage-failed".into();
        }
    }
}
/// Add the domain-specific context known at selector resolution time.
fn add_selection_context(body: &mut serde_json::Value, output: &StageOutput<'_>) {
    body["selectionScope"] = match (output.scope, output.domain) {
        (crate::stage::StageScope::Index, _) => "Pending index snapshot",
        (_, Domain::Decision) => "Pending decision snapshot",
        (_, Domain::Investigation) => "Pending investigation snapshot",
    }
    .into();
    if output.domain == Domain::Investigation {
        body["state"] = "selection-invalid".into();
        body["indexPath"] = output.index_display.into();
        body["namespace"] = "investigations".into();
    }
}
fn stage_failure_body(
    scope: &str,
    error: &crate::stage::index_scope::IndexStageError,
) -> serde_json::Value {
    use crate::git::publish::FailureKind;
    use crate::stage::index_scope::IndexStageError;
    let mut body = serde_json::json!({"status":"error","scope":scope});
    if let IndexStageError::Publication(failure) = error {
        body["changed"] = match failure.kind {
            FailureKind::Failed => false.into(),
            FailureKind::PartialOrUnknown => serde_json::Value::Null,
            FailureKind::CountUnavailable => failure
                .committed_paths
                .as_ref()
                .map_or(serde_json::Value::Null, |paths| (!paths.is_empty()).into()),
        };
    }
    if matches!(
        error,
        IndexStageError::SelectorUnresolved { .. }
            | IndexStageError::SelectedSource { .. }
            | IndexStageError::PendingSourceInvalid { .. }
    ) {
        body["changed"] = false.into();
    }
    if let Some(paths) = error.committed_paths() {
        body["writtenPaths"] = serde_json::json!(
            paths
                .iter()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .collect::<Vec<_>>()
        );
    }
    if let crate::stage::index_scope::IndexStageError::HistoricalIndexMissing {
        namespace_indeterminate,
    } = error
    {
        body["historicalNamespaceIndeterminate"] = (*namespace_indeterminate).into();
    }
    body
}

#[cfg(test)]
mod tests;
