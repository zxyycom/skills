use super::*;

/// Check one safely captured owner tree against that owner's direct declarations.
/// This is only a phase-local owner proof, not proof for other owners, Git
/// membership, freshness, or the complete resource readiness decision.
pub fn validate_owner_tree(
    root: &crate::source::Root,
    expected_owner_path: &crate::source::RelativePath,
    owner_id: &str,
    tree: &crate::source::TreeSnapshot,
    declared_ids: &[String],
) -> Result<(), Vec<String>> {
    if !is_kebab(owner_id)
        || expected_owner_path
            .as_path()
            .file_name()
            .and_then(|v| v.to_str())
            != Some(owner_id)
        || !tree.belongs_to(root, expected_owner_path)
    {
        return Err(vec![
            "resource tree does not match selected owner and root".into(),
        ]);
    }
    let prefix = format!("{owner_id}/");
    let declared: std::collections::HashSet<&str> = declared_ids
        .iter()
        .filter_map(|id| id.starts_with(&prefix).then_some(id.as_str()))
        .collect();
    let ObservedResources { files, mut errors } =
        observe_files(tree, expected_owner_path, owner_id, &declared);
    for id in declared {
        if !files.contains(id) {
            errors.push(format!("declared owner resource is missing: {id}"));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        errors.sort();
        Err(errors)
    }
}

struct ObservedResources {
    files: std::collections::HashSet<String>,
    errors: Vec<String>,
}
fn observe_files(
    tree: &crate::source::TreeSnapshot,
    expected_owner_path: &crate::source::RelativePath,
    owner_id: &str,
    declared: &std::collections::HashSet<&str>,
) -> ObservedResources {
    use crate::source::TreeEntry;
    let mut files = std::collections::HashSet::new();
    let mut errors = Vec::new();
    for entry in tree.entries() {
        if let TreeEntry::File { path, .. } = entry {
            let Ok(relative) = path.as_path().strip_prefix(expected_owner_path.as_path()) else {
                errors.push("resource entry escaped selected owner".into());
                continue;
            };
            let Some(components) = relative
                .components()
                .map(|c| c.as_os_str().to_str())
                .collect::<Option<Vec<_>>>()
            else {
                errors.push("resource entry path is not UTF-8".into());
                continue;
            };
            let id = format!("{owner_id}/{}", components.join("/"));
            if !valid_resource_id(&id) {
                errors.push(format!("invalid resource path: {id}"));
            }
            if !declared.contains(id.as_str()) {
                errors.push(format!("owner does not directly reference resource: {id}"));
            }
            files.insert(id);
        }
    }
    ObservedResources { files, errors }
}
