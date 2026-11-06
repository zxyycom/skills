use super::*;

pub fn decisions(root: &Root, directory: &str) -> Result<Candidates, CommandError> {
    let DiscoveryInputs {
        dir,
        listing,
        published,
    } = discovery_inputs(
        root,
        directory,
        "decision-index.json",
        &domains::decision::Definition,
    )?;
    let mut registry = CandidateRegistry::new(
        published_paths(published.as_ref(), |state| &state.source_path),
        published.is_none(),
    );
    let paths_to_check = decision_member_paths(root, &dir, &listing)?;
    discover_paths(
        root,
        &dir,
        paths_to_check,
        &mut registry,
        published.is_none(),
    )?;
    Ok(registry.finish(false, HashMap::new()))
}

fn discover_paths(
    root: &Root,
    dir: &RelativePath,
    paths_to_check: Vec<String>,
    registry: &mut CandidateRegistry,
    index_missing: bool,
) -> Result<(), CommandError> {
    let failure = |e: String| CommandError::new("candidate-discovery-failed", e);
    for name in paths_to_check {
        if registry.paths.contains(&name) {
            continue;
        }
        match probe_decision(root, dir, &name)? {
            DecisionProbe::Established if index_missing => {
                return Err(failure("decision-index.json is missing for established Decisions; restore it or run sync-index explicitly".into()));
            }
            DecisionProbe::Established => continue,
            DecisionProbe::Invalid => registry.warn_invalid(&name),
            DecisionProbe::Candidate(candidate) => {
                registry.insert(candidate)?;
            }
        }
    }
    Ok(())
}

enum DecisionProbe {
    Established,
    Invalid,
    Candidate(Candidate),
}
fn probe_decision(
    root: &Root,
    dir: &RelativePath,
    name: &str,
) -> Result<DecisionProbe, CommandError> {
    let failure = |e: String| CommandError::new("candidate-discovery-failed", e);
    let path = RelativePath::new(dir.as_path().join(name)).map_err(|e| failure(e.to_string()))?;
    let ExpectedFile::Present(file) =
        source::capture(root, &path).map_err(|e| failure(e.to_string()))?
    else {
        return Err(failure(format!("source disappeared: {name}")));
    };
    let text = source::strict_text(&file)
        .map_err(|e| failure(e.to_string()))?
        .to_owned();
    let (id, candidate) = domains::decision::candidate_header(&text, name).map_err(failure)?;
    if !candidate {
        return Ok(DecisionProbe::Established);
    }
    let Some(id) = id else {
        return Ok(DecisionProbe::Invalid);
    };
    Ok(DecisionProbe::Candidate(Candidate {
        name: domains::name_from_id(&id).to_owned(),
        id,
        path: name.to_owned(),
        text,
    }))
}

// Enumerate and validate the decision collection, including archived members.
fn decision_member_paths(
    root: &Root,
    dir: &RelativePath,
    listing: &source::DirectorySnapshot,
) -> Result<Vec<String>, CommandError> {
    let failure = |e: String| CommandError::new("candidate-discovery-failed", e);
    let mut paths_to_check = Vec::new();
    for member in &listing.members {
        if member.name == "decision-index.json" {
            continue;
        }
        if member.name == "archive" {
            if member.kind != MemberKind::Directory {
                return Err(failure(
                    "Decision archive must be a regular directory".into(),
                ));
            }
            paths_to_check.extend(decision_archive_paths(root, dir)?);
        } else {
            if !valid_decision_member(member) {
                return Err(failure(format!(
                    "{} is not an allowed regular Decision member",
                    member.name
                )));
            }
            paths_to_check.push(member.name.clone());
        }
    }
    paths_to_check.sort_by(|a, b| super::super::trace::compare_text(a, b));
    Ok(paths_to_check)
}

fn valid_decision_member(member: &source::DirectoryMember) -> bool {
    member.kind == MemberKind::File
        && member
            .name
            .strip_suffix(".md")
            .is_some_and(domains::is_kebab)
}
fn decision_archive_paths(root: &Root, dir: &RelativePath) -> Result<Vec<String>, CommandError> {
    let failure = |e: String| CommandError::new("candidate-discovery-failed", e);
    let mut paths = Vec::new();
    let archive =
        RelativePath::new(dir.as_path().join("archive")).map_err(|e| failure(e.to_string()))?;
    let listing =
        source::enumerate_directory(root, &archive).map_err(|e| failure(e.to_string()))?;
    for member in listing.members {
        if !valid_decision_member(&member) {
            return Err(failure(format!(
                "archive/{} is not an allowed regular Decision member",
                member.name
            )));
        }
        paths.push(format!("archive/{}", member.name));
    }
    Ok(paths)
}
