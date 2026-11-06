use super::*;

fn collect_visible_files(
    root: &Root,
    owner: &RelativePath,
    current: &RelativePath,
    output: &mut Vec<RelativePath>,
) -> Result<(), CommandError> {
    let mut pending = vec![current.clone()];
    while let Some(directory) = pending.pop() {
        let listing = source::enumerate_directory(root, &directory)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        for member in listing.members {
            let path = RelativePath::new(directory.as_path().join(&member.name))
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
            match member.kind {
                MemberKind::Directory => pending.push(path),
                MemberKind::File | MemberKind::Symlink | MemberKind::Other => {
                    let relative = path.as_path().strip_prefix(owner.as_path()).map_err(|_| {
                        CommandError::new("candidate-resource-read-failed", "owner path escaped")
                    })?;
                    output.push(RelativePath::new(relative).map_err(|e| {
                        CommandError::new("candidate-resource-read-failed", e.to_string())
                    })?);
                }
            }
        }
    }
    Ok(())
}

enum OwnerVisibility {
    Single(Option<String>),
    Members(Vec<String>),
}

impl ResourceContext<'_> {
    /// Bind an exact, absent owner to this phase, including an absent root.
    /// A case alias or unsafe component is an error, not evidence of absence.
    pub fn require_owner_absent(&mut self, id: &str) -> Result<(), CommandError> {
        let owner = RelativePath::new(id)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if owner.as_path().components().count() != 1 {
            return Err(CommandError::new(
                "candidate-resource-read-failed",
                "owner must be one path component",
            ));
        }
        self.observed_owners.insert(id.to_owned());
        let Some(base) = &self.relative else {
            return Ok(());
        };
        let fact = source::capture_resource_directories(self.root, base, &owner)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if !self.root_fact.matches_owner_root(&fact) {
            return Err(CommandError::new(
                "source-changed",
                "resource root changed before owner capture",
            ));
        }
        if fact.owner_exists() {
            return Err(CommandError::new(
                "resource-owner-present",
                format!("resource owner still exists: {id}"),
            ));
        }
        self.owner_facts.insert(id.to_owned(), fact);
        Ok(())
    }
    pub fn visible_owned(
        &mut self,
        id: &str,
        referenced: &[String],
    ) -> Result<Vec<(String, Option<String>)>, CommandError> {
        let mut ids = match self.owned_candidates(id)? {
            OwnerVisibility::Single(issue) => return Ok(vec![(id.to_owned(), issue)]),
            OwnerVisibility::Members(ids) => ids,
        };
        let referenced: HashSet<&str> = referenced.iter().map(String::as_str).collect();
        ids.retain(|id| !referenced.contains(id.as_str()));
        ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        let mut output = Vec::new();
        for resource in ids {
            let issue = self.resource_issue(&resource)?;
            output.push((resource, issue));
        }
        Ok(output)
    }

    /// Capture owner membership and bind an empty owner to selected-stat evidence.
    fn owned_candidates(&mut self, id: &str) -> Result<OwnerVisibility, CommandError> {
        let Some(owner_path) = self.capture_owner_path(id)? else {
            return Ok(OwnerVisibility::Members(vec![]));
        };
        let owner = self
            .listing
            .as_ref()
            .and_then(|listing| listing.members.iter().find(|entry| entry.name == id));
        if self.git_members.is_none()
            && let Some(visibility) = non_directory_owner(id, owner.map(|entry| &entry.kind))
        {
            return Ok(visibility);
        }
        let ids = if self.git_members.is_some() {
            self.git_by_owner.get(id).cloned().unwrap_or_default()
        } else if owner.is_some() {
            self.workspace_owner_candidates(id, &owner_path)?
        } else {
            vec![]
        };
        Ok(OwnerVisibility::Members(ids))
    }

    /// Enumerate the visible owner subtree when Git membership is unavailable.
    fn workspace_owner_candidates(
        &mut self,
        id: &str,
        owner_path: &RelativePath,
    ) -> Result<Vec<String>, CommandError> {
        let mut files = Vec::new();
        collect_visible_files(self.root, owner_path, owner_path, &mut files)?;
        if files.is_empty() {
            self.bind_empty_owner(id, owner_path)?;
        }
        Ok(files
            .into_iter()
            .map(|path| {
                format!(
                    "{id}/{}",
                    path.as_path().to_string_lossy().replace('\\', "/")
                )
            })
            .collect())
    }

    fn capture_owner_path(&mut self, id: &str) -> Result<Option<RelativePath>, CommandError> {
        self.observed_owners.insert(id.to_owned());
        let Some(base) = &self.relative else {
            return Ok(None);
        };
        let owner_component = RelativePath::new(id)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let owner_fact = source::capture_resource_directories(self.root, base, &owner_component)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if !self.root_fact.matches_owner_root(&owner_fact) {
            return Err(CommandError::new(
                "source-changed",
                "resource root changed before owner capture",
            ));
        }
        self.owner_facts.insert(id.to_owned(), owner_fact);
        let owner_path = RelativePath::new(base.as_path().join(id))
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        Ok(Some(owner_path))
    }

    fn bind_empty_owner(
        &mut self,
        id: &str,
        owner_path: &RelativePath,
    ) -> Result<(), CommandError> {
        let tree = source::inspect_selected_tree(self.root, owner_path, &[])
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if !self
            .owner_facts
            .get(id)
            .is_some_and(|fact| fact.matches_selected_stat(&tree))
        {
            return Err(CommandError::new(
                "source-changed",
                "resource owner changed before selected stat",
            ));
        }
        self.inspected.insert(format!("owner:{id}"), tree);
        Ok(())
    }
}

/// A visible non-directory owner is reported directly rather than traversed.
fn non_directory_owner(id: &str, kind: Option<&MemberKind>) -> Option<OwnerVisibility> {
    match kind {
        Some(MemberKind::Symlink) => Some(OwnerVisibility::Single(Some(format!(
            "_resources/{id} must not traverse or target a symbolic link"
        )))),
        Some(MemberKind::File) => Some(OwnerVisibility::Single(None)),
        Some(MemberKind::Other) => Some(OwnerVisibility::Single(Some(format!(
            "_resources/{id} must be a regular file"
        )))),
        Some(MemberKind::Directory) | None => None,
    }
}
