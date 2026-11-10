use super::*;

impl ResourceContext<'_> {
    fn exact_path(&mut self, id: &str) -> Result<bool, CommandError> {
        let Some(base) = self.relative.as_ref() else {
            return Ok(false);
        };
        let mut directory = base.as_path().to_path_buf();
        let parts: Vec<_> = id.split('/').collect();
        for (index, part) in parts.iter().enumerate() {
            let Some(kind) = self.resolve_component(&directory, part, id)? else {
                return Ok(false);
            };
            validate_component(id, part, &kind, index + 1 == parts.len())?;
            directory.push(part);
        }
        Ok(true)
    }
    /// Resolve exact spelling and report a mismatched resource reference.
    fn resolve_component(
        &mut self,
        directory: &std::path::Path,
        part: &str,
        id: &str,
    ) -> Result<Option<MemberKind>, CommandError> {
        self.refresh_missing_component(directory, part)?;
        let path = RelativePath::new(directory.join(part))
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let facts = &self.directories[directory];
        if facts.exact.contains(part) {
            return source::resource_member_kind(self.root, &path)
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()));
        }
        if let Some(actual) = facts.folded.get(&part.to_lowercase()) {
            return Err(CommandError::new(
                "resource-case-mismatch",
                format!(
                    "_resources/{id} must match actual path casing; found {}",
                    serde_json::to_string(actual).unwrap_or_default()
                ),
            ));
        }
        Ok(None)
    }
    /// Refresh stale namespace observations when the requested name exists.
    fn refresh_missing_component(
        &mut self,
        directory: &std::path::Path,
        part: &str,
    ) -> Result<(), CommandError> {
        let path = RelativePath::new(directory.join(part))
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let facts = self.observe_directory(directory)?;
        let listed = facts.exact.contains(part);
        #[cfg(windows)]
        let folded = facts.folded.get(&part.to_lowercase()).cloned();
        // Directory timestamps can collide on filesystems with coarse clocks. A
        // selected member absent from cached names may nevertheless exist.
        if !listed
            && source::resource_member_kind(self.root, &path)
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?
                .is_some()
        {
            #[cfg(windows)]
            let same_alias = folded.as_ref().is_some_and(|actual| {
                RelativePath::new(directory.join(actual)).is_ok_and(|actual_path| {
                    source::same_single_link_member(self.root, &path, &actual_path)
                })
            });
            #[cfg(not(windows))]
            let same_alias = false;
            if !same_alias {
                self.directories.remove(directory);
                self.observe_directory(directory)?;
            }
        }
        Ok(())
    }
    fn observe_directory(
        &mut self,
        directory: &std::path::Path,
    ) -> Result<&DirectoryFacts, CommandError> {
        let relative = RelativePath::new(directory)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let before = source::resource_directory_version(self.root, &relative)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let reusable = before.is_some()
            && self
                .directories
                .get(directory)
                .is_some_and(|facts| facts.version == before);
        if !reusable {
            #[cfg(test)]
            {
                self.directory_enumerations += 1;
            }
            let listing = source::enumerate_directory(self.root, &relative)
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
            let after = source::resource_directory_version(self.root, &relative)
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
            if before != after {
                return Err(CommandError::new(
                    "candidate-resource-read-failed",
                    "resource directory changed during observation",
                ));
            }
            self.directories
                .insert(directory.to_path_buf(), DirectoryFacts::new(listing, after));
        }
        Ok(&self.directories[directory])
    }
    pub(super) fn inspect(&mut self, id: &str) -> Result<bool, CommandError> {
        if let Some(value) = self.checked.get(id) {
            return Ok(*value);
        }
        let Some(_) = &self.relative else {
            self.checked.insert(id.into(), false);
            return Ok(false);
        };
        if !self.exact_path(id)? {
            self.checked.insert(id.into(), false);
            return Ok(false);
        }
        self.checked.insert(id.into(), true);
        Ok(true)
    }

    /// User-correctable resource problems are issues; read failures remain errors.
    pub(super) fn resource_issue(&mut self, id: &str) -> Result<Option<String>, CommandError> {
        match self.inspect(id) {
            Ok(true) => Ok(None),
            Ok(false) => Ok(Some(format!("_resources/{id} does not exist"))),
            Err(error)
                if matches!(
                    error.code.as_ref(),
                    "resource-symlink" | "resource-nonregular" | "resource-case-mismatch"
                ) =>
            {
                Ok(Some(error.message))
            }
            Err(error) => Err(error),
        }
    }
}

/// A resource path cannot traverse a symlink or a non-directory component.
fn validate_component(
    id: &str,
    part: &str,
    kind: &MemberKind,
    last: bool,
) -> Result<(), CommandError> {
    if *kind == MemberKind::Symlink {
        return Err(CommandError::new(
            "resource-symlink",
            format!("_resources/{id} must not traverse or target a symbolic link"),
        ));
    }
    if last && *kind != MemberKind::File {
        return Err(CommandError::new(
            "resource-nonregular",
            format!("_resources/{id} must be a regular file"),
        ));
    }
    if !last && *kind != MemberKind::Directory {
        return Err(CommandError::new(
            "resource-nonregular",
            format!(
                "_resources/{id} has a non-directory path component {}",
                serde_json::to_string(part).unwrap_or_default()
            ),
        ));
    }
    Ok(())
}
