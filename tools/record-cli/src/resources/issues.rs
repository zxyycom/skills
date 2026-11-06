use super::*;

impl ResourceContext<'_> {
    pub fn direct_issues(&mut self, ids: &[String]) -> Result<Vec<String>, CommandError> {
        self.capture_missing_membership(!ids.is_empty())?;
        let mut issues = Vec::new();
        for id in ids {
            self.observed_ids.insert(id.clone());
            if !domains::investigation::valid_resource_id(id) {
                issues.push(format!("_resources/{id} must use a safe, normalized resource id with an owner report prefix"));
                continue;
            }
            if let Some(issue) = self.resource_issue(id)? {
                issues.push(issue);
            }
            if self.relative.is_some()
                && self
                    .git_members
                    .as_ref()
                    .is_some_and(|members| !members.contains(id))
            {
                issues.push(format!("_resources/{id} is ignored by version-control rules and is not a managed investigation resource"));
            }
        }
        issues.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        issues.dedup();
        Ok(issues)
    }
    /// Bind missing-root Git membership only when references require it.
    fn capture_missing_membership(&mut self, has_references: bool) -> Result<(), CommandError> {
        if self.relative.is_none() && has_references && !self.missing_membership_checked {
            (self.git_members, self.git_by_owner) =
                membership::capture(self.root, &self.directory)?;
            self.missing_membership_checked = true;
        }
        Ok(())
    }
    /// Full-check unreferenced warnings from this phase's already captured Git
    /// membership; non-Git workspaces inspect their actual resource tree.
    pub fn unreferenced_warnings(
        &mut self,
        referenced: &HashSet<String>,
    ) -> Result<Vec<String>, CommandError> {
        let Some(base) = self.relative.as_ref() else {
            return Ok(Vec::new());
        };
        let (mut ids, mut warnings) = match &self.git_members {
            Some(members) => (members.iter().cloned().collect(), Vec::new()),
            None => scan_workspace_resources(self.root, base)?,
        };
        ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        self.full_visible = Some(ids.clone());
        for id in ids {
            if !referenced.contains(&id) {
                warnings.push(format!("unreferenced visible resource: {id}"));
            }
        }
        Ok(warnings)
    }
}

/// Enumerate a non-Git resource tree while preserving unsafe-entry warnings.
fn scan_workspace_resources(
    root: &Root,
    base: &RelativePath,
) -> Result<(Vec<String>, Vec<String>), CommandError> {
    let mut ids = Vec::new();
    let mut warnings = Vec::new();
    let mut pending = vec![(base.clone(), std::path::PathBuf::new())];
    while let Some((path, relative)) = pending.pop() {
        match source::enumerate_directory(root, &path) {
            Ok(listing) => {
                for member in listing.members {
                    let child_relative = relative.join(&member.name);
                    let child =
                        RelativePath::new(path.as_path().join(&member.name)).map_err(|e| {
                            CommandError::new("candidate-resource-read-failed", e.to_string())
                        })?;
                    match member.kind {
                        MemberKind::Directory => pending.push((child, child_relative)),
                        MemberKind::File => {
                            ids.push(child_relative.to_string_lossy().replace('\\', "/"))
                        }
                        _ => warnings.push(format!(
                            "unsafe unreferenced resource: {}",
                            child_relative.display()
                        )),
                    }
                }
            }
            Err(error) => warnings.push(format!(
                "resource directory could not be inspected: {error}"
            )),
        }
    }
    Ok((ids, warnings))
}
