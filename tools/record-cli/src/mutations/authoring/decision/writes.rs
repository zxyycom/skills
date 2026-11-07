use super::*;

pub(super) struct WritePreparation<'a> {
    pub operation: &'a DecisionEvolutionOperation,
    pub root: &'a Root,
    pub baseline: &'a index::ValidatedIndex<decision::DecisionState>,
    pub ids: &'a BTreeMap<String, Located>,
    pub candidates: &'a BTreeSet<String>,
    pub selected: &'a BTreeMap<String, Alignment>,
    pub discarded: &'a Option<String>,
    pub archive: &'a Option<source::DirectorySnapshot>,
}
pub(super) struct Writes {
    pub final_index: index::ValidatedIndex<decision::DecisionState>,
    pub writes: Vec<WriteIntent>,
    pub resources: Vec<ResourceIntent>,
}
struct ArchiveSource {
    before: ExpectedFile,
    target: String,
    target_before: ExpectedFile,
}
struct Proposal {
    next: index::IndexV4<decision::DecisionState>,
    writes: Vec<WriteIntent>,
    resources: Vec<ResourceIntent>,
}
impl WritePreparation<'_> {
    pub fn build(
        self,
        mut sources: BTreeMap<String, ExpectedFile>,
        successors: &[evolution::Successor],
        preliminary: &evolution::EvolutionPlan,
    ) -> Result<Writes, TxError> {
        let mut proposed = Proposal {
            next: self.baseline.index().clone(),
            writes: Vec::new(),
            resources: Vec::new(),
        };
        for successor in successors {
            let before = sources.remove(&successor.id).unwrap();
            self.successor(&mut proposed, successor, before)?;
        }
        self.archive_predecessors(&mut proposed, &preliminary.archive_ids)?;
        if let Some(id) = self.discarded {
            self.discard_record(&mut proposed, id)?;
        }
        let Proposal {
            next,
            writes,
            resources,
        } = proposed;
        let final_index =
            index::build_index(next, &Definition).map_err(|e| fail("graph-invalid", e))?;
        index::QuerySnapshot::new(final_index.clone())
            .graph(&Definition)
            .map_err(|e| fail("graph-invalid", e))?;
        Ok(Writes {
            final_index,
            writes,
            resources,
        })
    }
    fn archive_predecessors(
        &self,
        proposed: &mut Proposal,
        archive_ids: &[String],
    ) -> Result<(), TxError> {
        if !archive_ids.is_empty() && self.archive.is_none() {
            proposed.resources.push(ResourceIntent::CreateDirectory {
                path: path(&self.operation.collection, "archive")?,
            });
        }
        for id in archive_ids {
            self.archive_record(proposed, id)?;
        }
        Ok(())
    }
    fn successor(
        &self,
        proposed: &mut Proposal,
        successor: &evolution::Successor,
        before: ExpectedFile,
    ) -> Result<(), TxError> {
        let Self { operation, ids, .. } = self;
        let Proposal { next, writes, .. } = proposed;
        let id = &successor.id;
        let ExpectedFile::Present(file) = &before else {
            unreachable!()
        };
        let front =
            decision::parse_frontmatter(&file.bytes, id).map_err(|e| fail("source-invalid", e))?;
        let changed = successor.candidate || successor.before != successor.after;
        if changed {
            let (text, state) = self.render_successor(successor, &file.bytes, &front)?;
            next.source_revision.entries.insert(
                id.to_owned(),
                source_revision::fingerprint(Domain::Decision, id, &ids[id].path, &text),
            );
            next.entries.insert(id.to_owned(), state);
            writes.push(WriteIntent {
                path: path(&operation.collection, &ids[id].path)?,
                before,
                after: Some(text.into_bytes()),
            });
        }
        Ok(())
    }

    fn render_successor(
        &self,
        successor: &evolution::Successor,
        bytes: &[u8],
        front: &decision::Frontmatter,
    ) -> Result<(String, decision::DecisionState), TxError> {
        let Self { operation, ids, .. } = self;
        let id = &successor.id;
        let alignment = match successor.requested_alignment {
            Alignment::Aligned => "aligned",
            Alignment::Unaligned => "unaligned",
        };
        let relations: Vec<_> = successor.after.iter().map(domain_relation).collect();
        let text = decision::replace_metadata(
            bytes,
            id,
            decision::MetadataUpdate {
                status: if successor.candidate {
                    "active"
                } else {
                    &front.status
                },
                alignment: Some(alignment),
                created_at: Some(front.created_at.as_deref().unwrap_or(&operation.timestamp)),
                relations: Some(&relations),
            },
        )
        .map_err(|e| fail("source-render", e))?;
        let parsed = decision::parse_established(text.as_bytes(), id, &ids[id].path)
            .map_err(|e| fail("source-render", e))?;
        Ok((text, parsed.state))
    }

    fn archive_record(&self, proposed: &mut Proposal, id: &str) -> Result<(), TxError> {
        let operation = self.operation;
        let Proposal { next, writes, .. } = proposed;
        let ArchiveSource {
            before,
            target,
            target_before,
        } = self.capture_archive(id)?;
        let state = &self.baseline.index().entries[id];
        let ExpectedFile::Present(file) = &before else {
            unreachable!()
        };
        let (text, state_after) = render_archived(&file.bytes, id, state, &target)?;
        next.source_revision.entries.insert(
            id.to_owned(),
            source_revision::fingerprint(Domain::Decision, id, &target, &text),
        );
        next.entries.insert(id.to_owned(), state_after);
        writes.push(WriteIntent {
            path: path(&operation.collection, &target)?,
            before: target_before,
            after: Some(text.into_bytes()),
        });
        writes.push(WriteIntent {
            path: path(&operation.collection, &state.source_path)?,
            before,
            after: None,
        });
        Ok(())
    }

    fn capture_archive(&self, id: &str) -> Result<ArchiveSource, TxError> {
        if self.selected.contains_key(id) || self.discarded.as_deref() == Some(id) {
            return Err(fail("evolution", "predecessor conflicts with selection"));
        }
        let state = &self.baseline.index().entries[id];
        let before = validate_source(
            self.root,
            &self.operation.collection,
            id,
            state,
            &self.baseline.index().source_revision.entries[id],
        )?;
        let target = format!("archive/{}", state.source_path);
        let target_before = capture(self.root, &self.operation.collection, &target)?;
        if target_before != ExpectedFile::Missing {
            return Err(fail("target-exists", target));
        }
        Ok(ArchiveSource {
            before,
            target,
            target_before,
        })
    }
    fn discard_record(&self, proposed: &mut Proposal, id: &str) -> Result<(), TxError> {
        let Self {
            operation,
            root,
            baseline,
            ids,
            candidates,
            ..
        } = self;
        let Proposal { next, writes, .. } = proposed;
        let is_candidate = candidates.contains(id);
        let before = if is_candidate {
            capture(root, &operation.collection, &ids[id].path)?
        } else {
            let state = &baseline.index().entries[id];
            validate_source(
                root,
                &operation.collection,
                id,
                state,
                &baseline.index().source_revision.entries[id],
            )?
        };
        let ExpectedFile::Present(file) = &before else {
            return Err(fail("discard", "source missing"));
        };
        if is_candidate {
            let parsed = decision::parse_candidate(&file.bytes, id)
                .map_err(|e| fail("discard-invalid", e))?;
            if !parsed.readiness.scaffold_valid {
                return Err(fail("discard-invalid", parsed.diagnostics.join("; ")));
            }
        }
        next.entries.remove(id);
        next.source_revision.entries.remove(id);
        writes.push(WriteIntent {
            path: path(&operation.collection, &ids[id].path)?,
            before,
            after: None,
        });
        Ok(())
    }
}

fn render_archived(
    bytes: &[u8],
    id: &str,
    state: &decision::DecisionState,
    target: &str,
) -> Result<(String, decision::DecisionState), TxError> {
    let text = decision::replace_metadata(
        bytes,
        id,
        decision::MetadataUpdate {
            status: "archived",
            alignment: Some(&state.alignment),
            created_at: Some(&state.created_at),
            relations: None,
        },
    )
    .map_err(|e| fail("source-render", e))?;
    let parsed = decision::parse_established(text.as_bytes(), id, target)
        .map_err(|e| fail("source-render", e))?;
    Ok((text, parsed.state))
}
