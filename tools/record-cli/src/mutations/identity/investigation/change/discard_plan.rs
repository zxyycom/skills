use super::*;

impl Change<'_, '_> {
    pub(super) fn discard(
        mut self,
        confirm: bool,
        delete: bool,
        history: (Option<String>, bool),
    ) -> Result<ChangeResult, TxError> {
        self.check_discard(confirm, delete, history.1)?;
        let mut result = self.result(history);
        result.deleted_resource_ids = self.deleted_resource_ids()?;
        for (path, _, bytes) in self.tree.iter().rev() {
            result.resource_intents.push(if bytes.is_some() {
                ResourceIntent::RemoveFile { path: path.clone() }
            } else {
                ResourceIntent::RemoveDirectory { path: path.clone() }
            });
        }
        result.writes.push(WriteIntent {
            path: self.old.clone(),
            before: self.take_before(),
            after: None,
            mode: None,
        });
        if !self.candidate {
            result.next.entries.remove(self.id);
            result.next.source_revision.entries.remove(self.id);
        }
        result.commit = if self.candidate {
            CommitPoint::Exited(self.old.clone())
        } else {
            CommitPoint::PublishedIndex(self.operation.index_path.clone())
        };
        Ok(result)
    }
    fn deleted_resource_ids(&self) -> Result<Vec<String>, TxError> {
        let mut ids = Vec::new();
        for (path, _, bytes) in self.tree {
            if bytes.is_some() {
                ids.push(owner::resource_id(self.owner, self.id, path)?);
            }
        }
        ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        Ok(ids)
    }
    fn check_discard(&self, confirm: bool, delete: bool, recorded: bool) -> Result<(), TxError> {
        let refs = self.published_references();
        let target = self.discard_target();
        let fact = if recorded {
            discard::History::Recorded
        } else {
            discard::History::NotRecorded
        };
        discard::plan_discard(
            discard::Domain::Investigation,
            &target,
            &refs,
            discard::DiscardChecks {
                history: fact,
                recorded_deletion_confirmed: confirm,
                owned_resources_deletion_confirmed: delete,
            },
        )
        .map_err(|e| {
            super::super::super::discard_failure(
                discard::Domain::Investigation,
                self.id,
                target.owned_resources.len(),
                e,
            )
        })?;
        if self.present && !delete {
            return Err(super::super::super::explained_failure(
                "resource-confirmation",
                self.id,
                format!(
                    "{} owns an empty resource directory; deletion is not confirmed",
                    self.id
                ),
                "Inspect the owned directory and retry with --delete-owned-resources only after confirming its deletion.",
            ));
        }
        Ok(())
    }
    fn discard_target(&self) -> discard::DiscardTarget {
        discard::DiscardTarget {
            id: self.id.into(),
            source_path: self.old_path.into(),
            candidate: self.candidate,
            owned_resources: self
                .tree
                .iter()
                .filter(|(_, _, b)| b.is_some())
                .map(|(p, _, _)| p.as_path().to_string_lossy().into_owned())
                .collect(),
        }
    }
    fn published_references(&self) -> Vec<discard::PublishedReferences> {
        self.baseline
            .index()
            .entries
            .iter()
            .map(|(id, state)| discard::PublishedReferences {
                source_id: id.clone(),
                relation_targets: state.relations.iter().map(|r| r.target.clone()).collect(),
                resource_owners: state
                    .resource_ids
                    .iter()
                    .filter_map(|r| r.split_once('/').map(|(owner, _)| owner.into()))
                    .collect(),
            })
            .collect()
    }
}
