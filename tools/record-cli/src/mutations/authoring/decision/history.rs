use super::*;

pub(super) struct HistoryPreparation<'a> {
    pub operation: &'a DecisionEvolutionOperation,
    pub root: &'a Root,
    pub historical: &'a BTreeMap<String, String>,
    pub discarded: &'a Option<String>,
    pub ids: &'a BTreeMap<String, Located>,
    pub candidates: &'a BTreeSet<String>,
    pub predecessors: BTreeMap<String, evolution::Predecessor>,
    pub successors: &'a [evolution::Successor],
}
pub(super) struct HistoryReview {
    pub history: decision_history::HistoryEvidence,
    pub discard_history: Option<(Option<String>, bool)>,
    pub plan: evolution::EvolutionPlan,
}
impl HistoryPreparation<'_> {
    pub fn review(self) -> Result<HistoryReview, TxError> {
        let CapturedHistory {
            history,
            discard_history,
        } = self.capture()?;
        self.confirm_discard(&discard_history)?;
        let Self {
            operation,
            discarded,
            predecessors,
            successors,
            ..
        } = self;
        let predecessors = apply_history(predecessors, &history);
        let plan = evolution::plan_evolution(
            successors,
            &predecessors,
            discarded.as_deref(),
            operation.keep_unrecorded_history,
            |_| Ok::<_, ()>(()),
        )
        .map_err(|e| match e {
            evolution::EvolutionError::HistoryConfirmationRequired(_) => {
                unrecorded_confirmation(&e, successors, &history, self.historical, operation)
            }
            _ => fail("evolution", format!("{e:?}")),
        })?;
        Ok(HistoryReview {
            history,
            discard_history,
            plan,
        })
    }
    fn confirm_discard(
        &self,
        discard_history: &Option<(Option<String>, bool)>,
    ) -> Result<(), TxError> {
        if discard_history
            .as_ref()
            .is_some_and(|(_, recorded)| *recorded)
            && !self.operation.delete_recorded
        {
            let id = self
                .discarded
                .as_ref()
                .expect("discard history has a selected ID");
            return Err(recorded_discard_confirmation(
                id,
                &self
                    .operation
                    .collection
                    .as_path()
                    .join(&self.ids[id].path)
                    .to_string_lossy(),
            ));
        }
        Ok(())
    }
    fn capture(&self) -> Result<CapturedHistory, TxError> {
        let Self {
            operation,
            root,
            historical,
            discarded,
            ids,
            candidates,
            ..
        } = self;
        let history = if historical.is_empty() {
            decision_history::HistoryEvidence {
                head: None,
                facts: BTreeMap::new(),
            }
        } else {
            decision_history::capture_history(root, &operation.collection, historical)
                .map_err(|error| history_baseline_failure(error, &operation.collection))?
        };
        let discard_history = discarded
            .as_ref()
            .map(|id| {
                crate::mutations::identity::decision::history(
                    root,
                    &operation.collection,
                    id,
                    &ids[id].path,
                    candidates.contains(id),
                )
                .map_err(|error| {
                    discard_history_failure(error, id, &operation.collection, &ids[id].path)
                })
            })
            .transpose()?;
        if !historical.is_empty()
            && let Some((discard_head, _)) = &discard_history
            && history.head != *discard_head
        {
            return Err(head_changed());
        }
        Ok(CapturedHistory {
            history,
            discard_history,
        })
    }
}

struct CapturedHistory {
    history: decision_history::HistoryEvidence,
    discard_history: Option<(Option<String>, bool)>,
}

fn unrecorded_confirmation(
    error: &evolution::EvolutionError<()>,
    successors: &[evolution::Successor],
    history: &decision_history::HistoryEvidence,
    paths: &BTreeMap<String, String>,
    operation: &DecisionEvolutionOperation,
) -> TxError {
    use crate::mutations::lifecycle::HistoryFact;
    let targets: BTreeSet<_> = successors
        .iter()
        .flat_map(|successor| &successor.after)
        .filter(|edge| history.facts.get(&edge.target) == Some(&HistoryFact::Unrecorded))
        .map(|edge| (edge.target.clone(), domain_relation(edge).relation_type))
        .collect();
    let diagnostics = targets.into_iter().map(|(id, relation)| {
        let reason = format!("Predecessor decision {id} has not entered Git HEAD; confirm whether this {relation} relation should be preserved as independent decision evolution.");
        crate::protocol::Diagnostic {
            code: "decision-records.unrecorded-history".into(), message: reason.clone(),
            path: paths.get(&id).map(|path| operation.collection.as_path().join(path).to_string_lossy().into_owned()), target: Some(format!("Decision history for {id}")),
            cause_category: Some("confirmation-required".into()), operation: Some(if operation.publish_only { "publish" } else { "evolve" }.into()),
            detail: Some(format!("relation: {relation}")), reason: Some(reason),
            recovery: Some("Re-run with --keep-unrecorded-history only after confirming that the unrecorded history should be preserved.".into()),
        }
    }).collect();
    fail("evolution", format!("{error:?}")).with_diagnostics(diagnostics)
}

fn recorded_discard_confirmation(id: &str, path: &str) -> TxError {
    let reason = format!(
        "Decision {id} has entered Git HEAD; confirm that its recorded history should be deleted."
    );
    fail(
        "history-confirmation",
        "recorded discard requires confirmation",
    )
    .with_diagnostics(vec![crate::protocol::Diagnostic {
        code: "decision-records.recorded-discard".into(),
        message: reason.clone(),
        path: Some(path.into()),
        target: Some(format!("Decision history for {id}")),
        cause_category: Some("confirmation-required".into()),
        operation: Some("discard".into()),
        detail: None,
        reason: Some(reason),
        recovery: Some(
            "Re-run with --delete-recorded only after confirming deletion; no files were changed."
                .into(),
        ),
    }])
}

fn history_baseline_failure(
    error: decision_history::HistoryError,
    collection: &RelativePath,
) -> TxError {
    let source = history_index_path(&error, collection);
    let target = match &error {
        decision_history::HistoryError::InvalidHistoricalIdentity(id) => {
            format!("Decision history for {id}")
        }
        _ => "Decision history baseline".into(),
    };
    let reason = format!("{error:?}");
    let is_system = matches!(
        error,
        decision_history::HistoryError::Git(_) | decision_history::HistoryError::OutsideRepository
    );
    let recovery = if is_system {
        "Inspect and resolve the reported version-control or filesystem access failure before retrying."
    } else {
        "Restore a trusted historical index and its selected source identities before retrying; do not infer recorded history by scanning unrelated blobs."
    };
    fail("history", &reason).with_diagnostics(vec![crate::protocol::Diagnostic {
        code: "decision-records.history-baseline-invalid".into(),
        message: reason.clone(),
        path: source.map(|path| path.to_string_lossy().into_owned()),
        target: Some(target),
        cause_category: Some(
            if is_system {
                "system"
            } else {
                "invalid-history"
            }
            .into(),
        ),
        operation: Some("read-history".into()),
        detail: None,
        reason: Some(reason),
        recovery: Some(recovery.into()),
    }])
}

fn discard_history_failure(
    mut error: TxError,
    id: &str,
    collection: &RelativePath,
    path: &str,
) -> TxError {
    if error.diagnostics.is_empty() {
        let reason = error.message.clone();
        error.diagnostics.push(crate::protocol::Diagnostic {
            code: "decision-records.history-baseline-invalid".into(), message: reason.clone(),
            path: Some(collection.as_path().join(path).to_string_lossy().into_owned()),
            target: Some(format!("Decision history for {id}")), cause_category: Some("history-unavailable".into()),
            operation: Some("read-history".into()), detail: None, reason: Some(reason),
            recovery: Some("Inspect and restore the selected historical identity and version-control access before retrying.".into()),
        });
    }
    error
}

fn apply_history(
    mut predecessors: BTreeMap<String, evolution::Predecessor>,
    history: &decision_history::HistoryEvidence,
) -> BTreeMap<String, evolution::Predecessor> {
    for (id, fact) in &history.facts {
        predecessors
            .get_mut(id)
            .expect("history covers selected predecessors")
            .history = *fact;
    }
    predecessors
}

fn history_index_path(
    error: &decision_history::HistoryError,
    collection: &RelativePath,
) -> Option<std::path::PathBuf> {
    match error {
        decision_history::HistoryError::InvalidIndex(_)
        | decision_history::HistoryError::MissingIndexWithSources => {
            Some(collection.as_path().join("decision-index.json"))
        }
        _ => None,
    }
}

fn head_changed() -> TxError {
    let reason = "HEAD changed between history captures";
    fail("history", reason).with_diagnostics(vec![crate::protocol::Diagnostic {
        code: "decision-records.history-baseline-changed".into(),
        message: reason.into(),
        path: None,
        target: Some("Decision history baseline".into()),
        cause_category: Some("source-changed".into()),
        operation: Some("read-history".into()),
        detail: None,
        reason: Some(reason.into()),
        recovery: Some("Reinspect Git HEAD and retry from a fresh history baseline.".into()),
    }])
}
