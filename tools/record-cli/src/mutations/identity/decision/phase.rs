use super::*;

struct Phase<'a> {
    operation: &'a DecisionIdentityOperation,
    root: &'a Root,
    facts: super::super::PhaseFacts<decision::DecisionState, discovery::Discovery>,
}
impl DecisionIdentityOperation {
    pub(super) fn phase(&self, root: &Root) -> Result<Plan<PreparedIdentity>, TxError> {
        Phase::capture(self, root)?.plan()
    }
}
impl<'a> Phase<'a> {
    fn capture(operation: &'a DecisionIdentityOperation, root: &'a Root) -> Result<Self, TxError> {
        let facts = super::super::capture_phase(
            root,
            super::super::PhasePaths {
                index: &operation.index_path,
                collection: &operation.collection,
                selector: &operation.selector,
            },
            &Definition,
            Domain::Decision,
            |baseline, missing| operation.discover(root, baseline, missing),
        )?;
        Ok(Self {
            operation,
            root,
            facts,
        })
    }

    fn plan(mut self) -> Result<Plan<PreparedIdentity>, TxError> {
        let selected = self.facts.selection()?;
        if selected.noop(
            &self.operation.action,
            &self.facts.discovery.locators,
            &self.facts.discovery.occupied,
        )? {
            return Ok(self.noop());
        }
        let front = selected.validate(selected.text.as_bytes())?;
        let change = change::Change {
            operation: self.operation,
            root: self.root,
            baseline: &self.facts.baseline,
            locators: &self.facts.discovery.locators,
            occupied: &self.facts.discovery.occupied,
            id: &self.facts.selected.id,
            old_path: &self.facts.selected.old_path,
            candidate: self.facts.selected.candidate,
            old: &self.facts.selected.old,
            before: self.facts.selected.before.take(),
            front: &front,
        }
        .plan()?;
        self.finish(change)
    }
    fn noop(self) -> Plan<PreparedIdentity> {
        let value = PreparedIdentity {
            old_id: self.facts.selected.id.clone(),
            new_id: Some(self.facts.selected.id),
            old_path: self.facts.selected.old_path.clone(),
            new_path: Some(self.facts.selected.old_path),
            candidate: self.facts.selected.candidate,
            affected_ids: vec![],
            affected_relation_count: 0,
            impact: Default::default(),
            no_change: true,
        };
        super::super::no_change_plan(value)
    }
    fn finish(self, change: change::ChangeResult) -> Result<Plan<PreparedIdentity>, TxError> {
        let change::ChangeResult {
            mut writes,
            next,
            affected,
            affected_relation_count,
            impact,
            new_id,
            new_path,
            no_change,
            history_fact: _,
            pending: _,
            commit,
        } = change;
        if !self.facts.selected.candidate && !no_change {
            writes.push(super::super::published_index_write(
                self.operation.index_path.clone(),
                self.facts.index_before,
                next,
                &Definition,
            )?);
        }
        Ok(Plan {
            value: PreparedIdentity {
                old_id: self.facts.selected.id,
                new_id,
                old_path: self.facts.selected.old_path,
                new_path,
                candidate: self.facts.selected.candidate,
                affected_ids: affected,
                affected_relation_count,
                impact,
                no_change,
            },
            writes,
            resources: vec![],
            commit_point: commit,
        })
    }
}
