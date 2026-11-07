use super::{Entry, SelectedUpdate};
use crate::{
    index::IndexV4,
    source::{self, ExpectedFile, RelativePath, Root},
    source_revision::{Domain, fingerprint},
    transaction::TxError,
};
use std::collections::{BTreeMap, BTreeSet};

pub(in crate::mutations) struct SourceAdapter<S> {
    pub domain: Domain,
    pub path: fn(&S) -> &str,
    pub identity: fn(&str) -> Option<String>,
    pub parse: fn(&[u8], &str, &str) -> Result<S, String>,
}
fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}

pub(in crate::mutations) struct SelectedSources<S> {
    pub updates: BTreeMap<String, SelectedUpdate<S>>,
}

pub(in crate::mutations) struct SourceScope<'a, S> {
    pub root: &'a Root,
    pub dir: &'a RelativePath,
    pub baseline: &'a IndexV4<S>,
    pub adapter: &'a SourceAdapter<S>,
}

pub(in crate::mutations) struct SelectedFacts<S> {
    pub updates: BTreeMap<String, SelectedUpdate<S>>,
    pub combined: BTreeMap<String, S>,
    pub dependencies: BTreeSet<String>,
}

impl<S> SourceScope<'_, S> {
    pub fn collect_facts(
        &self,
        selected: &BTreeSet<String>,
        related: fn(&BTreeMap<String, S>, &BTreeSet<String>) -> BTreeSet<String>,
    ) -> Result<SelectedFacts<S>, TxError>
    where
        S: Clone + PartialEq,
    {
        let SelectedSources { updates } = self.selected_sources(selected)?;
        let combined = super::combine_selected(&self.baseline.entries, &updates);
        let mut dependencies = related(&self.baseline.entries, selected);
        dependencies.extend(related(&combined, selected));
        self.dependencies(selected, &dependencies)?;
        Ok(SelectedFacts {
            updates,
            combined,
            dependencies,
        })
    }
    pub fn selected_sources(
        &self,
        selected: &BTreeSet<String>,
    ) -> Result<SelectedSources<S>, TxError> {
        let Self {
            root,
            dir,
            baseline,
            adapter,
        } = self;
        let mut updates = initial_updates(baseline, selected);
        for old_id in selected {
            let Some(old) = baseline.entries.get(old_id) else {
                continue;
            };
            let path = RelativePath::new(dir.as_path().join((adapter.path)(old)))
                .map_err(|e| fail("source-path", e.to_string()))?;
            let observed =
                source::capture(root, &path).map_err(|e| fail("source-read", e.to_string()))?;
            if let ExpectedFile::Present(file) = &observed {
                self.update_present(old_id, selected, file, &mut updates)?;
            }
        }
        for id in selected {
            if !updates.contains_key(id) {
                return Err(fail(
                    "unknown-selected-id",
                    format!("{id}: full sync required for unknown location"),
                ));
            }
        }
        Ok(SelectedSources { updates })
    }
    fn update_present(
        &self,
        old_id: &str,
        selected: &BTreeSet<String>,
        file: &source::SourceSnapshot,
        updates: &mut BTreeMap<String, SelectedUpdate<S>>,
    ) -> Result<(), TxError> {
        let baseline = self.baseline;
        let adapter = self.adapter;
        let old = &baseline.entries[old_id];
        let text =
            std::str::from_utf8(&file.bytes).map_err(|e| fail("source-encoding", e.to_string()))?;
        let id = self.selected_identity(old_id, selected, text)?;
        let parsed = (adapter.parse)(&file.bytes, &id, (adapter.path)(old))
            .map_err(|e| fail("source-invalid", e))?;
        let revision = fingerprint(adapter.domain, &id, (adapter.path)(old), text);
        if updates.get(&id).is_some_and(|u| u.current.is_some()) {
            return Err(fail("duplicate-id", id));
        }
        updates.insert(
            id.clone(),
            SelectedUpdate {
                id,
                current: Some(Entry {
                    state: parsed,
                    revision,
                }),
                located_from: ((adapter.identity)(text).as_deref() != Some(old_id))
                    .then(|| old_id.to_owned()),
            },
        );
        Ok(())
    }

    fn selected_identity(
        &self,
        old_id: &str,
        selected: &BTreeSet<String>,
        text: &str,
    ) -> Result<String, TxError> {
        let baseline = self.baseline;
        let adapter = self.adapter;
        let old = &baseline.entries[old_id];
        let identity_error = |error| {
            super::source_failure_with_reason(
                error,
                adapter.domain,
                format!(
                    "Selected source identity changed at {}; explicitly select both old and new IDs or run full sync-index",
                    (adapter.path)(old)
                ),
            )
        };
        let id = (adapter.identity)(text).ok_or_else(|| {
            identity_error(fail(
                "source-invalid",
                format!("missing identity: {}", (adapter.path)(old)),
            ))
        })?;
        if !selected.contains(&id) {
            return Err(identity_error(fail(
                "identity-changed",
                format!("select both old and new IDs at {}", (adapter.path)(old)),
            )));
        }
        if id != old_id && baseline.entries.contains_key(&id) {
            return Err(fail("duplicate-id", id));
        }
        Ok(id)
    }
    pub fn dependencies(
        &self,
        selected: &BTreeSet<String>,
        dependencies: &BTreeSet<String>,
    ) -> Result<(), TxError>
    where
        S: PartialEq,
    {
        dependencies
            .iter()
            .filter(|id| !selected.contains(*id))
            .try_for_each(|id| self.dependency(id))
    }
    fn dependency(&self, id: &str) -> Result<(), TxError>
    where
        S: PartialEq,
    {
        let Self {
            root,
            dir,
            baseline,
            adapter,
        } = self;
        let expected = baseline
            .entries
            .get(id)
            .ok_or_else(|| fail("dependency-missing", id.to_owned()))?;
        let path = RelativePath::new(dir.as_path().join((adapter.path)(expected)))
            .map_err(|e| fail("source-path", e.to_string()))?;
        let observed =
            source::capture(root, &path).map_err(|e| fail("source-read", e.to_string()))?;
        let ExpectedFile::Present(file) = &observed else {
            return Err(fail("dependency-missing", id.to_owned()));
        };
        let text =
            std::str::from_utf8(&file.bytes).map_err(|e| fail("source-encoding", e.to_string()))?;
        let parsed = (adapter.parse)(&file.bytes, id, (adapter.path)(expected))
            .map_err(|e| fail("dependency-invalid", e))?;
        if parsed != *expected
            || fingerprint(adapter.domain, id, (adapter.path)(expected), text)
                != baseline.source_revision.entries[id]
        {
            return Err(super::source_failure_with_reason(
                fail("dependency-stale", id.to_owned()),
                adapter.domain,
                format!(
                    "Required dependency differs from published baseline: {id}; select it explicitly or run full sync-index"
                ),
            ));
        }
        Ok(())
    }
}

fn initial_updates<S>(
    baseline: &IndexV4<S>,
    selected: &BTreeSet<String>,
) -> BTreeMap<String, SelectedUpdate<S>> {
    selected
        .iter()
        .filter(|id| baseline.entries.contains_key(*id))
        .map(|id| {
            (
                id.clone(),
                SelectedUpdate {
                    id: id.clone(),
                    current: None,
                    located_from: None,
                },
            )
        })
        .collect()
}
