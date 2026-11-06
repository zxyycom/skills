use super::*;
mod discard_plan;

pub(super) struct Change<'a, 'root> {
    pub operation: &'a InvestigationIdentityOperation,
    pub root: &'root Root,
    pub baseline: &'a crate::index::ValidatedIndex<investigation::InvestigationState>,
    pub locators: &'a BTreeMap<String, (String, bool)>,
    pub occupied: &'a HashSet<String>,
    pub id: &'a str,
    pub old_path: &'a str,
    pub candidate: bool,
    pub old: &'a RelativePath,
    pub before: Option<ExpectedFile>,
    pub front: Option<&'a investigation::Frontmatter>,
    pub resources: &'a mut crate::resources::ResourceContext<'root>,
    pub owner: &'a RelativePath,
    pub present: bool,
    pub tree: &'a [(RelativePath, source::FileIdentity, Option<Vec<u8>>)],
}
pub(super) struct ChangeResult {
    pub resource_intents: Vec<ResourceIntent>,
    pub owner_moved: bool,
    pub deleted_resource_ids: Vec<String>,
    pub next: crate::index::IndexV4<investigation::InvestigationState>,
    pub writes: Vec<WriteIntent>,
    pub guards: Vec<Guard>,
    pub affected: Vec<String>,
    pub affected_relation_count: usize,
    pub impact: super::super::RewriteImpact,
    pub history: (Option<String>, bool),
    pub new_id: Option<String>,
    pub new_path: Option<String>,
    pub commit: CommitPoint,
}
impl Change<'_, '_> {
    fn result(&self, history: (Option<String>, bool)) -> ChangeResult {
        ChangeResult {
            resource_intents: vec![],
            owner_moved: false,
            deleted_resource_ids: Vec::new(),
            next: self.baseline.index().clone(),
            writes: vec![],
            guards: vec![],
            affected: vec![],
            affected_relation_count: 0,
            impact: Default::default(),
            history,
            new_id: None,
            new_path: None,
            commit: CommitPoint::NoCommit,
        }
    }
    pub(super) fn plan(self) -> Result<ChangeResult, TxError> {
        let history = history(
            self.root,
            &self.operation.collection,
            self.id,
            self.old_path,
            self.candidate,
        )?;
        match self.operation.action.clone() {
            Action::Discard {
                confirm_recorded,
                delete_owned_resources,
            } => self.discard(confirm_recorded, delete_owned_resources, history),
            Action::Rename {
                target,
                confirm_recorded_report,
                confirm_recorded_candidate,
            } => {
                let confirm = if self.candidate {
                    confirm_recorded_candidate
                } else {
                    confirm_recorded_report
                };
                self.rename(&target, confirm, history)
            }
        }
    }
    fn rename(
        mut self,
        target: &str,
        confirm: bool,
        history: (Option<String>, bool),
    ) -> Result<ChangeResult, TxError> {
        let target_id = target::target_identity(
            target,
            &self.front.expect("rename parses frontmatter").formed_at,
        )?;
        let planned = self.rename_plan(&target_id, confirm, history.1)?;
        let mut result = self.result(history);
        self.count_selected_relations(&target_id, &mut result);
        self.plan_owner(&target_id, &mut result)?;
        let (new, rendered) =
            self.write_source(&target_id, &planned.new_source_path, &mut result)?;
        if !self.candidate {
            self.rewrite_published(&target_id, &planned.new_source_path, &rendered, &mut result)?;
        }
        result.affected_relation_count =
            result.impact.candidate_relations + result.impact.established_relations;
        result.new_id = Some(target_id);
        result.new_path = Some(planned.new_source_path);
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
    fn count_selected_relations(&self, target_id: &str, result: &mut ChangeResult) {
        if target_id != self.id {
            let count = self
                .front
                .expect("rename parses frontmatter")
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
    }
    fn rename_plan(
        &self,
        target_id: &str,
        confirm: bool,
        recorded: bool,
    ) -> Result<rename::RenamePlan, TxError> {
        let source = rename::RenameSource {
            id: self.id.into(),
            source_path: self.old_path.into(),
            location: if self.candidate {
                rename::Location::InvestigationCandidate
            } else {
                rename::Location::InvestigationFormal
            },
        };
        let identity = rename::RenameIdentity {
            id: target_id.into(),
            name: domains::name_from_id(target_id).into(),
        };
        let others = self
            .locators
            .keys()
            .filter(|id| id.as_str() != self.id)
            .cloned()
            .collect();
        let fact = if recorded {
            rename::History::Recorded
        } else {
            rename::History::NotRecorded
        };
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
                discard::Domain::Investigation,
                self.id,
                target_id,
                self.candidate,
                e,
            )
        })
    }
    fn plan_owner(&mut self, target_id: &str, result: &mut ChangeResult) -> Result<(), TxError> {
        if target_id != self.id {
            self.resources
                .require_owner_absent(target_id)
                .map_err(|e| super::super::explained_failure(
                    "resource-owner", target_id, format!("target resource owner cannot be proven absent: {e}"),
                    "Inspect the target resource owner and choose an unused identity before retrying rename.",
                ))?;
        }
        if self.present && target_id != self.id {
            let destination = rel(
                &self.operation.collection,
                &format!("_resources/{target_id}"),
            )?;
            result.resource_intents.push(ResourceIntent::MoveDirectory {
                source: self.owner.clone(),
                destination,
            });
            result.owner_moved = true;
        }
        Ok(())
    }
    fn take_before(&mut self) -> ExpectedFile {
        self.before.take().expect("selected source consumed once")
    }
    fn write_source(
        &mut self,
        target_id: &str,
        path: &str,
        result: &mut ChangeResult,
    ) -> Result<(RelativePath, String), TxError> {
        let ExpectedFile::Present(file) = self.before.as_ref().expect("selected source") else {
            return Err(fail("source-missing", self.id));
        };
        if target_id != self.id {
            let text = std::str::from_utf8(&file.bytes).map_err(|e| fail("source", e))?;
            result.impact.resource_references += references::resource_references(text, self.id);
        }
        let rendered = investigation::replace_identity(&file.bytes, self.id, self.id, target_id)
            .map_err(|e| fail("render", e))?;
        let file_mode = mode(file);
        let new = rel(&self.operation.collection, path)?;
        if &new == self.old {
            result.writes.push(WriteIntent {
                path: self.old.clone(),
                before: self.take_before(),
                after: Some(rendered.as_bytes().to_vec()),
                mode: None,
            });
        } else {
            let before = self.capture_target(&new, path)?;
            result.writes.push(WriteIntent {
                path: new.clone(),
                before,
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
    fn capture_target(&self, new: &RelativePath, path: &str) -> Result<ExpectedFile, TxError> {
        let before = source::capture(self.root, new).map_err(|e| fail("target", e))?;
        if before != ExpectedFile::Missing {
            return Err(super::super::explained_failure(
                "target-exists",
                path,
                format!("target source path already exists: {path}"),
                "Inspect the occupied path and choose an unused target before retrying rename.",
            ));
        }
        Ok(before)
    }
    fn rewrite_published(
        &self,
        target_id: &str,
        path: &str,
        rendered: &str,
        result: &mut ChangeResult,
    ) -> Result<(), TxError> {
        result.next.entries.remove(self.id);
        result.next.source_revision.entries.remove(self.id);
        let state = investigation::parse_established(rendered.as_bytes(), target_id, path)
            .map_err(|e| fail("source-invalid", e))?
            .state;
        result.next.entries.insert(target_id.into(), state);
        result.next.source_revision.entries.insert(
            target_id.into(),
            source_revision::fingerprint(Domain::Investigation, target_id, path, rendered),
        );
        let (affected, relation_count, resource_count) = references::ReferenceRewrite {
            operation: self.operation,
            root: self.root,
            baseline: self.baseline,
            old_id: self.id,
            target_id,
            next: &mut result.next,
            writes: &mut result.writes,
        }
        .apply()?;
        result.affected = affected;
        result.affected_relation_count = relation_count;
        if target_id != self.id {
            result.impact.established_relations += relation_count;
            result.impact.resource_references += resource_count;
        }
        Ok(())
    }
}
