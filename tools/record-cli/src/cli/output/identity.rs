use crate::cli::*;

#[derive(Clone, Copy)]
pub(in crate::cli) struct ExecutionContext<'a> {
    pub command: &'a str,
    pub json: bool,
    pub root: &'a crate::source::Root,
}

pub(in crate::cli) fn identity_transaction_body<T>(
    result: &mut crate::transaction::TransactionOutcome<T>,
    index_path: &crate::source::RelativePath,
    is_source: impl Fn(&crate::source::RelativePath) -> bool,
    project: impl FnOnce(T) -> serde_json::Value,
) -> (bool, serde_json::Value) {
    let paths = result
        .written_paths
        .iter()
        .filter(|path| is_source(path))
        .map(|path| path.as_path().to_string_lossy().replace('\\', "/"))
        .collect::<Vec<_>>();
    let index_changed = if result.unknown_paths.contains(index_path) {
        serde_json::Value::Null
    } else {
        (result.committed && result.written_paths.contains(index_path)).into()
    };
    let (verified, mut body) = transaction_body(result, project);
    body["indexPath"] = index_path
        .as_path()
        .to_string_lossy()
        .replace('\\', "/")
        .into();
    body["sourcePaths"] = serde_json::json!(paths);
    body["indexChanged"] = index_changed;
    (verified, body)
}

pub(in crate::cli) fn captured_utc() -> String {
    time::OffsetDateTime::now_utc()
        .replace_nanosecond(0)
        .expect("zero nanoseconds are valid")
        .format(&time::format_description::well_known::Rfc3339)
        .expect("UTC time is RFC3339 representable")
}
pub(in crate::cli) fn output_evolution(
    context: ExecutionContext<'_>,
    mut operation: crate::mutations::authoring::decision::DecisionEvolutionOperation,
    preflight: bool,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
    } = context;
    use crate::mutations::contract::ReviewPhase;
    let project = |prepared: crate::mutations::authoring::decision::PreparedEvolution, phase| {
        let review = crate::mutations::relations::review(prepared.review, phase);
        serde_json::json!({"preflight":preflight,"establishedIds":prepared.established,"archivedIds":prepared.archived,"discardedId":prepared.discarded,"relationReview":review})
    };
    if preflight {
        match crate::transaction::preflight(root, &mut operation) {
            Ok(plan) => {
                let mut body = project(plan.value, ReviewPhase::Preflight);
                body["changed"] = false.into();
                emit_success(command, json, false, &body, &[])
            }
            Err(error) => print_transaction_error(command, json, error),
        }
    } else {
        let result = crate::transaction::run_transaction(root, &mut operation);
        output_transaction(command, json, result, |prepared| {
            project(prepared, ReviewPhase::Prepared)
        })
    }
}
pub(in crate::cli) fn output_new(
    context: ExecutionContext<'_>,
    collection: crate::source::RelativePath,
    selector: String,
    input: crate::mutations::authoring::NewInput,
    preview: Option<crate::mutations::contract::Alignment>,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
    } = context;
    use crate::mutations::authoring::{NewInput, NewOperation};
    let is_decision = matches!(input, NewInput::Decision { .. });
    let mut operation = match NewOperation::new(collection, selector, input) {
        Ok(value) => value,
        Err(error) => {
            return print_transaction_error(command, json, error);
        }
    };
    let id = operation.id.clone();
    let result = crate::transaction::run_transaction(root, &mut operation);
    finish_new(
        context,
        result,
        NewFacts {
            id,
            is_decision,
            preview,
        },
    )
}

struct NewFacts {
    id: String,
    is_decision: bool,
    preview: Option<crate::mutations::contract::Alignment>,
}

fn finish_new(
    context: ExecutionContext<'_>,
    mut result: crate::transaction::TransactionOutcome<crate::mutations::authoring::PreparedNew>,
    facts: NewFacts,
) -> i32 {
    let ExecutionContext { command, json, .. } = context;
    let NewFacts {
        id,
        is_decision,
        preview,
    } = facts;
    let committed = result.committed;
    let mut warnings = Vec::new();
    let (verified, mut body) = transaction_body(&mut result, |prepared| {
        warnings = prepared.warnings.clone();
        project_new(prepared, is_decision, preview)
    });
    if !verified && committed {
        add_committed_creation(&mut body, id, is_decision);
    }
    if verified {
        return emit_success(command, json, false, &body, &warnings);
    }
    let failure = transaction_failure_envelope(command, &result, body);
    if json {
        println!("{failure}");
    } else {
        eprintln!("{failure}");
    }
    1
}

fn project_new(
    prepared: crate::mutations::authoring::PreparedNew,
    is_decision: bool,
    preview: Option<crate::mutations::contract::Alignment>,
) -> serde_json::Value {
    let mut body = serde_json::json!({"created":true,"id":prepared.id,"sourcePath":prepared.source_path,"readiness":{"scaffoldValid":prepared.scaffold_valid,"bodyReady":prepared.body_ready,"resourceReady":prepared.resource_ready},"warnings":prepared.warnings});
    if is_decision {
        body["decisionId"] = body["id"].clone();
    }
    if let Some(preview) = preview {
        body["alignmentPreview"] = serde_json::json!(preview);
    }
    body
}

fn add_committed_creation(body: &mut serde_json::Value, id: String, is_decision: bool) {
    body["created"] = true.into();
    body["id"] = id.clone().into();
    body["sourcePath"] = if is_decision {
        format!("{id}.md")
    } else {
        format!("_candidate.{id}")
    }
    .into();
    if is_decision {
        body["decisionId"] = id.into();
    }
}
