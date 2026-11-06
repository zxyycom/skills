use super::*;

pub(super) struct CandidateWrites {
    pub final_index: index::ValidatedIndex<InvestigationState>,
    pub writes: Vec<WriteIntent>,
    pub proposals: Vec<InvestigationCandidate>,
    pub selected_refs: HashMap<String, Vec<String>>,
}
pub(super) fn prepare(
    operation: &InvestigationPublishOperation,
    root: &Root,
    baseline: &index::ValidatedIndex<InvestigationState>,
    selected: &BTreeSet<String>,
    candidates: &BTreeMap<String, String>,
) -> Result<CandidateWrites, TxError> {
    let mut next = baseline.index().clone();
    let mut writes = Vec::new();
    let mut proposals = Vec::new();
    let mut selected_refs = HashMap::new();
    for id in selected {
        let candidate = prepare_candidate(operation, root, id, &candidates[id])?;
        selected_refs.insert(id.clone(), candidate.resource_ids);
        next.source_revision
            .entries
            .insert(id.clone(), candidate.revision);
        next.entries.insert(id.clone(), candidate.state);
        writes.extend(candidate.writes);
        proposals.push(candidate.proposal);
    }
    let final_index = index::build_index(next, &Definition).map_err(|e| fail("graph", e))?;
    index::QuerySnapshot::new(final_index.clone())
        .graph(&Definition)
        .map_err(|e| fail("graph", e))?;
    Ok(CandidateWrites {
        final_index,
        writes,
        proposals,
        selected_refs,
    })
}

struct PreparedCandidate {
    proposal: InvestigationCandidate,
    state: InvestigationState,
    revision: String,
    resource_ids: Vec<String>,
    writes: [WriteIntent; 2],
}
fn prepare_candidate(
    operation: &InvestigationPublishOperation,
    root: &Root,
    id: &str,
    locator: &str,
) -> Result<PreparedCandidate, TxError> {
    let (candidate_path, before) = capture_candidate(operation, root, locator)?;
    let ExpectedFile::Present(ref snapshot) = before else {
        unreachable!()
    };
    let front = validate_readiness(&snapshot.bytes, id, locator)?;
    let formal = format!("{}.md", locator.strip_prefix("_candidate.").unwrap());
    let parsed = domains::investigation::parse_established(&snapshot.bytes, id, &formal)
        .map_err(|e| fail("candidate-unready", e))?;
    let text = std::str::from_utf8(&snapshot.bytes).map_err(|e| fail("candidate-invalid", e))?;
    let (formal_path, formal_before) = capture_formal_target(operation, root, &formal)?;
    let proposal = candidate_proposal(&front, id, locator)?;
    let resource_ids = parsed.state.resource_ids.clone();
    let revision = source_revision::fingerprint(Domain::Investigation, id, &formal, text);
    let state = parsed.state;
    #[cfg(unix)]
    let mode = snapshot.identity.mode & 0o7777;
    let formal_write = WriteIntent {
        path: formal_path,
        before: formal_before,
        after: Some(snapshot.bytes.clone()),
        mode: Some(WriteMode::Exact(mode)),
    };
    let candidate_write = WriteIntent {
        path: candidate_path,
        before,
        after: None,
        mode: None,
    };
    Ok(PreparedCandidate {
        proposal,
        state,
        revision,
        resource_ids,
        writes: [formal_write, candidate_write],
    })
}

fn validate_readiness(
    bytes: &[u8],
    id: &str,
    locator: &str,
) -> Result<domains::investigation::Frontmatter, TxError> {
    let doc = domains::investigation::parse_candidate(bytes, id, locator)
        .map_err(|e| fail("candidate-invalid", e))?;
    let front = domains::investigation::parse_frontmatter(bytes, id)
        .map_err(|e| fail("candidate-invalid", e))?;
    let body = domains::investigation::assess_body(bytes, front.end_line, false)
        .map_err(|e| fail("candidate-invalid", e))?;
    if !doc.readiness.scaffold_valid
        || !body.body_errors.is_empty()
        || !body.resource_errors.is_empty()
    {
        return Err(fail(
            "candidate-unready",
            format!("{}: {:?} {:?}", id, body.body_errors, body.resource_errors),
        ));
    }
    Ok(front)
}

fn capture_formal_target(
    operation: &InvestigationPublishOperation,
    root: &Root,
    formal: &str,
) -> Result<(RelativePath, ExpectedFile), TxError> {
    let formal_path = RelativePath::new(operation.collection.as_path().join(formal))
        .map_err(|e| fail("path", e))?;
    let formal_before = source::capture(root, &formal_path).map_err(|e| fail("formal", e))?;
    if formal_before != ExpectedFile::Missing {
        return Err(fail("formal-exists", formal));
    }
    Ok((formal_path, formal_before))
}

fn candidate_proposal(
    front: &domains::investigation::Frontmatter,
    id: &str,
    locator: &str,
) -> Result<InvestigationCandidate, TxError> {
    Ok(InvestigationCandidate {
        id: id.to_owned(),
        source_path: locator.to_owned(),
        body_ready: true,
        resource_ready: true,
        relations: front
            .relations
            .iter()
            .map(relation)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn capture_candidate(
    operation: &InvestigationPublishOperation,
    root: &Root,
    locator: &str,
) -> Result<(RelativePath, ExpectedFile), TxError> {
    let candidate_path = RelativePath::new(operation.collection.as_path().join(locator))
        .map_err(|e| fail("path", e))?;
    let before = source::capture(root, &candidate_path).map_err(|e| fail("candidate", e))?;
    if matches!(before, ExpectedFile::Missing) {
        return Err(fail("candidate", "candidate disappeared"));
    }
    Ok((candidate_path, before))
}
