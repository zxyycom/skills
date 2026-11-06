use super::*;

use super::super::Selection;
impl Selection<'_, investigation::InvestigationState> {
    pub(super) fn validate_identity(&self) -> Result<(), TxError> {
        if investigation::id_from_markdown(self.text).as_deref() != Some(self.id) {
            return Err(fail("source-invalid", "selected identity changed"));
        }
        if !self.candidate
            && source_revision::fingerprint(Domain::Investigation, self.id, self.path, self.text)
                != self.baseline.index().source_revision.entries[self.id]
        {
            return Err(fail("source-stale", self.id));
        }
        Ok(())
    }
    pub(super) fn noop(
        &self,
        action: &Action,
        locators: &BTreeMap<String, (String, bool)>,
        occupied: &HashSet<String>,
    ) -> Result<bool, TxError> {
        let Action::Rename { target, .. } = action else {
            return Ok(false);
        };
        if !super::super::matches_identity(target, self.id) {
            return Ok(false);
        }
        let location = if self.candidate {
            rename::Location::InvestigationCandidate
        } else {
            rename::Location::InvestigationFormal
        };
        let source = rename::RenameSource {
            id: self.id.into(),
            source_path: self.path.into(),
            location,
        };
        super::super::identity_allocation_unchanged(&source, locators, occupied)
    }
    pub(super) fn validate(
        &self,
        bytes: &[u8],
        action: &Action,
    ) -> Result<Option<investigation::Frontmatter>, TxError> {
        crate::index::QuerySnapshot::new(self.baseline.clone())
            .graph(&Definition)
            .map_err(|e| fail("index-invalid", e))?;
        let front = if self.candidate && matches!(action, Action::Discard { .. }) {
            None
        } else {
            Some(
                investigation::parse_frontmatter(bytes, self.id)
                    .map_err(|e| fail("source-invalid", e))?,
            )
        };
        if !self.candidate {
            let doc = investigation::parse_established(bytes, self.id, self.path)
                .map_err(|e| fail("source-invalid", e))?;
            if doc.state != self.baseline.index().entries[self.id] {
                return Err(fail("source-stale", self.id));
            }
        }
        Ok(front)
    }
}
