use super::*;

#[derive(Clone, Copy)]
pub(super) struct Preparation<'a> {
    pub operation: &'a DecisionEvolutionOperation,
    pub root: &'a Root,
    pub baseline: &'a index::ValidatedIndex<decision::DecisionState>,
    pub ids: &'a BTreeMap<String, Located>,
    pub candidates: &'a BTreeSet<String>,
    pub selection: &'a selection::Selection,
}
pub(super) struct Prepared {
    pub sources: BTreeMap<String, ExpectedFile>,
    pub successors: Vec<evolution::Successor>,
    pub historical: BTreeMap<String, String>,
    pub target_ids: BTreeSet<String>,
    pub predecessors: BTreeMap<String, evolution::Predecessor>,
    pub preliminary: evolution::EvolutionPlan,
}
impl Preparation<'_> {
    pub fn prepare(self) -> Result<Prepared, TxError> {
        let Self {
            baseline,
            selection,
            ..
        } = self;
        let mut sources = BTreeMap::new();
        let mut successors = Vec::new();
        for (id, alignment) in &selection.selected {
            let (before, successor) = self.selected_source(id, *alignment)?;
            sources.insert(id.clone(), before);
            successors.push(successor);
        }
        let target_ids: BTreeSet<_> = successors
            .iter()
            .flat_map(|s| s.after.iter().map(|r| r.target.clone()))
            .collect();
        let PredecessorFacts {
            historical,
            predecessors,
        } = predecessor_facts(baseline, &target_ids)?;
        let preliminary = evolution::plan_evolution(
            &successors,
            &predecessors,
            selection.discarded.as_deref(),
            true,
            |_| Ok::<_, ()>(()),
        )
        .map_err(|e| fail("evolution", format!("{e:?}")))?;
        Ok(Prepared {
            sources,
            successors,
            historical,
            target_ids,
            predecessors,
            preliminary,
        })
    }
    fn selected_source(
        &self,
        id: &str,
        alignment: Alignment,
    ) -> Result<(ExpectedFile, evolution::Successor), TxError> {
        let is_candidate = self.candidates.contains(id);
        let before = self.capture_selected(id, is_candidate)?;
        let front = self.parse_selected(id, is_candidate, &before)?;
        let original = front
            .relations
            .iter()
            .map(relation)
            .collect::<Result<Vec<_>, _>>()?;
        let after = self.resolve_relations(id, &original)?;
        let existing_alignment = if is_candidate {
            None
        } else {
            Some(if front.alignment.as_deref() == Some("aligned") {
                Alignment::Aligned
            } else {
                Alignment::Unaligned
            })
        };
        let successor = evolution::Successor {
            id: id.to_owned(),
            candidate: is_candidate,
            body_ready: true,
            existing_alignment,
            requested_alignment: alignment,
            before: original,
            after,
        };
        Ok((before, successor))
    }
    fn capture_selected(&self, id: &str, is_candidate: bool) -> Result<ExpectedFile, TxError> {
        let Self {
            operation,
            root,
            baseline,
            ids,
            ..
        } = *self;
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
        Ok(before)
    }
    fn parse_selected(
        &self,
        id: &str,
        is_candidate: bool,
        before: &ExpectedFile,
    ) -> Result<decision::Frontmatter, TxError> {
        let ExpectedFile::Present(file) = before else {
            return Err(fail("source-missing", id));
        };
        let front =
            decision::parse_frontmatter(&file.bytes, id).map_err(|e| fail("source-invalid", e))?;
        if is_candidate {
            let parsed = decision::parse_candidate(&file.bytes, id)
                .map_err(|e| fail("candidate-invalid", e))?;
            if !parsed.readiness.scaffold_valid || !parsed.readiness.body_ready {
                let mut reasons = decision::assess_body(&front.body, false).scaffold_errors;
                if !parsed.readiness.body_ready {
                    reasons.push("candidate body is not ready for publication".into());
                }
                return Err(self.unready_candidate(id, &reasons));
            }
        }
        Ok(front)
    }
    fn unready_candidate(&self, id: &str, reasons: &[String]) -> TxError {
        let reason = reasons.join("; ");
        let path = self.operation.collection.as_path().join(&self.ids[id].path);
        fail("candidate-unready", id).with_diagnostics(vec![crate::protocol::Diagnostic {
            code: "decision-records.candidate-unready".into(), message: reason.clone(),
            path: Some(path.to_string_lossy().into_owned()), target: Some(format!("Decision candidate {id}")),
            cause_category: Some("validation".into()), operation: Some(if self.operation.publish_only { "publish" } else { "evolve" }.into()),
            detail: None, reason: Some(reason), recovery: Some("Complete the candidate body and correct the reported scaffold errors before retrying.".into()),
        }])
    }
    fn resolve_relations(
        &self,
        id: &str,
        original: &[Relation<DecisionRelationKind>],
    ) -> Result<Vec<Relation<DecisionRelationKind>>, TxError> {
        let override_edges = self
            .selection
            .group_map
            .get(id)
            .map(Vec::as_slice)
            .unwrap_or(original);
        let mut after = Vec::new();
        let mut targets = HashSet::new();
        for edge in override_edges {
            let target = resolve(self.ids, &edge.target)?.to_owned();
            if !targets.insert(target.clone()) {
                return Err(fail("duplicate-target", target));
            }
            let summary = edge.summary.as_ref().and_then(|v| {
                let s = v.js_trim();
                if s.is_empty() {
                    None
                } else {
                    Some(s.to_owned())
                }
            });
            if summary
                .as_ref()
                .is_some_and(|s| s.contains(['\r', '\n']) || s.chars().count() > 40)
            {
                return Err(fail("relation-summary", "invalid summary"));
            }
            after.push(Relation {
                kind: edge.kind,
                target,
                summary,
            });
        }
        Ok(after)
    }
}

struct PredecessorFacts {
    historical: BTreeMap<String, String>,
    predecessors: BTreeMap<String, evolution::Predecessor>,
}
fn predecessor_facts(
    baseline: &index::ValidatedIndex<decision::DecisionState>,
    target_ids: &BTreeSet<String>,
) -> Result<PredecessorFacts, TxError> {
    let mut historical = BTreeMap::new();
    for id in target_ids {
        let state = baseline
            .index()
            .entries
            .get(id)
            .ok_or_else(|| fail("predecessor", id))?;
        historical.insert(id.clone(), state.source_path.clone());
    }
    let predecessors: BTreeMap<_, _> = historical
        .keys()
        .map(|id| {
            let state = &baseline.index().entries[id];
            (
                id.clone(),
                evolution::Predecessor {
                    status: if state.status == "active" {
                        Status::Active
                    } else {
                        Status::Archived
                    },
                    history: crate::mutations::lifecycle::HistoryFact::NotApplicable,
                },
            )
        })
        .collect();
    Ok(PredecessorFacts {
        historical,
        predecessors,
    })
}
