use super::*;

/// An archive transaction captures the historical HEAD baseline afresh unless
/// the explicit keep-unrecorded-history confirmation removes that gate.
pub struct ArchiveOperation {
    pub collection: RelativePath,
    pub index_path: RelativePath,
    pub selectors: Vec<String>,
    pub keep_unrecorded_history: bool,
}
pub struct PreparedArchive {
    pub lifecycle: PreparedLifecycle,
    pub history: Option<crate::mutations::decision::history::HistoryEvidence>,
}
fn archive_evidence(
    root: &Root,
    collection: &RelativePath,
) -> Result<crate::source::DirectorySnapshot, TxError> {
    let mut listing = crate::source::enumerate_directory(root, collection)
        .map_err(|e| failure("collection-read", e.to_string()))?;
    listing
        .members
        .retain(|m| m.name.eq_ignore_ascii_case("archive"));
    if listing
        .members
        .iter()
        .any(|m| m.name != "archive" || m.kind != crate::source::MemberKind::Directory)
    {
        return Err(failure(
            "archive-unsafe",
            "archive directory has an unsafe type or case alias",
        ));
    }
    Ok(listing)
}
impl ArchiveOperation {
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedArchive>, TxError> {
        if self.selectors.is_empty() {
            return Err(failure(
                "invalid-selection",
                "at least one selector is required",
            ));
        }
        let first =
            capture(root, &self.index_path).map_err(|e| failure("index-read", e.to_string()))?;
        let ExpectedFile::Present(snapshot) = &first else {
            return Err(failure("index-missing", "published index is missing"));
        };
        let baseline =
            crate::index::parse_index(&snapshot.bytes, &crate::domains::decision::Definition)
                .map_err(|e| failure("index-invalid", e.to_string()))?;
        let ArchiveSelection { edits, history } = select_archive(self, root, &baseline)?;
        let plan = capture_archive_plan(self, root, &edits, first)?;
        Ok(Plan {
            value: PreparedArchive {
                lifecycle: plan.value,
                history,
            },
            writes: plan.writes,

            resources: plan.resources,
            commit_point: plan.commit_point,
        })
    }
}
fn capture_archive_plan(
    operation: &ArchiveOperation,
    root: &Root,
    edits: &[lifecycle::LifecycleEdit],
    first: ExpectedFile,
) -> Result<Plan<PreparedLifecycle>, TxError> {
    let archive_before = archive_evidence(root, &operation.collection)?;
    let mut plan = decision_lifecycle::capture_plan(
        root,
        &operation.collection,
        &operation.index_path,
        first,
        edits,
    )?;
    if archive_before.members.is_empty() {
        plan.resources
            .push(crate::transaction::ResourceIntent::CreateDirectory {
                path: RelativePath::new(operation.collection.as_path().join("archive"))
                    .map_err(|e| failure("archive-path", e.to_string()))?,
            });
    }
    Ok(plan)
}

struct ArchiveSelection {
    edits: Vec<lifecycle::LifecycleEdit>,
    history: Option<crate::mutations::decision::history::HistoryEvidence>,
}
fn select_archive(
    operation: &ArchiveOperation,
    root: &Root,
    baseline: &crate::index::ValidatedIndex<crate::domains::decision::DecisionState>,
) -> Result<ArchiveSelection, TxError> {
    let ArchiveRecords { selected, locators } =
        resolve_archive_records(baseline, &operation.selectors)?;
    // Validate selection and transition before the history gate.
    let selected_without_history: Vec<_> = selected
        .iter()
        .cloned()
        .map(|s| (s, HistoryFact::NotApplicable))
        .collect();
    lifecycle::plan_lifecycle(&selected_without_history, LifecycleAction::Archive, false)
        .map_err(|e| failure("lifecycle-invalid", format!("{e:?}")))?;
    let history = if operation.keep_unrecorded_history {
        None
    } else {
        Some(
            crate::mutations::decision::history::capture_history(
                root,
                &operation.collection,
                &locators,
            )
            .map_err(|e| failure("history", format!("{e:?}")))?,
        )
    };
    let selected_with_history: Vec<_> = selected
        .into_iter()
        .map(|source| {
            let fact = history
                .as_ref()
                .map(|h| h.facts[&source.id])
                .unwrap_or(HistoryFact::NotApplicable);
            (source, fact)
        })
        .collect();
    let edits = lifecycle::plan_lifecycle(
        &selected_with_history,
        LifecycleAction::Archive,
        operation.keep_unrecorded_history,
    )
    .map_err(|e| archive_history_failure(e, &selected_with_history, history.as_ref()))?;
    Ok(ArchiveSelection { edits, history })
}

fn archive_history_failure(
    error: lifecycle::LifecyclePlanError,
    selected: &[(LifecycleRecord, HistoryFact)],
    history: Option<&crate::mutations::decision::history::HistoryEvidence>,
) -> TxError {
    let mut result = failure("history-attention", format!("{error:?}"));
    if matches!(
        error,
        lifecycle::LifecyclePlanError::HistoryConfirmationRequired(_)
    ) {
        let history_label = if history.and_then(|item| item.head.as_ref()).is_some() {
            "Git HEAD"
        } else {
            "recorded history"
        };
        let mut ids: Vec<_> = selected
            .iter()
            .filter(|(_, fact)| *fact == HistoryFact::Unrecorded)
            .map(|(record, _)| record.id.as_str())
            .collect();
        ids.sort();
        result.diagnostics = ids.into_iter().map(|id| lifecycle_diagnostic(
            "decision-records.unrecorded-history", &format!("Decision history for {id}"),
            format!("Decision {id} has not entered {history_label}; confirm whether it should be preserved as independent decision history."),
            "Re-run with --keep-unrecorded-history only after confirming that the unrecorded history should be preserved.",
        )).collect();
    }
    result
}

struct ArchiveRecords {
    selected: Vec<LifecycleRecord>,
    locators: std::collections::BTreeMap<String, String>,
}
fn resolve_archive_records(
    baseline: &crate::index::ValidatedIndex<crate::domains::decision::DecisionState>,
    selectors: &[String],
) -> Result<ArchiveRecords, TxError> {
    let mut selected = Vec::new();
    let mut locators = std::collections::BTreeMap::new();
    for selector in selectors {
        let (id, state) =
            crate::domains::resolve_selector(&baseline.index().entries, selector, |s| &s.name)
                .map_err(|e| failure("selector", format!("{e:?}")))?;
        if locators
            .insert(id.to_owned(), state.source_path.clone())
            .is_some()
        {
            return Err(failure("duplicate-selection", id));
        }
        selected.push(lifecycle_record(id, state)?);
    }
    Ok(ArchiveRecords { selected, locators })
}

impl TransactionOperation<PreparedArchive> for ArchiveOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedArchive>, TxError> {
        self.prepare_phase(root)
    }
}
