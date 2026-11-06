use super::*;

use super::super::Selection;
impl Selection<'_, decision::DecisionState> {
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
        let (id, candidate) = decision::candidate_header(self.text, self.path)
            .map_err(|e| fail("source-invalid", e))?;
        if id.as_deref() != Some(self.id) || candidate != self.candidate {
            return Err(fail(
                "source-invalid",
                "selected identity or lifecycle changed",
            ));
        }
        self.check_fingerprint()?;
        let location = if self.candidate {
            rename::Location::DecisionCandidate
        } else if self.baseline.index().entries[self.id].status == "archived" {
            rename::Location::DecisionArchived
        } else {
            rename::Location::DecisionActive
        };
        let source = rename::RenameSource {
            id: self.id.into(),
            source_path: self.path.into(),
            location,
        };
        super::super::identity_allocation_unchanged(&source, locators, occupied)
    }
    fn check_fingerprint(&self) -> Result<(), TxError> {
        if !self.candidate
            && source_revision::fingerprint(Domain::Decision, self.id, self.path, self.text)
                != self.baseline.index().source_revision.entries[self.id]
        {
            return Err(fail("source-stale", self.id));
        }
        Ok(())
    }
    pub(super) fn validate(&self, bytes: &[u8]) -> Result<decision::Frontmatter, TxError> {
        crate::index::QuerySnapshot::new(self.baseline.clone())
            .graph(&Definition)
            .map_err(|e| fail("index-invalid", e))?;
        let front =
            decision::parse_frontmatter(bytes, self.id).map_err(|e| fail("source-invalid", e))?;
        if self.candidate {
            let doc =
                decision::parse_candidate(bytes, self.id).map_err(|e| fail("source-invalid", e))?;
            if !doc.readiness.scaffold_valid {
                return Err(fail("source-invalid", doc.diagnostics.join("; ")));
            }
        } else {
            let parsed = decision::parse_established(bytes, self.id, self.path)
                .map_err(|e| fail("source-invalid", e))?;
            if parsed.state != self.baseline.index().entries[self.id] {
                return Err(fail("source-stale", self.id));
            }
            self.check_fingerprint()?;
        }
        Ok(front)
    }
}
