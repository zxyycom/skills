use super::*;

pub(super) struct OwnerFacts<'a> {
    pub context: crate::resources::ResourceContext<'a>,
    pub owner: RelativePath,
    pub present: bool,
    pub tree: OwnerTree,
}

impl InvestigationIdentityOperation {
    pub(super) fn capture_owner<'a>(
        &'a self,
        root: &'a Root,
        listing: &source::DirectorySnapshot,
        id: &str,
    ) -> Result<OwnerFacts<'a>, TxError> {
        let directory = self
            .collection
            .as_path()
            .to_str()
            .ok_or_else(|| fail("path", "non-Unicode collection"))?;
        let has_resources = listing.members.iter().any(|m| m.name == "_resources");
        let mut resources = crate::resources::ResourceContext::open(root, directory, has_resources)
            .map_err(|e| fail("resource", e))?;
        let owner = rel(&self.collection, &format!("_resources/{id}"))?;
        let present = owner_present(root, &self.collection, id, has_resources)?;
        let tree = if present {
            capture_owned_tree(root, &owner, id, &mut resources)?
        } else {
            resources
                .require_owner_absent(id)
                .map_err(|e| fail("resource-owner", e))?;
            Vec::new()
        };
        Ok(OwnerFacts {
            context: resources,
            owner,
            present,
            tree,
        })
    }
}

fn owner_present(
    root: &Root,
    collection: &RelativePath,
    id: &str,
    has_resources: bool,
) -> Result<bool, TxError> {
    if !has_resources {
        return Ok(false);
    }
    let listing = source::enumerate_directory(root, &rel(collection, "_resources")?)
        .map_err(|e| fail("resource", e))?;
    Ok(listing.members.iter().any(|m| m.name == id))
}

pub(super) fn resource_id(
    owner: &RelativePath,
    id: &str,
    path: &RelativePath,
) -> Result<String, TxError> {
    let suffix = path
        .as_path()
        .strip_prefix(owner.as_path())
        .map_err(|e| fail("resource", e))?;
    let components = suffix
        .components()
        .map(|v| v.as_os_str().to_str())
        .collect::<Option<Vec<_>>>()
        .ok_or_else(|| fail("resource", "non-Unicode resource name"))?;
    let resource_id = format!("{id}/{}", components.join("/"));
    if !investigation::valid_resource_id(&resource_id) {
        return Err(fail(
            "resource",
            format!("invalid resource path: {resource_id}"),
        ));
    }
    Ok(resource_id)
}

fn capture_owned_tree(
    root: &Root,
    owner: &RelativePath,
    id: &str,
    resources: &mut crate::resources::ResourceContext<'_>,
) -> Result<OwnerTree, TxError> {
    let captured = source::capture_tree(root, owner).map_err(|e| fail("resource", e))?;
    let mut own_ids = Vec::new();
    for entry in captured.entries() {
        if let source::TreeEntry::File { path, .. } = entry {
            own_ids.push(resource_id(owner, id, path)?);
        }
    }
    let issues = resources
        .direct_issues(&own_ids)
        .map_err(|e| fail("resource", e))?;
    if !issues.is_empty() {
        return Err(fail("resource", issues.join("; ")));
    }
    let unexpected = resources
        .visible_owned(id, &own_ids)
        .map_err(|e| fail("resource", e))?;
    if !unexpected.is_empty() {
        return Err(fail(
            "resource",
            format!("unaccounted owner members: {unexpected:?}"),
        ));
    }
    Ok(captured
        .entries()
        .iter()
        .map(|entry| match entry {
            source::TreeEntry::Directory { path } => (path.clone(), false),
            source::TreeEntry::File { path } => (path.clone(), true),
        })
        .collect())
}
