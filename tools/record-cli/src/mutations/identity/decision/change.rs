use super::*;

pub(super) struct Change<'a> {
    pub operation: &'a DecisionIdentityOperation,
    pub root: &'a Root,
    pub baseline: &'a crate::index::ValidatedIndex<decision::DecisionState>,
    pub locators: &'a BTreeMap<String, (String, bool)>,
    pub occupied: &'a HashSet<String>,
    pub id: &'a str,
    pub old_path: &'a str,
    pub candidate: bool,
    pub old: &'a RelativePath,
    pub before: Option<ExpectedFile>,
    pub front: &'a decision::Frontmatter,
}
pub(super) struct ChangeResult {
    pub writes: Vec<WriteIntent>,
    pub guards: Vec<Guard>,
    pub next: crate::index::IndexV4<decision::DecisionState>,
    pub affected: Vec<String>,
    pub affected_relation_count: usize,
    pub impact: super::super::RewriteImpact,
    pub new_id: Option<String>,
    pub new_path: Option<String>,
    pub no_change: bool,
    pub history_fact: Option<(Option<String>, bool)>,
    pub pending: Option<pending::Observation>,
    pub commit: CommitPoint,
}
impl Change<'_> {
    fn result(&self) -> ChangeResult {
        ChangeResult {
            writes: vec![],
            guards: vec![],
            next: self.baseline.index().clone(),
            affected: vec![],
            affected_relation_count: 0,
            impact: Default::default(),
            new_id: None,
            new_path: None,
            no_change: false,
            history_fact: None,
            pending: None,
            commit: CommitPoint::NoCommit,
        }
    }
    pub(super) fn plan(self) -> Result<ChangeResult, TxError> {
        match &self.operation.action {
            Action::Discard { confirm_recorded } => self.discard(*confirm_recorded),
            Action::Rename {
                target,
                confirm_recorded,
            } => self.rename(target, *confirm_recorded),
        }
    }
    fn discard(mut self, confirm: bool) -> Result<ChangeResult, TxError> {
        let history = self.check_discard(confirm)?;
        let mut result = self.result();
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
        result.history_fact = Some(history);
        result.commit = if self.candidate {
            CommitPoint::Exited(self.old.clone())
        } else {
            CommitPoint::PublishedIndex(self.operation.index_path.clone())
        };
        Ok(result)
    }
    fn check_discard(&self, confirm: bool) -> Result<(Option<String>, bool), TxError> {
        let refs = self.published_references();
        let target = discard::DiscardTarget {
            id: self.id.into(),
            source_path: self.old_path.into(),
            candidate: self.candidate,
            owned_resources: vec![],
        };
        discard::plan_discard(
            discard::Domain::Decision,
            &target,
            &refs,
            discard::DiscardChecks {
                history: discard::History::NotRecorded,
                recorded_deletion_confirmed: true,
                owned_resources_deletion_confirmed: false,
            },
        )
        .map_err(|e| super::super::discard_failure(discard::Domain::Decision, self.id, 0, e))?;
        let history = history(
            self.root,
            &self.operation.collection,
            self.id,
            self.old_path,
            self.candidate,
        )?;
        let fact = if history.1 {
            discard::History::Recorded
        } else {
            discard::History::NotRecorded
        };
        discard::plan_discard(
            discard::Domain::Decision,
            &target,
            &refs,
            discard::DiscardChecks {
                history: fact,
                recorded_deletion_confirmed: confirm,
                owned_resources_deletion_confirmed: false,
            },
        )
        .map_err(|e| super::super::discard_failure(discard::Domain::Decision, self.id, 0, e))?;
        Ok(history)
    }
    fn published_references(&self) -> Vec<discard::PublishedReferences> {
        self.baseline
            .index()
            .entries
            .iter()
            .map(|(id, state)| discard::PublishedReferences {
                source_id: id.clone(),
                relation_targets: state.relations.iter().map(|r| r.target.clone()).collect(),
                resource_owners: vec![],
            })
            .collect()
    }
    fn rename(mut self, target: &str, confirm: bool) -> Result<ChangeResult, TxError> {
        let target_id = target::target_identity(
            target,
            self.id,
            self.front.created_at.as_deref(),
            self.candidate,
        )?;
        let planned = self.rename_plan(&target_id, rename::History::NotRecorded, true)?;
        if planned.no_change {
            let mut result = self.result();
            result.guards.push(Guard {
                path: self.old.clone(),
                before: self.take_before(),
            });
            result.new_id = Some(target_id);
            result.new_path = Some(self.old_path.into());
            result.no_change = true;
            return Ok(result);
        }
        let history = history(
            self.root,
            &self.operation.collection,
            self.id,
            self.old_path,
            self.candidate,
        )?;
        let pending = pending::capture(
            self.root,
            &self.operation.collection,
            &self.operation.index_path,
            history.0.as_deref(),
        )?;
        let fact = if history.1 {
            rename::History::Recorded
        } else {
            rename::History::NotRecorded
        };
        self.rename_plan(&target_id, fact, confirm)?;
        let mut result = self.rename_writes(target_id, planned, history)?;
        result.pending = pending;
        Ok(result)
    }
    fn rename_plan(
        &self,
        target_id: &str,
        fact: rename::History,
        confirm: bool,
    ) -> Result<rename::RenamePlan, TxError> {
        let source = rename::RenameSource {
            id: self.id.into(),
            source_path: self.old_path.into(),
            location: self.location(),
        };
        let identity = rename::RenameIdentity {
            id: target_id.into(),
            name: domains::name_from_id(target_id).into(),
        };
        let others = self
            .locators
            .keys()
            .filter(|x| x.as_str() != self.id)
            .cloned()
            .collect();
        rename::plan_rename(
            &source,
            &identity,
            &others,
            self.occupied,
            rename::RenameHistoryCheck {
                history: fact,
                recorded_rename_confirmed: confirm,
            },
        )
        .map_err(|e| {
            super::super::rename_failure(
                discard::Domain::Decision,
                self.id,
                target_id,
                self.candidate,
                e,
            )
        })
    }
    fn location(&self) -> rename::Location {
        if self.candidate {
            rename::Location::DecisionCandidate
        } else if self.front.status == "archived" {
            rename::Location::DecisionArchived
        } else {
            rename::Location::DecisionActive
        }
    }
    fn take_before(&mut self) -> ExpectedFile {
        self.before.take().expect("selected source consumed once")
    }
    fn rename_writes(
        mut self,
        target_id: String,
        planned: rename::RenamePlan,
        history: (Option<String>, bool),
    ) -> Result<ChangeResult, TxError> {
        let mut result = self.result();
        if target_id != self.id {
            let count = self
                .front
                .relations
                .iter()
                .filter(|relation| relation.target == self.id)
                .count();
            if self.candidate {
                result.impact.candidate_relations = count;
            } else {
                result.impact.established_relations = count;
            }
        }
        let (new, rendered) =
            self.write_source(&target_id, &planned.new_source_path, &mut result)?;
        if !self.candidate {
            self.rewrite_published(&target_id, &planned.new_source_path, &rendered, &mut result)?;
        }
        result.affected_relation_count =
            result.impact.candidate_relations + result.impact.established_relations;
        result.new_id = Some(target_id);
        result.new_path = Some(planned.new_source_path);
        result.history_fact = Some(history);
        result.commit = if !self.candidate {
            CommitPoint::PublishedIndex(self.operation.index_path.clone())
        } else if &new == self.old {
            CommitPoint::Updated(new)
        } else {
            CommitPoint::Renamed {
                old: self.old.clone(),
                new,
            }
        };
        Ok(result)
    }
    fn write_source(
        &mut self,
        target_id: &str,
        path: &str,
        result: &mut ChangeResult,
    ) -> Result<(RelativePath, String), TxError> {
        let new = relative(&self.operation.collection, path)?;
        let new_before = self.capture_destination(&new, path)?;
        let ExpectedFile::Present(file) = self.before.as_ref().expect("selected source") else {
            return Err(fail("source-missing", self.id));
        };
        let rendered = decision::replace_identity(&file.bytes, self.id, self.id, target_id)
            .map_err(|e| fail("render", e))?;
        let file_mode = mode(file);
        if &new == self.old {
            result.writes.push(WriteIntent {
                path: self.old.clone(),
                before: self.take_before(),
                after: Some(rendered.as_bytes().to_vec()),
                mode: None,
            });
        } else {
            result.writes.push(WriteIntent {
                path: new.clone(),
                before: new_before.expect("different path captured"),
                after: Some(rendered.as_bytes().to_vec()),
                mode: Some(WriteMode::Exact(file_mode)),
            });
            result.writes.push(WriteIntent {
                path: self.old.clone(),
                before: self.take_before(),
                after: None,
                mode: None,
            });
        }
        Ok((new, rendered))
    }
    fn capture_destination(
        &self,
        new: &RelativePath,
        path: &str,
    ) -> Result<Option<ExpectedFile>, TxError> {
        let new_before = if new == self.old {
            None
        } else {
            Some(source::capture(self.root, new).map_err(|e| fail("target", e))?)
        };
        if new_before
            .as_ref()
            .is_some_and(|b| *b != ExpectedFile::Missing)
        {
            return Err(super::super::explained_failure(
                "target-exists",
                path,
                format!("target source path already exists: {path}"),
                "Inspect the occupied path and choose an unused target before retrying rename.",
            ));
        }
        Ok(new_before)
    }
    fn rewrite_published(
        &self,
        target_id: &str,
        new_path: &str,
        rendered: &str,
        result: &mut ChangeResult,
    ) -> Result<(), TxError> {
        result.next.entries.remove(self.id);
        result.next.source_revision.entries.remove(self.id);
        let parsed = decision::parse_established(rendered.as_bytes(), target_id, new_path)
            .map_err(|e| fail("source-invalid", e))?;
        result.next.entries.insert(target_id.into(), parsed.state);
        result.next.source_revision.entries.insert(
            target_id.into(),
            source_revision::fingerprint(Domain::Decision, target_id, new_path, rendered),
        );
        (result.affected, result.affected_relation_count) = references::ReferenceRewrite {
            operation: self.operation,
            root: self.root,
            baseline: self.baseline,
            old_id: self.id,
            target_id,
            next: &mut result.next,
            writes: &mut result.writes,
        }
        .apply()?;
        if target_id != self.id {
            result.impact.established_relations += result.affected_relation_count;
        }
        Ok(())
    }
}
