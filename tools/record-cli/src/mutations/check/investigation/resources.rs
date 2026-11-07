use super::*;

pub(super) struct ResourceReview<'a> {
    pub root: &'a Root,
    pub directory: &'a str,
    pub states: &'a BTreeMap<String, domains::investigation::InvestigationState>,
    pub candidate_refs: &'a HashSet<String>,
    pub candidate_owners: &'a BTreeMap<String, Vec<String>>,
    pub resource_root_unsafe: bool,
    pub resources_exist: bool,
}

impl<'a> ResourceReview<'a> {
    pub fn verify(
        &self,
        diagnostics: &mut Vec<CheckError>,
        warnings: &mut Vec<String>,
    ) -> Result<(), CheckError> {
        let Self {
            states,
            candidate_refs,
            resources_exist,
            ..
        } = self;
        let resources_exist = *resources_exist;
        let formal_refs: HashSet<String> = states
            .values()
            .flat_map(|state| state.resource_ids.iter().cloned())
            .collect();
        let mut resource_context = self.formal_context(&formal_refs, diagnostics, warnings)?;
        self.candidate_warnings(&mut resource_context, warnings);
        if resources_exist && diagnostics.is_empty() {
            let mut all_references = formal_refs;
            all_references.extend(candidate_refs.iter().cloned());
            warnings.extend(
                resource_context
                    .as_mut()
                    .expect("safe existing resource context")
                    .unreferenced_warnings(&all_references)
                    .map_err(|e| error("resource-read", "_resources", e.to_string()))?,
            );
        }
        Ok(())
    }
    fn formal_context(
        &self,
        formal_refs: &HashSet<String>,
        diagnostics: &mut Vec<CheckError>,
        warnings: &mut Vec<String>,
    ) -> Result<Option<crate::resources::ResourceContext<'a>>, CheckError> {
        if self.resource_root_unsafe {
            if !formal_refs.is_empty() {
                diagnostics.push(error(
                    "resource-invalid",
                    "_resources",
                    "referenced resource root is unsafe",
                ));
            } else {
                warnings.push("unreferenced resource root is unsafe".into());
            }
        }
        let ids: Vec<String> = formal_refs.iter().cloned().collect();
        let mut resource_context = if self.resource_root_unsafe {
            None
        } else {
            Some(
                crate::resources::ResourceContext::open(
                    self.root,
                    self.directory,
                    self.resources_exist,
                )
                .map_err(|e| error("resource-read", "_resources", e.to_string()))?,
            )
        };
        if let Some(context) = &mut resource_context {
            match context.direct_issues(&ids) {
                Ok(issues) => diagnostics.extend(
                    issues
                        .into_iter()
                        .map(|message| error("resource-invalid", "_resources", message)),
                ),
                Err(e) => diagnostics.push(error("resource-read", "_resources", e.to_string())),
            }
        }
        Ok(resource_context)
    }
    fn candidate_warnings(
        &self,
        resource_context: &mut Option<crate::resources::ResourceContext<'_>>,
        warnings: &mut Vec<String>,
    ) {
        for resource in self.candidate_refs {
            let Some((owner, _)) = resource.split_once('/') else {
                continue;
            };
            let owned = self
                .states
                .get(owner)
                .is_some_and(|state| state.resource_ids.contains(resource))
                || self
                    .candidate_owners
                    .get(owner)
                    .is_some_and(|resources| resources.contains(resource));
            if !owned {
                warnings.push(format!(
                    "candidate resource {resource} has no direct owner declaration"
                ));
            }
        }
        if !self.candidate_refs.is_empty() {
            let candidate_ids: Vec<String> = self.candidate_refs.iter().cloned().collect();
            match resource_context
                .as_mut()
                .map(|context| context.direct_issues(&candidate_ids))
            {
                None => warnings.push("candidate resource root is unsafe".into()),
                Some(Ok(issues)) => warnings.extend(
                    issues
                        .into_iter()
                        .map(|issue| format!("candidate resource: {issue}")),
                ),
                Some(Err(error)) => warnings.push(format!("candidate resource: {error}")),
            }
        }
    }
}
