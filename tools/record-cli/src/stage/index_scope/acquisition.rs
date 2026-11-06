//! Capture stage index observations and derive the selected projection.
use super::pending::{PendingIndex, capture_pending_index};
use super::*;

#[derive(Clone, Copy)]
pub(in crate::stage) struct Acquisition<'a, F> {
    pub selectors: &'a [String],
    pub name: F,
    pub scope: StageScope,
    pub extra_ids: &'a [String],
}

struct ObservedIndexes<S> {
    workspace: ExpectedFile,
    worktree: ValidatedIndex<S>,
    pending: ContentSnapshot,
    pending_index: Option<ValidatedIndex<S>>,
}
impl<S> ObservedIndexes<S> {
    fn verify_workspace(
        &self,
        root: &Root,
        index_path: &RelativePath,
    ) -> Result<(), IndexStageError> {
        if source::capture(root, index_path).map_err(IndexStageError::Source)? != self.workspace {
            return Err(IndexStageError::Drift);
        }
        Ok(())
    }
}

pub(in crate::stage) fn acquire<D, F>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
    baseline: Option<&ValidatedIndex<D::State>>,
    request: Acquisition<'_, F>,
) -> Result<Phase, IndexStageError>
where
    D: DomainDefinition,
    D::State: Clone,
    F: Fn(&D::State) -> &str + Copy,
{
    let observed = capture_indexes(root, index_path, domain, request.scope)?;
    let (selected, target) = selected_projection(index_path, domain, baseline, &observed, request)?;
    observed.verify_workspace(root, index_path)?;
    Ok(Phase {
        workspace: observed.workspace,
        pending: observed.pending,
        selected,
        target,
    })
}

/// Capture both independent workspace and pending-index observations.
fn capture_indexes<D: DomainDefinition>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
    scope: StageScope,
) -> Result<ObservedIndexes<D::State>, IndexStageError> {
    let (workspace, worktree) = capture_workspace_index(root, index_path, domain)?;
    let PendingIndex {
        pending,
        pending_index,
    } = capture_pending_index(root, index_path, domain, scope)?;
    Ok(ObservedIndexes {
        workspace,
        worktree,
        pending,
        pending_index,
    })
}

/// Resolve selected identities across snapshots, then compose their target index.
fn selected_projection<D, F>(
    index_path: &RelativePath,
    domain: &D,
    baseline: Option<&ValidatedIndex<D::State>>,
    observed: &ObservedIndexes<D::State>,
    request: Acquisition<'_, F>,
) -> Result<(Vec<String>, Vec<u8>), IndexStageError>
where
    D: DomainDefinition,
    D::State: Clone,
    F: Fn(&D::State) -> &str + Copy,
{
    let Acquisition {
        selectors,
        name,
        scope,
        extra_ids,
    } = request;
    let selected = selection::Selection {
        namespace: domain.namespace(),
        index_path,
        pending: &observed.pending,
        indexes: [
            baseline,
            Some(&observed.worktree),
            observed.pending_index.as_ref(),
        ],
        selectors,
        extra_ids,
        scope,
        name,
    }
    .resolve()?;
    let target = compose_index(
        domain,
        scope,
        IndexInputs {
            head: baseline,
            worktree: &observed.worktree,
            pending: observed.pending_index.as_ref(),
        },
        &selected,
    )
    .map_err(IndexStageError::Index)?
    .unwrap_or_default();
    Ok((selected, target))
}

/// Capture and validate the workspace index before resolving stage selectors.
type WorkspaceIndex<S> = (ExpectedFile, ValidatedIndex<S>);
fn capture_workspace_index<D: DomainDefinition>(
    root: &Root,
    index_path: &RelativePath,
    domain: &D,
) -> Result<WorkspaceIndex<D::State>, IndexStageError> {
    let workspace = source::capture(root, index_path).map_err(IndexStageError::Source)?;
    let bytes = match &workspace {
        ExpectedFile::Present(snapshot) => &snapshot.bytes,
        ExpectedFile::Missing => {
            return Err(IndexStageError::Selection("workspace index missing".into()));
        }
    };
    let worktree = checked_index(bytes, domain)?;
    Ok((workspace, worktree))
}
