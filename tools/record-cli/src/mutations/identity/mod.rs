//! Transactional identity operations for Decision and Investigation records.
mod diagnostics;
use diagnostics::{discard_failure, explained_failure, rename_failure};
pub mod decision;
pub mod investigation;

use crate::{
    source::{self, ExpectedFile, RelativePath, Root},
    transaction::{Plan, TxError, WriteMode},
};

fn fail(code: &str, error: impl std::fmt::Display) -> TxError {
    TxError::new(code, error.to_string())
}

fn relative(collection: &RelativePath, path: &str) -> Result<RelativePath, TxError> {
    RelativePath::new(collection.as_path().join(path)).map_err(|e| fail("path", e))
}

fn selector_name(value: &str) -> &str {
    if value
        .get(value.len().saturating_sub(3)..)
        .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".md"))
    {
        &value[..value.len() - 3]
    } else {
        value
    }
}

fn select_identity(
    locators: &std::collections::BTreeMap<String, (String, bool)>,
    selector: &str,
) -> Result<(String, String, bool), TxError> {
    let selector = selector_name(selector);
    let matches: Vec<_> = locators
        .iter()
        .filter(|(id, _)| {
            if crate::domains::name_from_id(selector) != selector {
                id.as_str() == selector
            } else {
                crate::domains::name_from_id(id) == selector
            }
        })
        .collect();
    match matches.as_slice() {
        [(id, (path, candidate))] => Ok(((*id).clone(), path.clone(), *candidate)),
        [] => Err(fail("selector", "not found")),
        _ => Err(fail("selector", "ambiguous selector")),
    }
}

fn mode(file: &source::SourceSnapshot) -> u32 {
    #[cfg(unix)]
    {
        file.identity.mode & 0o7777
    }
    #[cfg(not(unix))]
    {
        file.identity.mode
    }
}

// The fresh phase independently prepares the same file facts before transaction writes.
fn verify_fresh<T>(evidence_equal: bool, plan: &Plan<T>, now: &Plan<T>) -> Result<(), TxError> {
    let writes_equal = plan.writes.len() == now.writes.len()
        && plan
            .writes
            .iter()
            .zip(&now.writes)
            .all(|(a, b)| a.path == b.path && a.before == b.before && a.after == b.after);
    let guards_equal = plan.guards.len() == now.guards.len()
        && plan
            .guards
            .iter()
            .zip(&now.guards)
            .all(|(a, b)| a.path == b.path && a.before == b.before);
    if evidence_equal && writes_equal && guards_equal {
        Ok(())
    } else {
        Err(fail("source-changed", "identity facts changed"))
    }
}

fn verify_written_files<T>(root: &Root, plan: &Plan<T>) -> Result<(), TxError> {
    for write in &plan.writes {
        match (
            &write.after,
            source::capture(root, &write.path).map_err(|e| fail("postverify", e))?,
        ) {
            (None, ExpectedFile::Missing) => {}
            (Some(bytes), ExpectedFile::Present(file))
                if file.bytes == *bytes
                    && match (&write.mode, &write.before) {
                        (Some(WriteMode::Exact(n)), _) => mode(&file) == *n,
                        (Some(WriteMode::Native(n)), _) => file.identity.mode == *n,
                        (None, ExpectedFile::Present(before)) => {
                            file.identity.mode == before.identity.mode
                        }
                        (None, ExpectedFile::Missing) => false,
                    } => {}
            _ => return Err(fail("postverify", write.path.as_path().display())),
        }
    }
    verify_guards(root, plan, "postverify")
}

fn verify_recovered_files<T>(root: &Root, plan: &Plan<T>) -> Result<(), TxError> {
    for write in &plan.writes {
        match (
            &write.before,
            source::capture(root, &write.path).map_err(|e| fail("recovery", e))?,
        ) {
            (ExpectedFile::Missing, ExpectedFile::Missing) => {}
            (ExpectedFile::Present(a), ExpectedFile::Present(b))
                if a.bytes == b.bytes && a.identity.mode == b.identity.mode => {}
            _ => return Err(fail("recovery", write.path.as_path().display())),
        }
    }
    verify_guards(root, plan, "recovery")
}

fn verify_guards<T>(root: &Root, plan: &Plan<T>, code: &str) -> Result<(), TxError> {
    for guard in &plan.guards {
        if source::capture(root, &guard.path).map_err(|e| fail(code, e))? != guard.before {
            return Err(fail(code, "guard changed"));
        }
    }
    Ok(())
}

fn verify_published_index<D: crate::index::DomainDefinition>(
    root: &Root,
    path: &RelativePath,
    domain: &D,
) -> Result<(), TxError> {
    let ExpectedFile::Present(file) =
        source::capture(root, path).map_err(|e| fail("postverify", e))?
    else {
        return Err(fail("postverify", "index missing"));
    };
    let index =
        crate::index::parse_index(&file.bytes, domain).map_err(|e| fail("postverify", e))?;
    crate::index::QuerySnapshot::new(index)
        .graph(domain)
        .map_err(|e| fail("postverify", e))?;
    Ok(())
}

fn matches_identity(target: &str, id: &str) -> bool {
    let target = selector_name(target);
    let name = crate::domains::name_from_id(id);
    name != id && (target == id || target == name)
}

fn identity_allocation_unchanged(
    source: &super::rename::RenameSource,
    locators: &std::collections::BTreeMap<String, (String, bool)>,
    occupied: &std::collections::HashSet<String>,
) -> Result<bool, TxError> {
    let identity = super::rename::RenameIdentity {
        id: source.id.clone(),
        name: crate::domains::name_from_id(&source.id).into(),
    };
    let others = locators
        .keys()
        .filter(|id| *id != &source.id)
        .cloned()
        .collect();
    super::rename::plan_rename(
        source,
        &identity,
        &others,
        occupied,
        super::rename::RenameHistoryCheck {
            history: super::rename::History::NotRecorded,
            recorded_rename_confirmed: true,
        },
    )
    .map(|plan| plan.no_change)
    .map_err(|error| {
        let (domain, candidate) = match source.location {
            super::rename::Location::DecisionCandidate => (super::discard::Domain::Decision, true),
            super::rename::Location::DecisionActive | super::rename::Location::DecisionArchived => {
                (super::discard::Domain::Decision, false)
            }
            super::rename::Location::InvestigationCandidate => {
                (super::discard::Domain::Investigation, true)
            }
            super::rename::Location::InvestigationFormal => {
                (super::discard::Domain::Investigation, false)
            }
        };
        rename_failure(domain, &source.id, &identity.id, candidate, error)
    })
}

fn no_change_plan<T>(
    value: T,
    source: crate::transaction::Guard,
    index: crate::transaction::Guard,
) -> Plan<T> {
    Plan {
        value,
        writes: vec![],
        guards: vec![source, index],
        resources: vec![],
        commit_point: crate::transaction::CommitPoint::NoCommit,
    }
}

fn capture_baseline<D: crate::index::DomainDefinition>(
    root: &Root,
    path: &RelativePath,
    definition: &D,
    domain: crate::source_revision::Domain,
) -> Result<(ExpectedFile, crate::index::ValidatedIndex<D::State>), TxError> {
    let before = source::capture(root, path).map_err(|e| fail("index", e))?;
    let index = match &before {
        ExpectedFile::Present(file) => crate::index::parse_index(&file.bytes, definition),
        ExpectedFile::Missing => crate::index::build_index(
            crate::index::IndexV4 {
                schema_version: 4,
                namespace: definition.namespace().into(),
                definition_version: definition.definition_version(),
                metadata: serde_json::json!({}),
                source_revision: crate::index::Revision {
                    metadata: crate::source_revision::metadata_fingerprint(domain),
                    entries: Default::default(),
                },
                entries: Default::default(),
            },
            definition,
        ),
    }
    .map_err(|e| fail("index-invalid", e))?;
    Ok((before, index))
}

fn published_index_write<D: crate::index::DomainDefinition>(
    path: RelativePath,
    before: ExpectedFile,
    next: crate::index::IndexV4<D::State>,
    definition: &D,
) -> Result<crate::transaction::WriteIntent, TxError> {
    let index = crate::index::build_index(next, definition).map_err(|e| fail("graph", e))?;
    let snapshot = crate::index::QuerySnapshot::new(index);
    snapshot.graph(definition).map_err(|e| fail("graph", e))?;
    let bytes = crate::index::serialize_index(snapshot.index(), definition)
        .map_err(|e| fail("index", e))?;
    Ok(crate::transaction::WriteIntent {
        path,
        before,
        after: Some(bytes),
        mode: None,
    })
}

struct SelectedSource {
    id: String,
    old_path: String,
    candidate: bool,
    old: RelativePath,
    before: Option<ExpectedFile>,
}
fn capture_selected(
    root: &Root,
    collection: &RelativePath,
    selector: &str,
    locators: &std::collections::BTreeMap<String, (String, bool)>,
) -> Result<SelectedSource, TxError> {
    let (id, old_path, candidate) = select_identity(locators, selector)?;
    let old = relative(collection, &old_path)?;
    let before = source::capture(root, &old).map_err(|e| fail("source", e))?;
    Ok(SelectedSource {
        id,
        old_path,
        candidate,
        old,
        before: Some(before),
    })
}
fn selected_text<'a>(before: &'a ExpectedFile, id: &str) -> Result<&'a str, TxError> {
    let ExpectedFile::Present(file) = before else {
        return Err(fail("source-missing", id));
    };
    std::str::from_utf8(&file.bytes).map_err(|e| fail("source", e))
}

trait IdentityDiscovery {
    fn locators(&self) -> &std::collections::BTreeMap<String, (String, bool)>;
}
struct PhasePaths<'a> {
    index: &'a RelativePath,
    collection: &'a RelativePath,
    selector: &'a str,
}
struct PhaseFacts<S, Discovery> {
    baseline: crate::index::ValidatedIndex<S>,
    index_before: ExpectedFile,
    discovery: Discovery,
    selected: SelectedSource,
}
fn capture_phase<D, Discovery>(
    root: &Root,
    paths: PhasePaths<'_>,
    definition: &D,
    domain: crate::source_revision::Domain,
    discover: impl FnOnce(&crate::index::ValidatedIndex<D::State>, bool) -> Result<Discovery, TxError>,
) -> Result<PhaseFacts<D::State, Discovery>, TxError>
where
    D: crate::index::DomainDefinition,
    Discovery: IdentityDiscovery,
{
    let (index_before, baseline) = capture_baseline(root, paths.index, definition, domain)?;
    let discovery = discover(&baseline, matches!(index_before, ExpectedFile::Missing))?;
    let selected = capture_selected(root, paths.collection, paths.selector, discovery.locators())?;
    Ok(PhaseFacts {
        baseline,
        index_before,
        discovery,
        selected,
    })
}

struct Selection<'a, S> {
    id: &'a str,
    path: &'a str,
    candidate: bool,
    text: &'a str,
    baseline: &'a crate::index::ValidatedIndex<S>,
}
impl<S, Discovery> PhaseFacts<S, Discovery> {
    fn selection(&self) -> Result<Selection<'_, S>, TxError> {
        let text = selected_text(
            self.selected
                .before
                .as_ref()
                .expect("source retained until planning"),
            &self.selected.id,
        )?;
        Ok(Selection {
            id: &self.selected.id,
            path: &self.selected.old_path,
            candidate: self.selected.candidate,
            text,
            baseline: &self.baseline,
        })
    }
}

/// Counts apply to sources selected and rewritten by this transaction, not unselected candidates.
#[derive(Debug, Default)]
pub struct RewriteImpact {
    pub candidate_relations: usize,
    pub established_relations: usize,
    pub resource_references: usize,
}
