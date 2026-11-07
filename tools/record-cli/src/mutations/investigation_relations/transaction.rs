use super::*;

/// Prepare a replacement plan from the selected sources and validated baseline.
/// No persistent write occurs here.
pub fn capture_plan(
    root: &crate::source::Root,
    collection: &crate::source::RelativePath,
    index_path: &crate::source::RelativePath,
    review: &[SourceReview<InvestigationRelationKind>],
) -> Result<crate::transaction::Plan<PreparedReplacement>, crate::transaction::TxError> {
    use crate::transaction::{CommitPoint, Plan, TxError, WriteIntent};
    let fail = |code: &str, message: String| TxError::new(code, message);
    let (index_before, baseline) = capture_baseline(root, index_path)?;
    let CapturedSources { snapshots, sources } =
        capture_sources(root, collection, &baseline, review)?;
    let prepared = prepare_replacements(&baseline, review, &sources)
        .map_err(|e| fail("relation-preparation", format!("{e:?}")))?;
    let mut writes = source_intents(snapshots, &prepared.edits);
    let commit_point = if writes.is_empty() {
        CommitPoint::NoCommit
    } else {
        let next = crate::index::serialize_index(
            &prepared.index,
            &crate::domains::investigation::Definition,
        )
        .map_err(|e| fail("index-serialize", e.to_string()))?;
        writes.push(WriteIntent {
            path: index_path.clone(),
            before: index_before,
            after: Some(next),
        });
        CommitPoint::PublishedIndex(index_path.clone())
    };
    Ok(Plan {
        value: prepared,
        writes,
        resources: vec![],
        commit_point,
    })
}

fn capture_baseline(
    root: &crate::source::Root,
    index_path: &crate::source::RelativePath,
) -> Result<
    (
        crate::source::ExpectedFile,
        crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    ),
    crate::transaction::TxError,
> {
    use crate::source::{ExpectedFile, capture};
    let fail = |code: &str, message: String| crate::transaction::TxError::new(code, message);
    let index_before = capture(root, index_path).map_err(|e| fail("index-read", e.to_string()))?;
    let ExpectedFile::Present(index_snapshot) = &index_before else {
        return Err(fail(
            "index-missing",
            "published Investigation index is missing".into(),
        ));
    };
    let baseline = crate::index::parse_index(
        &index_snapshot.bytes,
        &crate::domains::investigation::Definition,
    )
    .map_err(|e| fail("index-invalid", e.to_string()))?;
    let check = crate::index::QuerySnapshot::new(baseline.clone());
    check
        .graph(&crate::domains::investigation::Definition)
        .map_err(|e| fail("index-invalid", e.to_string()))?;
    Ok((index_before, baseline))
}

struct CapturedSource {
    id: String,
    path: crate::source::RelativePath,
    before: crate::source::ExpectedFile,
}
struct CapturedSources {
    snapshots: Vec<CapturedSource>,
    sources: HashMap<String, Vec<u8>>,
}
fn capture_sources(
    root: &crate::source::Root,
    collection: &crate::source::RelativePath,
    baseline: &crate::index::ValidatedIndex<crate::domains::investigation::InvestigationState>,
    review: &[SourceReview<InvestigationRelationKind>],
) -> Result<CapturedSources, crate::transaction::TxError> {
    use crate::source::{ExpectedFile, RelativePath, capture};
    let fail = |code: &str, message: String| crate::transaction::TxError::new(code, message);
    let mut snapshots = Vec::with_capacity(review.len());
    let mut sources = HashMap::new();
    for item in review {
        let state = baseline
            .index()
            .entries
            .get(&item.source_id)
            .ok_or_else(|| fail("source-missing", item.source_id.clone()))?;
        let path = RelativePath::new(collection.as_path().join(&state.source_path))
            .map_err(|e| fail("source-path", e.to_string()))?;
        let before = capture(root, &path).map_err(|e| fail("source-read", e.to_string()))?;
        let ExpectedFile::Present(snapshot) = &before else {
            return Err(fail("source-missing", item.source_id.clone()));
        };
        sources.insert(item.source_id.clone(), snapshot.bytes.clone());
        snapshots.push(CapturedSource {
            id: item.source_id.clone(),
            path,
            before,
        });
    }
    Ok(CapturedSources { snapshots, sources })
}

fn source_intents(
    snapshots: Vec<CapturedSource>,
    edits: &[SourceEdit],
) -> Vec<crate::transaction::WriteIntent> {
    use crate::transaction::WriteIntent;
    let after_by_id: HashMap<_, _> = edits
        .iter()
        .map(|edit| (edit.id.as_str(), &edit.after))
        .collect();
    let mut writes = Vec::new();
    for CapturedSource { id, path, before } in snapshots {
        if let Some(after) = after_by_id.get(id.as_str()) {
            writes.push(WriteIntent {
                path,
                before,
                after: Some((*after).clone()),
            });
        }
    }
    writes
}
