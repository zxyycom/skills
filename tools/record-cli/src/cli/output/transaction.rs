use crate::cli::*;

pub(in crate::cli) fn lifecycle_details(
    prepared: crate::mutations::decision::lifecycle::preparation::PreparedLifecycle,
) -> serde_json::Value {
    let ids = prepared
        .moves
        .iter()
        .map(|entry| entry.id.clone())
        .collect::<Vec<_>>();
    let paths = prepared
        .moves
        .iter()
        .map(|entry| entry.new_path.clone())
        .collect::<Vec<_>>();
    let changes = prepared.moves.into_iter().map(|entry| serde_json::json!({"id":entry.id,"oldPath":entry.old_path,"newPath":entry.new_path,"before":entry.before_lifecycle,"after":entry.after_lifecycle})).collect::<Vec<_>>();
    serde_json::json!({"affectedIds":ids,"sourcePaths":paths,"affected":changes})
}
mod stage;
pub(in crate::cli) use stage::{StageOutput, output_stage};

pub(in crate::cli) fn output_transaction<T>(
    command: &str,
    json: bool,
    result: crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> serde_json::Value,
) -> i32 {
    output_transaction_warnings(command, json, result, |value| (success(value), Vec::new()))
}
pub(in crate::cli) fn output_transaction_warnings<T>(
    command: &str,
    json: bool,
    mut result: crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> (serde_json::Value, Vec<String>),
) -> i32 {
    let mut warnings = Vec::new();
    let (successful, body) = transaction_body(&mut result, |value| {
        let (body, observed) = success(value);
        warnings = observed;
        body
    });
    if successful {
        return emit_success(command, json, false, &body, &warnings);
    }
    let first = result.errors.first();
    let (code, message) = first.map_or(("transaction-failed", "transaction failed"), |d| {
        (d.code.as_str(), d.message.as_str())
    });
    if json {
        println!("{}", transaction_failure_envelope(command, &result, body));
    } else {
        eprintln!("{code}: {message}\n{body}");
    }
    1
}
pub(in crate::cli) fn print_transaction_failure<T>(
    command: &str,
    json: bool,
    result: &crate::transaction::TransactionOutcome<T>,
    body: serde_json::Value,
) -> i32 {
    let failure = transaction_failure_envelope(command, result, body);
    if json {
        println!("{failure}");
    } else {
        eprintln!("{failure}");
    }
    1
}

pub(in crate::cli) fn transaction_failure_envelope<T>(
    command: &str,
    result: &crate::transaction::TransactionOutcome<T>,
    body: serde_json::Value,
) -> serde_json::Value {
    let first = result.errors.first();
    let (code, message) = first.map_or(("transaction-failed", "transaction failed"), |d| {
        (d.code.as_str(), d.message.as_str())
    });
    let diagnostics = result.errors.clone();
    let mut error = serde_json::json!({"code":code,"message":message});
    if !result.unknown_paths.is_empty() {
        error["recovery"] = "Inspect reported paths before retrying.".into();
    }
    serde_json::json!({"version":2,"command":command,"ok":false,"error":error,"diagnostics":diagnostics,"result":body})
}

pub(in crate::cli) fn transaction_body<T>(
    result: &mut crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> serde_json::Value,
) -> (bool, serde_json::Value) {
    let successful = result.status == crate::transaction::TxStatus::Ok;
    let mut body = serde_json::json!({"status":if successful {"ok"} else {"error"},"changed":result.changed,"committed":result.committed,"writtenPaths":result.written_paths.iter().map(|p| p.as_path().to_string_lossy().replace('\\', "/")).collect::<Vec<_>>(),"unknownPaths":result.unknown_paths.iter().map(|p| p.as_path().to_string_lossy().replace('\\', "/")).collect::<Vec<_>>(),"errors":result.errors});
    if successful
        && let Some(value) = result.value.take()
        && let (Some(target), Some(extra)) = (body.as_object_mut(), success(value).as_object())
    {
        target.extend(extra.clone());
    }
    (successful, body)
}
