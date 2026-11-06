use super::*;

pub(super) struct ReferenceRewrite<'a> {
    pub operation: &'a DecisionIdentityOperation,
    pub root: &'a Root,
    pub baseline: &'a crate::index::ValidatedIndex<decision::DecisionState>,
    pub old_id: &'a str,
    pub target_id: &'a str,
    pub next: &'a mut crate::index::IndexV4<decision::DecisionState>,
    pub writes: &'a mut Vec<WriteIntent>,
}

impl ReferenceRewrite<'_> {
    pub(super) fn apply(mut self) -> Result<(Vec<String>, usize), TxError> {
        let baseline = self.baseline;
        let id = self.old_id;
        let mut affected = Vec::new();
        let mut affected_relation_count = 0;
        for (ref_id, state) in &baseline.index().entries {
            if ref_id.as_str() == id || !state.relations.iter().any(|r| r.target == id) {
                continue;
            }
            affected_relation_count += state.relations.iter().filter(|r| r.target == id).count();
            self.rewrite(ref_id, state)?;
            affected.push(ref_id.clone());
        }
        Ok((affected, affected_relation_count))
    }
    fn rewrite(&mut self, ref_id: &String, state: &decision::DecisionState) -> Result<(), TxError> {
        let path = relative(&self.operation.collection, &state.source_path)?;
        let capture = source::capture(self.root, &path).map_err(|e| fail("reference", e))?;
        let ExpectedFile::Present(ref source) = capture else {
            return Err(fail("reference-missing", ref_id));
        };
        let text = std::str::from_utf8(&source.bytes).map_err(|e| fail("reference", e))?;
        let parsed = decision::parse_established(&source.bytes, ref_id, &state.source_path)
            .map_err(|e| fail("reference-invalid", e))?;
        if parsed.state != *state
            || source_revision::fingerprint(Domain::Decision, ref_id, &state.source_path, text)
                != self.baseline.index().source_revision.entries[ref_id]
        {
            return Err(fail("reference-stale", ref_id));
        }
        let rendered =
            decision::replace_identity(&source.bytes, ref_id, self.old_id, self.target_id)
                .map_err(|e| fail("render", e))?;
        let parsed = decision::parse_established(rendered.as_bytes(), ref_id, &state.source_path)
            .map_err(|e| fail("reference-invalid", e))?;
        self.next.entries.insert(ref_id.clone(), parsed.state);
        self.next.source_revision.entries.insert(
            ref_id.clone(),
            source_revision::fingerprint(Domain::Decision, ref_id, &state.source_path, &rendered),
        );
        self.writes.push(WriteIntent {
            path,
            before: capture,
            after: Some(rendered.into_bytes()),
            mode: None,
        });
        Ok(())
    }
}
