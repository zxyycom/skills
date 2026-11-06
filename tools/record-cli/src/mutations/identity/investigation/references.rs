use super::*;

pub(super) struct ReferenceRewrite<'a> {
    pub operation: &'a InvestigationIdentityOperation,
    pub root: &'a Root,
    pub baseline: &'a crate::index::ValidatedIndex<investigation::InvestigationState>,
    pub old_id: &'a str,
    pub target_id: &'a str,
    pub next: &'a mut crate::index::IndexV4<investigation::InvestigationState>,
    pub writes: &'a mut Vec<WriteIntent>,
}

impl ReferenceRewrite<'_> {
    pub(super) fn apply(mut self) -> Result<(Vec<String>, usize, usize), TxError> {
        let baseline = self.baseline;
        let id = self.old_id;
        let mut affected = Vec::new();
        let mut affected_relation_count = 0;
        let mut resource_count = 0;
        for (other, state) in &baseline.index().entries {
            if other.as_str() == id
                || (!state.relations.iter().any(|r| r.target == id)
                    && !state
                        .resource_ids
                        .iter()
                        .any(|r| r.starts_with(&format!("{id}/"))))
            {
                continue;
            }
            affected_relation_count += state.relations.iter().filter(|r| r.target == id).count();
            resource_count += self.rewrite(other, state)?;
            affected.push(other.clone());
        }
        Ok((affected, affected_relation_count, resource_count))
    }
    fn rewrite(
        &mut self,
        other: &String,
        state: &investigation::InvestigationState,
    ) -> Result<usize, TxError> {
        let path = rel(&self.operation.collection, &state.source_path)?;
        let b = source::capture(self.root, &path).map_err(|e| fail("reference", e))?;
        let ExpectedFile::Present(ref file) = b else {
            return Err(fail("reference-missing", other));
        };
        let text = std::str::from_utf8(&file.bytes).map_err(|e| fail("reference", e))?;
        let parsed = investigation::parse_established(&file.bytes, other, &state.source_path)
            .map_err(|e| fail("reference-invalid", e))?;
        if parsed.state != *state
            || source_revision::fingerprint(Domain::Investigation, other, &state.source_path, text)
                != self.baseline.index().source_revision.entries[other]
        {
            return Err(fail("reference-stale", other));
        }
        let resource_count = resource_references(text, self.old_id);
        let rendered = self.render_reference(&file.bytes, other)?;
        self.next.entries.insert(
            other.clone(),
            investigation::parse_established(rendered.as_bytes(), other, &state.source_path)
                .map_err(|e| fail("reference-invalid", e))?
                .state,
        );
        self.next.source_revision.entries.insert(
            other.clone(),
            source_revision::fingerprint(
                Domain::Investigation,
                other,
                &state.source_path,
                &rendered,
            ),
        );
        self.writes.push(WriteIntent {
            path,
            before: b,
            after: Some(rendered.into_bytes()),
            mode: None,
        });
        Ok(resource_count)
    }
    fn render_reference(&self, bytes: &[u8], other: &str) -> Result<String, TxError> {
        investigation::replace_identity(bytes, other, self.old_id, self.target_id)
            .map_err(|e| fail("render", e))
    }
}

pub(super) fn resource_references(text: &str, id: &str) -> usize {
    text.matches(&format!("](./_resources/{id}/")).count()
}
