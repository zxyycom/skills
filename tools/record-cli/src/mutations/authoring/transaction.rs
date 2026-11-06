use super::*;

impl TransactionOperation<PreparedNew> for NewOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedNew>, TxError> {
        self.prepare_phase(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedNew>) -> Result<(), TxError> {
        let fresh = self.prepare_phase(root)?;
        let resources_equal = match (
            &plan.value.resource_evidence,
            &fresh.value.resource_evidence,
        ) {
            (Some(a), Some(b)) => a.equivalent(b),
            (None, None) => true,
            _ => false,
        };
        if !resources_equal
            || plan.value.evidence != fresh.value.evidence
            || plan.writes[0].path != fresh.writes[0].path
            || plan.writes[0].before != fresh.writes[0].before
            || plan.writes[0].after != fresh.writes[0].after
        {
            return Err(err(
                "source-changed",
                "candidate selection changed before creation",
            ));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedNew>) -> Result<(), TxError> {
        verify_created(root, plan)?;
        verify_identities(self, root, plan)?;
        verify_resources(self, root, plan)
    }
    fn verify_recovered(&mut self, root: &Root, plan: &Plan<PreparedNew>) -> Result<(), TxError> {
        if source::capture(root, &plan.writes[0].path).map_err(|e| err("recovery", e))?
            == ExpectedFile::Missing
        {
            Ok(())
        } else {
            Err(err("recovery", "candidate remains"))
        }
    }
}

fn verify_created(root: &Root, plan: &Plan<PreparedNew>) -> Result<(), TxError> {
    match source::capture(root, &plan.writes[0].path).map_err(|e| err("postverify", e))? {
        ExpectedFile::Present(f) if Some(&f.bytes) == plan.writes[0].after.as_ref() => {}
        _ => return Err(err("postverify", "created candidate differs")),
    }
    Ok(())
}
fn verify_identities(
    operation: &NewOperation,
    root: &Root,
    plan: &Plan<PreparedNew>,
) -> Result<(), TxError> {
    let directory = operation
        .collection
        .as_path()
        .to_str()
        .ok_or_else(|| err("postverify", "collection path is not UTF-8"))?;
    let discovered = match &operation.input {
        NewInput::Decision { .. } => candidate_discovery::decisions(root, directory),
        NewInput::Investigation { .. } => candidate_discovery::investigations(root, directory),
    }
    .map_err(|e| err(&e.code, &e.message))?;
    if discovered
        .items
        .get(&operation.id)
        .is_none_or(|item| item.path != plan.value.source_path)
    {
        return Err(err(
            "postverify",
            "created identity is not uniquely discoverable",
        ));
    }
    verify_existing_identities(operation, plan, &discovered)
}
fn verify_resources(
    operation: &NewOperation,
    root: &Root,
    plan: &Plan<PreparedNew>,
) -> Result<(), TxError> {
    if let Some(expected) = &plan.value.resource_evidence {
        verify_existing_resources(operation, root, expected)?;
    } else if matches!(operation.input, NewInput::Investigation { .. }) {
        let resource_root = RelativePath::new(operation.collection.as_path().join("_resources"))
            .map_err(|e| err("postverify", e))?;
        if source::capture_resource_root(root, &resource_root)
            .map_err(|e| err("postverify", e))?
            .exists()
        {
            return Err(err("postverify", "resource root appeared during creation"));
        }
    }
    Ok(())
}

fn verify_existing_resources(
    operation: &NewOperation,
    root: &Root,
    expected: &crate::resources::ResourceEvidence,
) -> Result<(), TxError> {
    let directory = operation
        .collection
        .as_path()
        .to_str()
        .ok_or_else(|| err("postverify", "collection path is not UTF-8"))?;
    let resource_root = RelativePath::new(operation.collection.as_path().join("_resources"))
        .map_err(|e| err("postverify", e))?;
    let root_fact =
        source::capture_resource_root(root, &resource_root).map_err(|e| err("postverify", e))?;
    let mut context = crate::resources::ResourceContext::open(root, directory, root_fact.exists())
        .map_err(|e| err("postverify", e))?;
    context
        .visible_owned(&operation.id, &[])
        .map_err(|e| err("postverify", e))?;
    if !expected.equivalent(&context.into_evidence()) {
        return Err(err("postverify", "resource readiness facts changed"));
    }
    Ok(())
}

fn verify_existing_identities(
    operation: &NewOperation,
    plan: &Plan<PreparedNew>,
    discovered: &candidate_discovery::Candidates,
) -> Result<(), TxError> {
    let current: Vec<_> = discovered
        .items
        .iter()
        .filter(|(id, _)| *id != &operation.id)
        .map(|(id, item)| (id.clone(), item.path.clone()))
        .collect();
    let previous: Vec<_> = plan
        .value
        .evidence
        .candidates
        .iter()
        .map(|(id, path, _)| (id.clone(), path.clone()))
        .collect();
    if current != previous {
        return Err(err(
            "postverify",
            "candidate identities changed during creation",
        ));
    }
    Ok(())
}
