use super::*;
use crate::domains::{SelectorError, resolve_selector};

/// Selector resolution against the snapshots captured in one acquisition phase.
pub(super) struct Selection<'a, S, F> {
    pub namespace: &'a str,
    pub index_path: &'a RelativePath,
    pub pending: &'a ContentSnapshot,
    pub indexes: [Option<&'a ValidatedIndex<S>>; 3],
    pub selectors: &'a [String],
    pub extra_ids: &'a [String],
    pub scope: StageScope,
    pub name: F,
}
impl<S, F> Selection<'_, S, F>
where
    F: Fn(&S) -> &str + Copy,
{
    pub fn resolve(&self) -> Result<Vec<String>, IndexStageError> {
        let mut selected = Vec::new();
        let mut seen_inputs = BTreeSet::new();
        let mut seen_ids = BTreeSet::new();
        for selector in self.selectors {
            if !seen_inputs.insert(selector) {
                return Err(IndexStageError::Selection("duplicate selector".into()));
            }
            let id = self.resolve_one(selector)?;
            if !seen_ids.insert(id.clone()) && self.namespace == "decisions" {
                return Err(IndexStageError::Selection(
                    "duplicate resolved selector".into(),
                ));
            }
            selected.push(id);
        }
        Ok(selected)
    }

    fn resolve_one(&self, selector: &str) -> Result<String, IndexStageError> {
        let mut matches = self.indexed_matches(selector)?;
        if matches.is_empty()
            && let Some(id) = self.literal_fallback(selector)
        {
            matches.insert(id);
        }
        if matches.is_empty() {
            return Err(IndexStageError::SelectorUnresolved {
                selector: selector.to_owned(),
            });
        }
        if matches.len() != 1 {
            return Err(IndexStageError::Selection(
                "ambiguous selector across snapshots".into(),
            ));
        }
        Ok(matches.into_iter().next().expect("one match"))
    }

    /// Merge identities resolved independently in all observed snapshots.
    fn indexed_matches(&self, selector: &str) -> Result<BTreeSet<String>, IndexStageError> {
        let mut matches = BTreeSet::new();
        for index in self.indexes.into_iter().flatten() {
            match resolve_selector(&index.index().entries, selector, self.name) {
                Ok((id, _)) => {
                    matches.insert(id.to_owned());
                }
                Err(SelectorError::NotFound) => {}
                Err(SelectorError::Ambiguous(_)) => {
                    return Err(IndexStageError::Selection("ambiguous selector".into()));
                }
            }
        }
        for id in self.extra_ids {
            if selector == id.as_str() || selector == crate::domains::name_from_id(id) {
                matches.insert(id.clone());
            }
        }
        Ok(matches)
    }

    /// Domain-specific pending-only locators never infer identities from unrelated blobs.
    fn literal_fallback(&self, selector: &str) -> Option<String> {
        match self.namespace {
            "decisions"
                if self.scope != StageScope::Index
                    && self.pending.membership().entries.iter().any(|entry| {
                        decision_pending_basename(self.index_path.as_path(), &entry.path)
                            == Some(selector)
                    }) =>
            {
                dated_id(selector)
            }
            "investigations" => {
                let normalized = if selector
                    .get(selector.len().saturating_sub(3)..)
                    .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".md"))
                {
                    &selector[..selector.len() - 3]
                } else {
                    selector
                };
                dated_id(normalized)
            }
            _ => None,
        }
    }
}

fn dated_id(value: &str) -> Option<String> {
    (crate::domains::is_kebab(value) && crate::domains::name_from_id(value) != value)
        .then(|| value.to_owned())
}
