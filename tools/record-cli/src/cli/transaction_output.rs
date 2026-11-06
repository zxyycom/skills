use super::*;

type BootstrapFailure = (Vec<String>, Vec<String>, String);
pub(super) fn bootstrap_lock_parent(
    root: &crate::source::Root,
    lock: &crate::source::RelativePath,
) -> Result<Vec<String>, BootstrapFailure> {
    use crate::source::{self, CreateEffect, CreateMode, RelativePath, SourceError};
    let mut prefix = std::path::PathBuf::new();
    let mut created = Vec::new();
    for component in lock
        .as_path()
        .parent()
        .unwrap_or_else(|| std::path::Path::new(""))
        .components()
    {
        prefix.push(component.as_os_str());
        let path =
            RelativePath::new(&prefix).map_err(|e| (created.clone(), vec![], e.to_string()))?;
        match source::enumerate_directory(root, &path) {
            Ok(_) => continue,
            Err(SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err((created, vec![], e.to_string())),
        }
        let proof = source::capture_missing(root, &path)
            .map_err(|e| (created.clone(), vec![], e.to_string()))?;
        match source::create_directory_exclusive(root, &proof, CreateMode::Native(0o777)) {
            Ok(_) => created.push(prefix.to_string_lossy().replace('\\', "/")),
            Err(failure) => {
                let unknown = if failure.effect == CreateEffect::Unknown {
                    vec![prefix.to_string_lossy().replace('\\', "/")]
                } else {
                    vec![]
                };
                return Err((created, unknown, failure.error.to_string()));
            }
        }
    }
    Ok(created)
}
pub(super) fn lifecycle_details(
    prepared: crate::mutations::decision_lifecycle::PreparedLifecycle,
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
pub(super) use stage::{StageOutput, output_stage};

pub(super) fn output_transaction<T>(
    command: &str,
    json: bool,
    result: crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> serde_json::Value,
) -> i32 {
    output_transaction_warnings(command, json, result, |value| (success(value), Vec::new()))
}
pub(super) fn output_transaction_warnings<T>(
    command: &str,
    json: bool,
    mut result: crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> (serde_json::Value, Vec<String>),
) -> i32 {
    let mut warnings = Vec::new();
    let (verified, body) = transaction_body(&mut result, |value| {
        let (body, observed) = success(value);
        warnings = observed;
        body
    });
    if verified {
        return emit_success(command, json, false, &body, &warnings);
    }
    let first = result
        .errors
        .first()
        .or_else(|| result.cleanup_errors.first());
    let (code, message) = first.map_or(
        ("transaction-failed", "transaction verification failed"),
        |d| (d.code.as_str(), d.message.as_str()),
    );
    if json {
        println!("{}", transaction_failure_envelope(command, &result, body));
    } else {
        eprintln!("{code}: {message}\n{body}");
    }
    1
}
pub(super) fn print_transaction_failure<T>(
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

pub(super) fn transaction_failure_envelope<T>(
    command: &str,
    result: &crate::transaction::TransactionOutcome<T>,
    body: serde_json::Value,
) -> serde_json::Value {
    let first = result
        .errors
        .first()
        .or_else(|| result.cleanup_errors.first());
    let (code, message) = first.map_or(
        ("transaction-failed", "transaction verification failed"),
        |d| (d.code.as_str(), d.message.as_str()),
    );
    let diagnostics = result
        .errors
        .iter()
        .chain(&result.cleanup_errors)
        .cloned()
        .collect::<Vec<_>>();
    let mut error = serde_json::json!({"code":code,"message":message});
    if !result.recovery_backups.is_empty()
        || !result.recovery_directories.is_empty()
        || !result.unknown_paths.is_empty()
    {
        error["recovery"] = "Inspect the reported paths and retained backups before deciding how to recover; do not blindly retry.".into();
    }
    serde_json::json!({"version":1,"command":command,"ok":false,"error":error,"diagnostics":diagnostics,"result":body})
}
fn verification_name(status: crate::transaction::VerificationStatus) -> &'static str {
    use crate::transaction::VerificationStatus;
    match status {
        VerificationStatus::Passed => "passed",
        VerificationStatus::FailedOrUnknown => "failed-or-unknown",
        VerificationStatus::NotRun => "not-run",
    }
}

fn recovery_name(status: crate::transaction::RecoveryStatus) -> &'static str {
    use crate::transaction::RecoveryStatus;
    match status {
        RecoveryStatus::NoChange => "no-change",
        RecoveryStatus::Committed => "committed",
        RecoveryStatus::RolledBack => "rolled-back",
        RecoveryStatus::PartialOrUnknown => "partial-or-unknown",
        RecoveryStatus::CommittedCleanupPending => "committed-cleanup-pending",
    }
}

pub(super) fn transaction_body<T>(
    result: &mut crate::transaction::TransactionOutcome<T>,
    success: impl FnOnce(T) -> serde_json::Value,
) -> (bool, serde_json::Value) {
    use crate::transaction::{TxStatus, VerificationStatus};
    let verified = result.status == TxStatus::Ok
        && result.errors.is_empty()
        && result.cleanup_errors.is_empty()
        && result.verification == VerificationStatus::Passed;
    let verification = verification_name(result.verification);
    let outcome = recovery_name(result.outcome);
    let mut body = serde_json::json!({"status":if verified {"ok"} else {"error"},"changed":result.changed,"committed":result.committed,"verification":verification,"outcome":outcome,"writtenPaths":result.written_paths.iter().map(|p| p.as_path().to_string_lossy().replace('\\', "/")).collect::<Vec<_>>(),"unknownPaths":result.unknown_paths.iter().map(|p| p.as_path().to_string_lossy().replace('\\', "/")).collect::<Vec<_>>(),"errors":result.errors,"cleanupErrors":result.cleanup_errors});
    if !result.recovery_backups.is_empty() {
        body["recoveryBackups"] = serde_json::Value::Array(result.recovery_backups.iter().map(|entry| serde_json::json!({"source":entry.source.as_path().to_string_lossy().replace('\\', "/"),"backup":entry.backup.as_path().to_string_lossy().replace('\\', "/"),"mode":entry.mode})).collect());
    }
    if !result.recovery_directories.is_empty() {
        body["recoveryDirectories"] = serde_json::Value::Array(result.recovery_directories.iter().map(|entry| serde_json::json!({"path":entry.path.as_path().to_string_lossy().replace('\\', "/"),"mode":entry.mode})).collect());
    }
    if verified
        && let Some(value) = result.value.take()
        && let (Some(target), Some(extra)) = (body.as_object_mut(), success(value).as_object())
    {
        target.extend(extra.clone());
    }
    (verified, body)
}
