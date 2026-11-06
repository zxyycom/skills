//! Prepare Decision lifecycle edits from a validated baseline and observed bytes.
//! This does not capture sources or execute the transaction.
use super::{
    contract::Alignment,
    lifecycle::{LifecycleEdit, Status},
    selected_sync::{Entry, SelectedError, SelectedUpdate, build_validated_selected},
};
use crate::{
    domains::decision::{DecisionState, Definition},
    index::{IndexError, ValidatedIndex},
    source_revision::{Domain, fingerprint},
};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceMove {
    pub id: String,
    pub old_path: String,
    pub new_path: String,
    pub before: Vec<u8>,
    pub after: Vec<u8>,
    pub before_lifecycle: super::lifecycle::EstablishedLifecycle,
    pub after_lifecycle: super::lifecycle::EstablishedLifecycle,
}
pub struct PreparedLifecycle {
    pub moves: Vec<SourceMove>,
    pub index: ValidatedIndex<DecisionState>,
}
#[derive(Debug)]
pub enum PrepareError {
    Missing(String),
    Duplicate(String),
    InvalidUtf8(String),
    Stale(String),
    LifecycleMismatch(String),
    TargetOccupied(String),
    Render { id: String, reason: String },
    Projection(SelectedError<IndexError>),
}

fn status(value: Status) -> &'static str {
    match value {
        Status::Active => "active",
        Status::Archived => "archived",
    }
}
fn alignment(value: Alignment) -> &'static str {
    match value {
        Alignment::Aligned => "aligned",
        Alignment::Unaligned => "unaligned",
    }
}

/// Every source must be a captured regular file from this phase, with the
/// caller independently checking location safety, absence and write-set guards.
pub fn prepare_lifecycle(
    baseline: &ValidatedIndex<DecisionState>,
    edits: &[LifecycleEdit],
    sources: &HashMap<String, Vec<u8>>,
    occupied_paths: &HashSet<String>,
) -> Result<PreparedLifecycle, PrepareError> {
    let mut seen = HashSet::new();
    let mut targets = HashSet::new();
    let mut moves = Vec::with_capacity(edits.len());
    let mut updates = Vec::with_capacity(edits.len());
    for edit in edits {
        if !seen.insert(edit.id.as_str()) {
            return Err(PrepareError::Duplicate(edit.id.clone()));
        }
        let original = validate_lifecycle(baseline, edit)?;
        if !targets.insert(edit.target_path.as_str())
            || (edit.target_path != edit.source_path && occupied_paths.contains(&edit.target_path))
        {
            return Err(PrepareError::TargetOccupied(edit.target_path.clone()));
        }
        let (source_move, update) = prepare_edit(baseline, edit, sources, original)?;
        moves.push(source_move);
        updates.push(update);
    }
    let index = build_validated_selected(baseline, &Definition, &updates, &[])
        .map_err(PrepareError::Projection)?
        .index;
    Ok(PreparedLifecycle { moves, index })
}

fn validate_lifecycle<'a>(
    baseline: &'a ValidatedIndex<DecisionState>,
    edit: &LifecycleEdit,
) -> Result<&'a DecisionState, PrepareError> {
    let original = baseline
        .index()
        .entries
        .get(&edit.id)
        .ok_or_else(|| PrepareError::Missing(edit.id.clone()))?;
    if original.source_path != edit.source_path
        || original.status != status(edit.before.status)
        || original.alignment != alignment(edit.before.alignment)
        || original.created_at != edit.created_at
    {
        return Err(PrepareError::LifecycleMismatch(edit.id.clone()));
    }
    Ok(original)
}

fn prepare_edit(
    baseline: &ValidatedIndex<DecisionState>,
    edit: &LifecycleEdit,
    sources: &HashMap<String, Vec<u8>>,
    original: &DecisionState,
) -> Result<(SourceMove, SelectedUpdate<DecisionState>), PrepareError> {
    let bytes = checked_source(baseline, edit, sources)?;
    let after = crate::domains::decision::replace_metadata(
        bytes,
        &edit.id,
        crate::domains::decision::MetadataUpdate {
            status: status(edit.after.status),
            alignment: Some(alignment(edit.after.alignment)),
            created_at: Some(&edit.created_at),
            relations: None,
        },
    )
    .map_err(|reason| PrepareError::Render {
        id: edit.id.clone(),
        reason,
    })?;
    let mut state = original.clone();
    state.source_path = edit.target_path.clone();
    state.status = status(edit.after.status).into();
    state.alignment = alignment(edit.after.alignment).into();
    let revision = fingerprint(Domain::Decision, &edit.id, &edit.target_path, &after);
    let update = SelectedUpdate {
        id: edit.id.clone(),
        current: Some(Entry { state, revision }),
        located_from: None,
    };
    let source_move = SourceMove {
        id: edit.id.clone(),
        old_path: edit.source_path.clone(),
        new_path: edit.target_path.clone(),
        before: bytes.to_vec(),
        after: after.into_bytes(),
        before_lifecycle: edit.before,
        after_lifecycle: edit.after,
    };
    Ok((source_move, update))
}

fn checked_source<'a>(
    baseline: &ValidatedIndex<DecisionState>,
    edit: &LifecycleEdit,
    sources: &'a HashMap<String, Vec<u8>>,
) -> Result<&'a [u8], PrepareError> {
    let bytes = sources
        .get(&edit.id)
        .ok_or_else(|| PrepareError::Missing(edit.id.clone()))?;
    let text =
        std::str::from_utf8(bytes).map_err(|_| PrepareError::InvalidUtf8(edit.id.clone()))?;
    if fingerprint(Domain::Decision, &edit.id, &edit.source_path, text)
        != baseline.index().source_revision.entries[&edit.id]
    {
        return Err(PrepareError::Stale(edit.id.clone()));
    }
    Ok(bytes)
}

/// Assemble captured source/index write intents after resolving the lifecycle
/// selection in this same phase. The transaction operation must call this anew
/// under the collection lock, independently fresh-check directory membership,
/// history and all dependencies, and separately verify the post-write graph.
/// This function only constructs a plan; it never writes or acquires a lock.
pub fn capture_plan(
    root: &crate::source::Root,
    collection: &crate::source::RelativePath,
    index_path: &crate::source::RelativePath,
    edits: &[LifecycleEdit],
) -> Result<crate::transaction::Plan<PreparedLifecycle>, crate::transaction::TxError> {
    use crate::transaction::{CommitPoint, Plan, TxError, WriteIntent};
    let fail = |code: &str, message: String| TxError::new(code, message);
    let (index_before, baseline) = capture_baseline(root, index_path)?;
    let CapturedEdits {
        captures,
        sources,
        occupied,
    } = capture_edits(root, collection, edits)?;
    let prepared = prepare_lifecycle(&baseline, edits, &sources, &occupied)
        .map_err(|e| fail("lifecycle-preparation", format!("{e:?}")))?;
    let next_index = crate::index::serialize_index(&prepared.index, &Definition)
        .map_err(|e| fail("index-serialize", e.to_string()))?;
    let mut writes = source_writes(captures, &prepared.moves);
    writes.push(WriteIntent {
        path: index_path.clone(),
        before: index_before,
        after: Some(next_index),
        mode: None,
    });
    Ok(Plan {
        value: prepared,
        writes,
        guards: vec![],
        resources: vec![],
        commit_point: CommitPoint::PublishedIndex(index_path.clone()),
    })
}

fn capture_baseline(
    root: &crate::source::Root,
    index_path: &crate::source::RelativePath,
) -> Result<(crate::source::ExpectedFile, ValidatedIndex<DecisionState>), crate::transaction::TxError>
{
    use crate::source::{ExpectedFile, capture};
    let fail = |code: &str, message: String| crate::transaction::TxError::new(code, message);
    let index_before = capture(root, index_path).map_err(|e| fail("index-read", e.to_string()))?;
    let ExpectedFile::Present(index_snapshot) = &index_before else {
        return Err(fail(
            "index-missing",
            "published Decision index is missing".into(),
        ));
    };
    let baseline = crate::index::parse_index(&index_snapshot.bytes, &Definition)
        .map_err(|e| fail("index-invalid", e.to_string()))?;
    // A syntactically valid baseline must also satisfy the current graph.
    let check = crate::index::QuerySnapshot::new(baseline.clone());
    check
        .graph(&Definition)
        .map_err(|e| fail("index-invalid", e.to_string()))?;
    Ok((index_before, baseline))
}

struct CapturedMove {
    old: crate::source::RelativePath,
    new: crate::source::RelativePath,
    before: crate::source::ExpectedFile,
    target: Option<crate::source::ExpectedFile>,
}
struct CapturedEdits {
    captures: Vec<CapturedMove>,
    sources: HashMap<String, Vec<u8>>,
    occupied: HashSet<String>,
}
fn capture_edits(
    root: &crate::source::Root,
    collection: &crate::source::RelativePath,
    edits: &[LifecycleEdit],
) -> Result<CapturedEdits, crate::transaction::TxError> {
    use crate::source::{ExpectedFile, RelativePath, capture};
    let fail = |code: &str, message: String| crate::transaction::TxError::new(code, message);
    let mut captures = Vec::with_capacity(edits.len());
    let mut sources = HashMap::new();
    let mut occupied = HashSet::new();
    for edit in edits {
        let old = RelativePath::new(collection.as_path().join(&edit.source_path))
            .map_err(|e| fail("source-path", e.to_string()))?;
        let new = RelativePath::new(collection.as_path().join(&edit.target_path))
            .map_err(|e| fail("target-path", e.to_string()))?;
        let before = capture(root, &old).map_err(|e| fail("source-read", e.to_string()))?;
        let ExpectedFile::Present(snapshot) = &before else {
            return Err(fail("source-missing", edit.id.clone()));
        };
        sources.insert(edit.id.clone(), snapshot.bytes.clone());
        let target = if old != new {
            let target = capture(root, &new).map_err(|e| fail("target-read", e.to_string()))?;
            if matches!(target, ExpectedFile::Present(_)) {
                occupied.insert(edit.target_path.clone());
            }
            Some(target)
        } else {
            None
        };
        captures.push(CapturedMove {
            old,
            new,
            before,
            target,
        });
    }
    Ok(CapturedEdits {
        captures,
        sources,
        occupied,
    })
}

fn source_writes(
    captures: Vec<CapturedMove>,
    moves: &[SourceMove],
) -> Vec<crate::transaction::WriteIntent> {
    use crate::source::ExpectedFile;
    use crate::transaction::{WriteIntent, WriteMode};
    let mut writes = Vec::new();
    for (
        CapturedMove {
            old,
            new,
            before,
            target,
        },
        change,
    ) in captures.into_iter().zip(moves)
    {
        if old == new {
            writes.push(WriteIntent {
                path: old,
                before,
                after: Some(change.after.clone()),
                mode: None,
            });
        } else {
            let ExpectedFile::Present(snapshot) = &before else {
                unreachable!("source presence was checked")
            };
            #[cfg(unix)]
            let mode = snapshot.identity.mode & 0o7777;
            #[cfg(not(unix))]
            let mode = snapshot.identity.mode;
            let Some(target) = target else {
                unreachable!("target capture was required")
            };
            writes.push(WriteIntent {
                path: new,
                before: target,
                after: Some(change.after.clone()),
                mode: Some(WriteMode::Exact(mode)),
            });
            writes.push(WriteIntent {
                path: old,
                before,
                after: None,
                mode: None,
            });
        }
    }
    writes
}

#[cfg(test)]
mod tests;
