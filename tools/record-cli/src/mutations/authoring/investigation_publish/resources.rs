use super::*;

pub(super) struct ResourceCheck<'a> {
    pub root: &'a Root,
    pub directory: &'a str,
    pub selected_refs: &'a HashMap<String, Vec<String>>,
}
impl ResourceCheck<'_> {
    pub fn verify(self, warnings: &mut Vec<String>) -> Result<(), TxError> {
        let Self {
            root,
            directory,
            selected_refs,
        } = self;
        let exists =
            crate::resources::root_exists(root, directory).map_err(|e| fail("resources", e))?;
        let mut resource_context = crate::resources::ResourceContext::open(root, directory, exists)
            .map_err(|e| fail("resources", e))?;
        let mut resource_ids: Vec<String> = selected_refs.values().flatten().cloned().collect();
        resource_ids.sort();
        resource_ids.dedup();
        let issues = resource_context
            .direct_issues(&resource_ids)
            .map_err(|e| fail("resources", e))?;
        if !issues.is_empty() {
            return Err(fail("resource-invalid", issues.join("; ")));
        }
        for (id, refs) in selected_refs {
            let visible = resource_context
                .visible_owned(id, refs)
                .map_err(|e| fail("resources", e))?;
            for (resource, issue) in visible {
                warnings.push(format!(
                    "candidate owner resource is not directly referenced: _resources/{resource}{}",
                    issue
                        .map(|detail| format!("; {detail}"))
                        .unwrap_or_default()
                ));
            }
        }
        warnings.sort();
        warnings.dedup();
        Ok(())
    }
}
