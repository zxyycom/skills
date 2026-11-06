use super::*;

impl TransactionOperation<PreparedEvolution> for DecisionEvolutionOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedEvolution>, TxError> {
        self.phase(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedEvolution>) -> Result<(), TxError> {
        let now = self.phase(root)?;
        if plan.value.evidence != now.value.evidence
            || plan.value.review != now.value.review
            || !same_writes(&plan.writes, &now.writes)
            || !same_guards(&plan.guards, &now.guards)
            || !same_resources(&plan.resources, &now.resources)
        {
            return Err(fail("source-changed", "evolution inputs changed"));
        }
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedEvolution>) -> Result<(), TxError> {
        verify_writes(root, plan)?;
        verify_guards(root, plan)?;
        verify_index(self, root, plan)
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedEvolution>,
    ) -> Result<(), TxError> {
        for write in &plan.writes {
            match (
                &write.before,
                source::capture(root, &write.path).map_err(|e| fail("recovery", e))?,
            ) {
                (ExpectedFile::Missing, ExpectedFile::Missing) => {}
                (ExpectedFile::Present(before), ExpectedFile::Present(after))
                    if before.bytes == after.bytes
                        && before.identity.mode == after.identity.mode => {}
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
        && a.iter().zip(b).all(|(a, b)| {
            a.path == b.path
                && a.before == b.before
                && a.after == b.after
                && same_mode(&a.mode, &b.mode)
        })
}
fn same_guards(a: &[crate::transaction::Guard], b: &[crate::transaction::Guard]) -> bool {
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|(a, b)| a.path == b.path && a.before == b.before)
}
fn verify_writes(root: &Root, plan: &Plan<PreparedEvolution>) -> Result<(), TxError> {
    for write in &plan.writes {
        match (
            &write.after,
            source::capture(root, &write.path).map_err(|e| fail("postverify", e))?,
        ) {
            (None, ExpectedFile::Missing) => {}
            (Some(expected), ExpectedFile::Present(actual)) if *expected == actual.bytes => {
                if let Some(WriteMode::Exact(mode)) = write.mode {
                    #[cfg(unix)]
                    let actual_mode = actual.identity.mode & 0o7777;
                    #[cfg(not(unix))]
                    let actual_mode = actual.identity.mode;
                    if mode != actual_mode {
                        return Err(fail("postverify", "mode changed"));
                    }
                }
            }
            _ => {
                return Err(fail(
                    "postverify",
                    format!("unexpected source: {}", write.path.as_path().display()),
                ));
            }
        }
    }
    Ok(())
}
fn verify_guards(root: &Root, plan: &Plan<PreparedEvolution>) -> Result<(), TxError> {
    for guard in &plan.guards {
        if source::capture(root, &guard.path).map_err(|e| fail("postverify", e))? != guard.before {
            return Err(fail("postverify", "dependency changed"));
        }
    }
    Ok(())
}

fn verify_index(
    operation: &DecisionEvolutionOperation,
    root: &Root,
    plan: &Plan<PreparedEvolution>,
) -> Result<(), TxError> {
    let ExpectedFile::Present(file) =
        source::capture(root, &path(&operation.collection, "decision-index.json")?)
            .map_err(|e| fail("postverify", e))?
    else {
        return Err(fail("postverify", "index missing"));
    };
    let index = index::parse_index(&file.bytes, &Definition).map_err(|e| fail("postverify", e))?;
    index::QuerySnapshot::new(index.clone())
        .graph(&Definition)
        .map_err(|e| fail("postverify", e))?;
    for write in &plan.writes {
        if write.after.is_none()
            || write.path == path(&operation.collection, "decision-index.json")?
        {
            continue;
        }
        let Some((id, state)) = index.index().entries.iter().find(|(_, state)| {
            path(&operation.collection, &state.source_path).is_ok_and(|p| p == write.path)
        }) else {
            return Err(fail("postverify", "written record missing from index"));
        };
        validate_source(
            root,
            &operation.collection,
            id,
            state,
            &index.index().source_revision.entries[id],
        )
        .map_err(|e| fail("postverify", e))?;
    }
    Ok(())
}
