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
    /// Resolve exact spelling while recording name-membership evidence.
    fn resolve_component(
        &mut self,
        directory: &std::path::Path,
        part: &str,
        id: &str,
    ) -> Result<Option<MemberKind>, CommandError> {
        let listing = self.observe_directory(directory)?;
        let entries = listing.members;
        let exact = entries.iter().find(|entry| entry.name == part);
        let folded = entries
            .iter()
            .find(|entry| entry.name.to_lowercase() == part.to_lowercase());
        let resolved = exact.or(folded).map(|entry| entry.name.clone());
        let key = (directory.to_path_buf(), part.to_owned());
        if self
            .directory_requested
            .get(&key)
            .is_some_and(|old| old != &resolved)
        {
            return Err(CommandError::new(
                "candidate-resource-read-failed",
                "resource directory membership changed during validation",
            ));
        }
        self.directory_requested.insert(key, resolved);
        let Some(entry) = exact else {
            if let Some(actual) = folded {
                return Err(CommandError::new(
                    "resource-case-mismatch",
                    format!(
                        "_resources/{id} must match actual path casing; found {}",
                        serde_json::to_string(&actual.name).unwrap_or_default()
                    ),
                ));
            }
            return Ok(None);
        };
        Ok(Some(entry.kind.clone()))
    }
    /// Retain the directory identity observed while resolving resource names.
    fn observe_directory(
        &mut self,
        directory: &std::path::Path,
    ) -> Result<source::DirectorySnapshot, CommandError> {
        let relative = RelativePath::new(directory)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let listing = source::enumerate_directory(self.root, &relative)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        if let Some(old) = self.directory_facts.get(directory) {
            if old.identity != listing.identity
                || old.parents != listing.parents
                || old.parent_paths != listing.parent_paths
            {
                return Err(CommandError::new(
                    "candidate-resource-read-failed",
                    "resource directory identity changed during validation",
                ));
            }
        } else {
            self.directory_facts
                .insert(directory.to_path_buf(), copy_directory_snapshot(&listing));
        }
        Ok(listing)
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
            let base = self.relative.as_ref().expect("resource root was checked");
            let path = RelativePath::new(base.as_path().join(id))
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
            let proof = source::capture_missing(self.root, &path)
                .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
            self.missing_facts.insert(id.to_owned(), proof);
            self.checked.insert(id.into(), false);
            return Ok(false);
        }
        let exists = self.inspect_present(id)?;
        self.checked.insert(id.into(), exists);
        Ok(exists)
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

    /// Capture a present resource and prove that its owner and selected path stayed bound.
    fn inspect_present(&mut self, id: &str) -> Result<bool, CommandError> {
        let base = self.relative.as_ref().expect("resource root was checked");
        let (owner, member) = id.split_once('/').ok_or_else(|| {
            CommandError::new("candidate-resource-read-failed", "invalid resource ID")
        })?;
        let owner_entry = self
            .listing
            .as_ref()
            .and_then(|listing| listing.members.iter().find(|entry| entry.name == owner));
        let Some(entry) = owner_entry else {
            return Ok(false);
        };
        if entry.kind == MemberKind::Symlink {
            return Err(CommandError::new(
                "resource-symlink",
                format!("_resources/{id} must not traverse or target a symbolic link"),
            ));
        }
        if entry.kind != MemberKind::Directory {
            return Err(CommandError::new(
                "resource-nonregular",
                format!(
                    "_resources/{id} has a non-directory path component {}",
                    serde_json::to_string(owner).unwrap_or_default()
                ),
            ));
        }
        let owner_path = RelativePath::new(base.as_path().join(owner))
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let member = RelativePath::new(member)
            .map_err(|e| CommandError::new("candidate-resource-read-failed", e.to_string()))?;
        let required_dirs = lookup_directories(base, id);
        let expected_path = owner_path.as_path().join(member.as_path());
        let tree = source::inspect_selected_tree(self.root, &owner_path, &[member])
            .map_err(|error| resource_stat_error(id, &expected_path, error))?;
        self.verify_selected_parents(&tree, &required_dirs)?;
        let exists = tree
            .entries()
            .iter()
            .all(|entry| matches!(entry, source::SelectedStatMember::Present { .. }));
        self.inspected.insert(id.to_owned(), tree);
        Ok(exists)
    }
    /// Bind selected-stat ancestry to the directory identities observed by name lookup.
    fn verify_selected_parents(
        &self,
        tree: &source::SelectedStatTree,
        required_dirs: &[std::path::PathBuf],
    ) -> Result<(), CommandError> {
        for entry in tree.entries() {
            let source::SelectedStatMember::Present {
                parents,
                parent_paths,
                ..
            } = entry
            else {
                return Err(CommandError::new(
                    "source-changed",
                    "resource disappeared between name lookup and selected stat",
                ));
            };
            for directory in required_dirs {
                self.verify_directory_fact(directory, parents, parent_paths)?;
            }
        }
        Ok(())
    }

    /// Match one lookup directory to the corresponding selected-stat parent identity.
    fn verify_directory_fact(
        &self,
        directory: &std::path::Path,
        parents: &[source::FileIdentity],
        parent_paths: &[RelativePath],
    ) -> Result<(), CommandError> {
        let fact = self.directory_facts.get(directory).ok_or_else(|| {
            CommandError::new(
                "candidate-resource-read-failed",
                "resource directory proof is missing",
            )
        })?;
        let path = fact.parent_paths.last().ok_or_else(|| {
            CommandError::new(
                "candidate-resource-read-failed",
                "resource directory path proof is missing",
            )
        })?;
        let index = parent_paths
            .iter()
            .position(|candidate| candidate == path)
            .ok_or_else(|| {
                CommandError::new(
                    "candidate-resource-read-failed",
                    "resource directory path changed before selected stat",
                )
            })?;
        if parents.get(index + 1) != Some(&fact.identity) {
            return Err(CommandError::new(
                "candidate-resource-read-failed",
                "resource directory changed between name lookup and selected stat",
            ));
        }
        Ok(())
    }
}

/// Directory prefixes whose earlier name lookups must match selected-stat ancestry.
fn lookup_directories(base: &RelativePath, id: &str) -> Vec<std::path::PathBuf> {
    let mut required_dirs = Vec::new();
    let mut prefix = base.as_path().to_path_buf();
    required_dirs.push(prefix.clone());
    let parts: Vec<_> = id.split('/').collect();
    for part in parts.iter().take(parts.len().saturating_sub(1)) {
        prefix.push(part);
        required_dirs.push(prefix.clone());
    }
    required_dirs
}

/// Translate filesystem stat failures to the resource contract's actionable diagnostics.
fn resource_stat_error(
    id: &str,
    expected_path: &std::path::Path,
    error: source::SourceError,
) -> CommandError {
    match error {
        source::SourceError::Symlink(_) => CommandError::new(
            "resource-symlink",
            format!("_resources/{id} must not traverse or target a symbolic link"),
        ),
        source::SourceError::NonRegular(path) => {
            let reason = if path == expected_path {
                format!("_resources/{id} must be a regular file")
            } else {
                let part = path
                    .file_name()
                    .and_then(|part| part.to_str())
                    .unwrap_or("");
                format!(
                    "_resources/{id} has a non-directory path component {}",
                    serde_json::to_string(part).unwrap_or_default()
                )
            };
            CommandError::new("resource-nonregular", reason)
        }
        other => CommandError::new("candidate-resource-read-failed", other.to_string()),
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
