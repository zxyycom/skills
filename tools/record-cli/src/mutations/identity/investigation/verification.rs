use super::*;

fn verify_tree(
    root: &Root,
    original: &RelativePath,
    destination: &RelativePath,
    expected: &[(RelativePath, source::FileIdentity, Option<Vec<u8>>)],
) -> Result<(), TxError> {
    let actual = source::capture_tree(root, destination).map_err(|e| fail("resource-verify", e))?;
    if actual.entries().len() != expected.len() {
        return Err(fail("resource-verify", "owner tree membership changed"));
    }
    for (path, identity, bytes) in expected {
        let suffix = path
            .as_path()
            .strip_prefix(original.as_path())
            .map_err(|e| fail("resource-verify", e))?;
        let wanted = RelativePath::new(if suffix.as_os_str().is_empty() {
            destination.as_path().to_path_buf()
        } else {
            destination.as_path().join(suffix)
        })
        .map_err(|e| fail("resource-verify", e))?;
        let found = actual
            .entries()
            .iter()
            .any(|item| tree_entry_matches(item, &wanted, identity, bytes.as_deref()));
        if !found {
            return Err(fail("resource-verify", wanted.as_path().display()));
        }
    }
    Ok(())
}
fn tree_entry_matches(
    item: &source::TreeEntry,
    wanted: &RelativePath,
    identity: &source::FileIdentity,
    bytes: Option<&[u8]>,
) -> bool {
    match (item, bytes) {
        (
            source::TreeEntry::Directory {
                path,
                identity: observed,
            },
            None,
        ) => path == wanted && observed.mode == identity.mode,
        (
            source::TreeEntry::File {
                path,
                identity: observed,
                bytes: actual,
            },
            Some(expected),
        ) => path == wanted && observed.mode == identity.mode && actual == expected,
        _ => false,
    }
}
impl InvestigationIdentityOperation {
    fn verify_owner(&self, root: &Root, value: &PreparedIdentity) -> Result<(), TxError> {
        if value.evidence.tree.is_empty() {
            return Ok(());
        }
        let original = rel(&self.collection, &format!("_resources/{}", value.old_id))?;
        if value.owner_moved {
            let destination = rel(
                &self.collection,
                &format!(
                    "_resources/{}",
                    value.new_id.as_ref().expect("moved owner has ID")
                ),
            )?;
            verify_tree(root, &original, &destination, &value.evidence.tree)?;
        } else if value.new_id.is_some() {
            return verify_tree(root, &original, &original, &value.evidence.tree);
        }
        self.require_owner_absent(root, &value.old_id)?;
        Ok(())
    }
    fn require_owner_absent(&self, root: &Root, id: &str) -> Result<(), TxError> {
        let directory = self
            .collection
            .as_path()
            .to_str()
            .ok_or_else(|| fail("postverify", "non-Unicode collection"))?;
        let mut context = crate::resources::ResourceContext::open(root, directory, true)
            .map_err(|e| fail("postverify", e))?;
        context
            .require_owner_absent(id)
            .map_err(|e| fail("postverify", e))?;
        Ok(())
    }
}
impl TransactionOperation<PreparedIdentity> for InvestigationIdentityOperation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        self.phase(root)
    }
    fn fresh(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        let now = self.phase(root)?;
        super::super::verify_fresh(
            plan.value.evidence.equivalent(&now.value.evidence),
            plan,
            &now,
        )?;
        Ok(())
    }
    fn verify(&mut self, root: &Root, plan: &Plan<PreparedIdentity>) -> Result<(), TxError> {
        super::super::verify_written_files(root, plan)?;
        self.verify_owner(root, &plan.value)?;
        if !plan.value.candidate && !plan.value.no_change {
            super::super::verify_published_index(root, &self.index_path, &Definition)?;
        }
        Ok(())
    }
    fn verify_recovered(
        &mut self,
        root: &Root,
        plan: &Plan<PreparedIdentity>,
    ) -> Result<(), TxError> {
        super::super::verify_recovered_files(root, plan)?;
        if !plan.value.evidence.tree.is_empty() {
            let original = rel(
                &self.collection,
                &format!("_resources/{}", plan.value.old_id),
            )?;
            verify_tree(root, &original, &original, &plan.value.evidence.tree)?;
        }
        Ok(())
    }
}
