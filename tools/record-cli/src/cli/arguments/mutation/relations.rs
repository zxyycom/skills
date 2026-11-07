use super::*;

pub(super) fn decision_kind(s: &str) -> Result<DecisionRelationKind, ArgumentError> {
    match s {
        "修订" => Ok(DecisionRelationKind::Revision),
        "替代" => Ok(DecisionRelationKind::Replacement),
        "判定无效" => Ok(DecisionRelationKind::Invalidation),
        "归并" => Ok(DecisionRelationKind::Merge),
        "拆分" => Ok(DecisionRelationKind::Split),
        "重划" => Ok(DecisionRelationKind::Reallocation),
        _ => Err(ArgumentError("invalid decision relation type".into())),
    }
}
pub(super) fn investigation_kind(s: &str) -> Result<InvestigationRelationKind, ArgumentError> {
    match s {
        "补充" => Ok(InvestigationRelationKind::Supplement),
        "复查" => Ok(InvestigationRelationKind::Reexamination),
        "修正" => Ok(InvestigationRelationKind::Correction),
        "推翻" => Ok(InvestigationRelationKind::Reversal),
        "归并" => Ok(InvestigationRelationKind::Merge),
        "拆分" => Ok(InvestigationRelationKind::Split),
        _ => Err(ArgumentError("invalid investigation relation type".into())),
    }
}
pub(super) fn pair(value: &str) -> Result<(&str, &str), ArgumentError> {
    let (a, b) = value
        .split_once('=')
        .ok_or_else(|| ArgumentError("expected TYPE=VALUE".into()))?;
    if a.is_empty() || b.is_empty() {
        return Err(ArgumentError("empty relation component".into()));
    }
    Ok((a, b))
}
struct RelationEvents<T> {
    edges: Vec<Relation<T>>,
    summaries: HashMap<String, String>,
    seen: HashSet<String>,
    clear: bool,
}

impl<T: Copy> RelationEvents<T> {
    fn add_relation(
        &mut self,
        value: &str,
        kind: fn(&str) -> Result<T, ArgumentError>,
    ) -> Result<(), ArgumentError> {
        let (ty, target) = pair(value)?;
        if !self.seen.insert(target.to_owned()) {
            return Err(ArgumentError("duplicate relation target".into()));
        }
        self.edges.push(Relation {
            kind: kind(ty)?,
            target: target.to_owned(),
            summary: None,
        });
        Ok(())
    }

    fn add_summary(&mut self, value: &str) -> Result<(), ArgumentError> {
        let (target, text) = pair(value)?;
        if self
            .summaries
            .insert(target.to_owned(), text.to_owned())
            .is_some()
        {
            return Err(ArgumentError("duplicate relation summary".into()));
        }
        Ok(())
    }

    fn finish(mut self) -> Result<Vec<Relation<T>>, ArgumentError> {
        if self.clear && (!self.edges.is_empty() || !self.summaries.is_empty()) {
            return Err(ArgumentError("clear-relations cannot be combined".into()));
        }
        for edge in &mut self.edges {
            edge.summary = self.summaries.remove(&edge.target);
        }
        if !self.summaries.is_empty() {
            return Err(ArgumentError(
                "relation summary has no matching target".into(),
            ));
        }
        Ok(self.edges)
    }
}

pub(super) fn relations<T: Copy>(
    events: &[(String, String)],
    kind: fn(&str) -> Result<T, ArgumentError>,
) -> Result<Vec<Relation<T>>, ArgumentError> {
    let mut parsed = RelationEvents {
        edges: Vec::new(),
        summaries: HashMap::new(),
        seen: HashSet::new(),
        clear: false,
    };
    for (key, value) in events {
        match key.as_str() {
            "relation" => parsed.add_relation(value, kind)?,
            "relation-summary" => parsed.add_summary(value)?,
            "clear-relations" => {
                if parsed.clear {
                    return Err(ArgumentError("duplicate clear-relations".into()));
                }
                parsed.clear = true;
            }
            _ => {}
        }
    }
    parsed.finish()
}
fn finish_group<T: Copy>(
    source: &mut Option<String>,
    events: &mut Vec<(String, String)>,
    result: &mut Vec<RelationGroup<T>>,
    kind: fn(&str) -> Result<T, ArgumentError>,
) -> Result<(), ArgumentError> {
    if let Some(source) = source.take() {
        if !events
            .iter()
            .any(|(k, _)| k == "relation" || k == "clear-relations")
        {
            return Err(ArgumentError("empty source group".into()));
        }
        let values = relations(events, kind)?;
        result.push(RelationGroup {
            source,
            relations: values,
        });
        events.clear();
    }
    Ok(())
}

pub(super) fn groups<T: Copy>(
    args: &Args,
    kind: fn(&str) -> Result<T, ArgumentError>,
) -> Result<Vec<RelationGroup<T>>, ArgumentError> {
    let mut result = Vec::new();
    let mut source: Option<String> = None;
    let mut events = Vec::new();
    let mut seen = HashSet::new();
    for (key, value) in &args.options {
        match key.as_str() {
            "source" => {
                finish_group(&mut source, &mut events, &mut result, kind)?;
                if !seen.insert(value.clone()) {
                    return Err(ArgumentError("duplicate source".into()));
                }
                source = Some(value.clone());
            }
            "relation" | "relation-summary" | "clear-relations" => {
                if source.is_none() {
                    return Err(ArgumentError("relation option must follow --source".into()));
                }
                events.push((key.clone(), value.clone()));
            }
            _ => {}
        }
    }
    finish_group(&mut source, &mut events, &mut result, kind)?;
    if result.is_empty() {
        return Err(ArgumentError("at least one source is required".into()));
    }
    Ok(result)
}
