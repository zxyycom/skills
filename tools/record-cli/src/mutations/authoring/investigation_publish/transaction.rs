use super::*;

impl TransactionOperation<PreparedPublication> for InvestigationPublishOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedPublication>, TxError> {
        self.prepare_phase(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
        let now = self.prepare_phase(root)?;
        if plan.value.evidence != now.value.evidence
            || plan.value.warnings != now.value.warnings
            || !plan.value.resources.equivalent(&now.value.resources)
            || !same_writes(&plan.writes, &now.writes)
            || !same_guards(&plan.guards, &now.guards)
        {
            return Err(fail("source-changed", "publication inputs changed"));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
        verify_writes(root, plan)?;
        verify_index(self, root, plan)?;
        verify_resources(self, root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedPublication>,
    ) -> Result<(), TxError> {
        for w in &plan.writes {
            let actual = source::capture(root, &w.path).map_err(|e| fail("recovery", e))?;
            match (&w.before, actual) {
                (ExpectedFile::Missing, ExpectedFile::Missing) => {}
                (ExpectedFile::Present(before), ExpectedFile::Present(actual))
                    if before.bytes == actual.bytes
                        && before.identity.mode == actual.identity.mode => {}
                _ => return Err(fail("recovery", "source was not restored")),
            }
        }
        Ok(())
    }
}

fn same_writes(
    a: &[crate::transaction::WriteIntent],
    b: &[crate::transaction::WriteIntent],
) -> bool {
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|(a, b)| a.path == b.path && a.before == b.before && a.after == b.after)
}
fn same_guards(a: &[crate::transaction::Guard], b: &[crate::transaction::Guard]) -> bool {
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|(a, b)| a.path == b.path && a.before == b.before)
}
fn verify_writes(root: &Root, plan: &Plan<PreparedPublication>) -> Result<(), TxError> {
    for w in &plan.writes {
        let actual = source::capture(root, &w.path).map_err(|e| fail("postverify", e))?;
        match (&w.after, actual) {
            (None, ExpectedFile::Missing) => {}
            (Some(expected), ExpectedFile::Present(actual)) if actual.bytes == *expected => {}
            _ => {
                return Err(fail(
                    "postverify",
                    format!("unexpected {}", w.path.as_path().display()),
                ));
            }
        }
    }
    Ok(())
}
fn verify_index(
    operation: &InvestigationPublishOperation,
    root: &Root,
    plan: &Plan<PreparedPublication>,
) -> Result<(), TxError> {
    let index_path = RelativePath::new(
        operation
            .collection
            .as_path()
            .join("investigation-index.json"),
    )
    .map_err(|e| fail("path", e))?;
    let ExpectedFile::Present(index_file) =
        source::capture(root, &index_path).map_err(|e| fail("postverify", e))?
    else {
        return Err(fail("postverify", "index missing"));
    };
    let parsed =
        index::parse_index(&index_file.bytes, &Definition).map_err(|e| fail("postverify", e))?;
    let selected: BTreeSet<_> = plan.value.ids.iter().cloned().collect();
    let (history, warnings) = history_warnings(
        root,
        &operation.collection,
        &parsed.index().entries,
        &selected,
    );
    if history != plan.value.evidence.history || warnings != plan.value.evidence.history_warnings {
        return Err(fail("postverify", "historical warning evidence changed"));
    }
    index::QuerySnapshot::new(parsed)
        .graph(&Definition)
        .map_err(|e| fail("postverify", e))?;
    Ok(())
}
fn verify_resources(
    operation: &InvestigationPublishOperation,
    root: &Root,
    plan: &Plan<PreparedPublication>,
) -> Result<(), TxError> {
    let directory = operation
        .collection
        .as_path()
        .to_str()
        .ok_or_else(|| fail("postverify", "collection path is not UTF-8"))?;
    let resource_root = RelativePath::new(operation.collection.as_path().join("_resources"))
        .map_err(|e| fail("postverify", e))?;
    let fact =
        source::capture_resource_root(root, &resource_root).map_err(|e| fail("postverify", e))?;
    let mut context = crate::resources::ResourceContext::open(root, directory, fact.exists())
        .map_err(|e| fail("postverify", e))?;
    verify_selected_resources(&mut context, plan)?;
    if !plan.value.resources.equivalent(&context.into_evidence()) {
        return Err(fail("postverify", "resource facts changed"));
    }
    Ok(())
}

fn verify_selected_resources(
    context: &mut crate::resources::ResourceContext<'_>,
    plan: &Plan<PreparedPublication>,
) -> Result<(), TxError> {
    let issues = context
        .direct_issues(&plan.value.resource_ids)
        .map_err(|e| fail("postverify", e))?;
    if !issues.is_empty() {
        return Err(fail("postverify", issues.join("; ")));
    }
    for (id, refs) in &plan.value.selected_refs {
        context
            .visible_owned(id, refs)
            .map_err(|e| fail("postverify", e))?;
    }
    Ok(())
}
