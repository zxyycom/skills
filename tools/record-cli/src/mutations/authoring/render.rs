use super::*;

pub(super) struct RenderInput<'a> {
    pub operation: &'a NewOperation,
    pub root: &'a Root,
    pub ids: &'a HashSet<String>,
    pub listing: &'a Option<source::DirectorySnapshot>,
    pub source_path: &'a str,
}
pub(super) struct Rendered {
    pub markdown: String,
    pub ready: domains::Readiness,
}
enum CandidateFront {
    Decision(domains::decision::Frontmatter),
    Investigation(domains::investigation::Frontmatter),
}

impl RenderInput<'_> {
    pub fn render(self, warnings: &mut Vec<String>) -> Result<Rendered, TxError> {
        let front = prepare_frontmatter(self.operation, self.ids)?;
        match front {
            CandidateFront::Decision(front) => {
                let markdown =
                    domains::decision::serialize_document(&front).map_err(|e| err("input", e))?;
                let parsed =
                    domains::decision::parse_candidate(markdown.as_bytes(), &self.operation.id)
                        .map_err(|e| err("input", e))?;
                Ok(Rendered {
                    markdown,
                    ready: parsed.readiness,
                })
            }
            CandidateFront::Investigation(front) => {
                let (markdown, mut ready) =
                    investigation_document(front, &self.operation.id, self.source_path)?;
                let resource_ready =
                    owner_readiness(self.root, self.operation, self.listing.as_ref(), warnings)?;
                ready.resource_ready = Some(resource_ready);
                Ok(Rendered { markdown, ready })
            }
        }
    }
}

fn prepare_frontmatter(
    operation: &NewOperation,
    ids: &HashSet<String>,
) -> Result<CandidateFront, TxError> {
    let relations = prepare_relations(operation, ids)?;
    match &operation.input {
        NewInput::Decision {
            title,
            purpose,
            background,
            decision,
            tags,
            ..
        } => Ok(CandidateFront::Decision(domains::decision::Frontmatter {
            id: operation.id.clone(),
            title: title.clone(),
            status: "candidate".into(),
            alignment: None,
            created_at: None,
            purpose: purpose.clone(),
            background: background.clone(),
            decision: decision.clone(),
            tags: sorted_tags(tags),
            relations,
            body: "## 目的\n\n## 背景\n\n## 决策\n".into(),
        })),
        NewInput::Investigation {
            title,
            question,
            tags,
            formed_at,
            ..
        } => Ok(CandidateFront::Investigation(
            domains::investigation::Frontmatter {
                id: operation.id.clone(),
                title: title.clone(),
                formed_at: formed_at
                    .clone()
                    .unwrap_or_else(|| operation.timestamp.clone()),
                question: question.clone(),
                tags: sorted_tags(tags),
                relations,
                end_line: 0,
                relations_start_line: 0,
                relations_end_line: 0,
            },
        )),
    }
}

fn prepare_relations(
    operation: &NewOperation,
    ids: &HashSet<String>,
) -> Result<Vec<DomainRelation>, TxError> {
    match &operation.input {
        NewInput::Decision { relations, .. } => convert_relations(ids, &operation.id, relations),
        NewInput::Investigation {
            tags, relations, ..
        } => {
            if tags.is_empty() {
                return Err(err("input", "at least one tag is required"));
            }
            convert_relations(ids, &operation.id, relations)
        }
    }
}

fn investigation_document(
    front: domains::investigation::Frontmatter,
    id: &str,
    source_path: &str,
) -> Result<(String, domains::Readiness), TxError> {
    let text = format!(
        "{}\n\n## 形成时背景\n\n## 调查目的\n\n## 调查范围与依据\n\n## 调查结果与边界\n",
        domains::investigation::serialize_frontmatter(&front).map_err(|e| err("input", e))?
    );
    let parsed = domains::investigation::parse_candidate(text.as_bytes(), id, source_path)
        .map_err(|e| err("input", e))?;
    if !parsed.readiness.scaffold_valid {
        return Err(err("input", parsed.diagnostics.join("; ")));
    }

    Ok((text, parsed.readiness))
}

fn owner_readiness(
    root: &Root,
    operation: &NewOperation,
    listing: Option<&source::DirectorySnapshot>,
    warnings: &mut Vec<String>,
) -> Result<bool, TxError> {
    let Some(listing) = listing else {
        return Ok(true);
    };
    let directory = operation
        .collection
        .as_path()
        .to_str()
        .ok_or_else(|| err("path", "collection path is not UTF-8"))?;
    let exists = listing.members.iter().any(|m| m.name == "_resources");
    let mut ctx = crate::resources::ResourceContext::open(root, directory, exists)
        .map_err(|e| err("resources", e))?;
    let visible = ctx
        .visible_owned(&operation.id, &[])
        .map_err(|e| err("resources", e))?;
    let ready = visible.is_empty();
    for (id, _) in visible {
        warnings.push(format!("owner resource must be referenced: {id}"));
    }
    Ok(ready)
}

fn resolve_target(ids: &HashSet<String>, selector: &str) -> Result<String, TxError> {
    let selector = if selector
        .get(selector.len().saturating_sub(3)..)
        .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".md"))
    {
        &selector[..selector.len() - 3]
    } else {
        selector
    };
    if domains::name_from_id(selector) != selector {
        return Ok(selector.to_owned());
    }
    let matches: Vec<_> = ids
        .iter()
        .filter(|id| domains::name_from_id(id) == selector)
        .collect();
    match matches.as_slice() {
        [id] => Ok((*id).clone()),
        [] => Err(err(
            "relation-target",
            format!("target not found: {selector}"),
        )),
        _ => Err(err(
            "relation-target",
            format!("ambiguous target: {selector}"),
        )),
    }
}

fn convert_relations<K: Copy + serde::Serialize>(
    ids: &HashSet<String>,
    source: &str,
    relations: &[Relation<K>],
) -> Result<Vec<DomainRelation>, TxError> {
    relations
        .iter()
        .map(|relation| {
            convert_relation(
                ids,
                source,
                serde_json::to_value(relation.kind)
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .to_owned(),
                &relation.target,
                relation.summary.as_deref(),
            )
        })
        .collect()
}

fn convert_relation(
    ids: &HashSet<String>,
    source: &str,
    kind: String,
    target: &str,
    summary: Option<&str>,
) -> Result<DomainRelation, TxError> {
    let target = resolve_target(ids, target)?;
    if target == source {
        return Err(err("relation-target", "self relation is forbidden"));
    }
    Ok(DomainRelation {
        relation_type: kind,
        target,
        summary: summary.map(str::to_owned),
    })
}
