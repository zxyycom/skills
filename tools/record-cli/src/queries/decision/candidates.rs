use super::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateRecord {
    pub decision_id: String,
    pub source_path: String,
    pub projection: Projection,
    pub tags: Vec<String>,
    pub status: &'static str,
    pub alignment: Option<()>,
    pub created_at: Option<()>,
    pub scaffold_valid: bool,
    pub body_ready: bool,
}
#[derive(Serialize)]
pub struct CandidatesResult {
    pub status: &'static str,
    pub command: &'static str,
    pub records: Vec<CandidateRecord>,
    pub warnings: Vec<String>,
}
#[derive(Serialize)]
pub struct CandidateResult {
    pub status: &'static str,
    pub command: &'static str,
    pub body: String,
    pub record: CandidateRecord,
    pub warnings: Vec<String>,
}
pub type CandidateSelection = (Vec<(CandidateRecord, String)>, Vec<String>);
pub fn candidates(
    root: &crate::source::Root,
    directory: &str,
    selector: Option<&str>,
) -> Result<CandidateSelection, crate::protocol::CommandError> {
    use crate::domains;
    let collection = super::super::candidate_discovery::decisions(root, directory)?;
    let selected: Vec<_> = if let Some(selector) = selector {
        let (_, value) = domains::resolve_selector(&collection.items, selector, |c| &c.name)
            .map_err(|e| super::super::selector_error(selector, e))?;
        vec![value]
    } else {
        collection.items.values().collect()
    };
    let mut output = Vec::new();
    let mut warnings = collection.warnings;
    for source in selected {
        let Some(scaffold) = parse_scaffold(source, selector.is_some(), &mut warnings)? else {
            continue;
        };
        let front = scaffold.front;
        validate_dependencies(
            &front.relations,
            &collection.items,
            &collection.formal_ids,
            &mut warnings,
        )?;
        output.push(project_candidate(source, front, scaffold.body_ready));
    }
    Ok((output, warnings))
}

fn project_candidate(
    source: &super::super::candidate_discovery::Candidate,
    front: crate::domains::decision::Frontmatter,
    body_ready: bool,
) -> (CandidateRecord, String) {
    (
        CandidateRecord {
            decision_id: source.id.clone(),
            source_path: source.path.clone(),
            projection: Projection {
                title: front.title,
                purpose: front.purpose,
                background: front.background,
                decision: front.decision,
                relations: front.relations,
            },
            tags: front.tags,
            status: "candidate",
            alignment: None,
            created_at: None,
            scaffold_valid: true,
            body_ready,
        },
        source.text.clone(),
    )
}

struct Scaffold {
    front: crate::domains::decision::Frontmatter,
    body_ready: bool,
}
fn parse_scaffold(
    source: &super::super::candidate_discovery::Candidate,
    explicit: bool,
    warnings: &mut Vec<String>,
) -> Result<Option<Scaffold>, crate::protocol::CommandError> {
    use crate::{domains, protocol::CommandError};
    let front = match domains::decision::parse_frontmatter(source.text.as_bytes(), &source.id) {
        Ok(front) => front,
        Err(e) => {
            if explicit {
                return Err(CommandError::new("candidate-invalid", e));
            }
            warnings.push(format!("{}: {e}", source.path));
            return Ok(None);
        }
    };
    if front.status != "candidate" {
        return Err(CommandError::new(
            "candidate-invalid",
            "candidate lifecycle changed during reading",
        ));
    }
    let body = domains::decision::assess_body(&front.body, true);
    if !body.scaffold_errors.is_empty() {
        if explicit {
            return Err(CommandError::new(
                "candidate-invalid",
                body.scaffold_errors.join("; "),
            ));
        }
        warnings.extend(
            body.scaffold_errors
                .iter()
                .map(|e| format!("{}: {e}", source.path)),
        );
        return Ok(None);
    }
    Ok(Some(Scaffold {
        front,
        body_ready: body.body_ready,
    }))
}

// Dependencies are checked only against discovered candidates or indexed IDs.
fn validate_dependencies(
    relations: &[Relation],
    items: &std::collections::BTreeMap<String, super::super::candidate_discovery::Candidate>,
    formal_ids: &std::collections::HashSet<String>,
    warnings: &mut Vec<String>,
) -> Result<(), crate::protocol::CommandError> {
    use crate::{domains, protocol::CommandError};
    for relation in relations {
        if let Some(dependency) = items.get(&relation.target) {
            let parsed =
                domains::decision::parse_frontmatter(dependency.text.as_bytes(), &dependency.id)
                    .map_err(|e| CommandError::new("candidate-dependency-invalid", e))?;
            let assessment = domains::decision::assess_body(&parsed.body, true);
            if parsed.status != "candidate" || !assessment.scaffold_errors.is_empty() {
                return Err(CommandError::new(
                    "candidate-dependency-invalid",
                    format!(
                        "Direct candidate dependency is invalid: {}",
                        assessment.scaffold_errors.join("; ")
                    ),
                ));
            }
        } else if !formal_ids.contains(&relation.target) {
            warnings.push(format!(
                "Candidate relation target is not yet established: {}",
                relation.target
            ));
        }
    }
    Ok(())
}
