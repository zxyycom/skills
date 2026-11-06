use super::*;

pub fn investigations(root: &Root, directory: &str) -> Result<Candidates, CommandError> {
    let DiscoveryInputs {
        dir,
        listing: members,
        published,
    } = discovery_inputs(
        root,
        directory,
        "investigation-index.json",
        &domains::investigation::Definition,
    )?;
    let mut registry = CandidateRegistry::new(
        published_paths(published.as_ref(), |state| &state.source_path),
        published.is_none(),
    );
    let formal_resources = published
        .as_ref()
        .map(|index| {
            index
                .index()
                .entries
                .iter()
                .map(|(id, state)| (id.clone(), state.resource_ids.clone()))
                .collect()
        })
        .unwrap_or_default();
    let resources_exist =
        discover_members(root, &dir, &members, &mut registry, published.is_none())?;
    Ok(registry.finish(resources_exist, formal_resources))
}

// Discover candidate sources without treating their locators as formal IDs.
fn discover_members(
    root: &Root,
    dir: &RelativePath,
    members: &source::DirectorySnapshot,
    registry: &mut CandidateRegistry,
    index_missing: bool,
) -> Result<bool, CommandError> {
    let error = |e: String| CommandError::new("candidate-discovery-failed", e);
    let mut resources_exist = false;
    for member in &members.members {
        match classify_investigation_member(member)? {
            InvestigationMember::Index => continue,
            InvestigationMember::Resources => {
                resources_exist = true;
                continue;
            }
            InvestigationMember::Formal if index_missing => {
                return Err(error("formal index is missing while formal sources exist; explicitly recover the published index before candidate operations".into()));
            }
            InvestigationMember::Formal => continue,
            InvestigationMember::Candidate => {}
        }
        consider_candidate(root, dir, &member.name, registry)?;
    }
    Ok(resources_exist)
}

// Candidate capture is separate from collection member classification.
fn consider_candidate(
    root: &Root,
    dir: &RelativePath,
    name: &str,
    registry: &mut CandidateRegistry,
) -> Result<(), CommandError> {
    if registry.paths.contains(name) {
        return Ok(());
    }
    let Some(candidate) = probe_investigation(root, dir, name)? else {
        registry.warn_invalid(name);
        return Ok(());
    };
    registry.insert(candidate)?;
    Ok(())
}

fn probe_investigation(
    root: &Root,
    dir: &RelativePath,
    name: &str,
) -> Result<Option<Candidate>, CommandError> {
    let error = |e: String| CommandError::new("candidate-discovery-failed", e);
    let path = RelativePath::new(dir.as_path().join(name)).map_err(|e| error(e.to_string()))?;
    let ExpectedFile::Present(source) =
        source::capture(root, &path).map_err(|e| error(e.to_string()))?
    else {
        return Err(error(format!("candidate disappeared: {name}")));
    };
    let text = source::strict_text(&source)
        .map_err(|e| error(e.to_string()))?
        .to_owned();
    let header = domains::investigation::candidate_header(&text).map_err(|e| {
        if e == "unsupported-unpaired-surrogate" {
            let mut e = CommandError::new(
                "unsupported-unpaired-surrogate",
                "candidate frontmatter contains an unpaired UTF-16 surrogate",
            );
            e.path = Some(
                path.as_path()
                    .to_string_lossy()
                    .into_owned()
                    .into_boxed_str(),
            );
            e.recovery =
                Some("Replace the unpaired surrogate with valid Unicode, then retry.".into());
            e
        } else {
            error(e)
        }
    })?;
    Ok(header.map(|id| Candidate {
        name: domains::name_from_id(&id).to_owned(),
        id,
        path: name.to_owned(),
        text,
    }))
}

// Candidate locators are deliberately not treated as published record IDs.
enum InvestigationMember {
    Index,
    Resources,
    Formal,
    Candidate,
}
fn classify_investigation_member(
    member: &source::DirectoryMember,
) -> Result<InvestigationMember, CommandError> {
    let error = |e: String| CommandError::new("candidate-discovery-failed", e);
    if member.name == "investigation-index.json" {
        return Ok(InvestigationMember::Index);
    }
    if member.name == "_resources" {
        return if member.kind == MemberKind::Directory {
            Ok(InvestigationMember::Resources)
        } else {
            Err(error(
                "_resources must be a directory and not a symbolic link".into(),
            ))
        };
    }
    if member.kind != MemberKind::File {
        return Err(error(format!(
            "{} is not an allowed regular Investigation member",
            member.name
        )));
    }
    let candidate = member.name.strip_prefix("_candidate.");
    match candidate {
        Some(locator) if domains::is_kebab(locator) => Ok(InvestigationMember::Candidate),
        None if member
            .name
            .strip_suffix(".md")
            .is_some_and(domains::is_kebab) =>
        {
            Ok(InvestigationMember::Formal)
        }
        _ => Err(error(format!(
            "{} is not an allowed Investigation member path",
            member.name
        ))),
    }
}
