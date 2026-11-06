use super::*;

pub(super) struct CapturedSource {
    pub id: String,
    pub path: RelativePath,
    pub before: ExpectedFile,
}
pub(super) struct Captured {
    pub sources: HashMap<String, Vec<u8>>,
    pub snapshots: Vec<CapturedSource>,
}
pub(super) fn capture_sources(
    root: &Root,
    collection: &RelativePath,
    baseline: &crate::index::ValidatedIndex<domains::decision::DecisionState>,
    resolved: &[SourceReview<DecisionRelationKind>],
) -> Result<Captured, TxError> {
    let mut sources = HashMap::new();
    let mut snapshots = Vec::new();
    for item in resolved {
        let state = &baseline.index().entries[&item.source_id];
        let path = RelativePath::new(collection.as_path().join(&state.source_path))
            .map_err(|e| fail("source-path", e.to_string()))?;
        let before = capture(root, &path).map_err(|e| fail("source-read", e.to_string()))?;
        let ExpectedFile::Present(file) = &before else {
            return Err(fail("source-missing", item.source_id.clone()));
        };
        let text =
            std::str::from_utf8(&file.bytes).map_err(|e| fail("source-encoding", e.to_string()))?;
        if fingerprint(Domain::Decision, &item.source_id, &state.source_path, text)
            != baseline.index().source_revision.entries[&item.source_id]
        {
            return Err(fail("source-stale", item.source_id.clone()));
        }
        let parsed =
            domains::decision::parse_established(&file.bytes, &item.source_id, &state.source_path)
                .map_err(|e| fail("source-invalid", e))?;
        if parsed.state != *state {
            return Err(fail("source-stale", item.source_id.clone()));
        }
        sources.insert(item.source_id.clone(), file.bytes.clone());
        snapshots.push(CapturedSource {
            id: item.source_id.clone(),
            path,
            before,
        });
    }
    Ok(Captured { sources, snapshots })
}
