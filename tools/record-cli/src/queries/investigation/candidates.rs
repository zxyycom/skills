use super::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateReadiness {
    pub scaffold_valid: bool,
    pub body_ready: bool,
    pub resource_ready: bool,
}
#[derive(Serialize)]
pub struct Candidate {
    #[serde(skip)]
    pub(crate) blocked_resource_ids: Vec<String>,
    #[serde(skip)]
    pub(crate) resource_ids: Vec<String>,
    pub diagnostics: Vec<String>,
    pub id: String,
    pub path: String,
    pub markdown: String,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub readiness: CandidateReadiness,
}
#[derive(Serialize)]
pub struct CandidatesResult {
    pub status: &'static str,
    pub candidates: Vec<Candidate>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}
#[derive(Serialize)]
pub struct CandidateResult {
    pub status: &'static str,
    pub candidate: Candidate,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}
/// Discover and read candidates with one phase-local resource observation.
pub fn candidates(
    root: &crate::source::Root,
    directory: &str,
    selector: Option<&str>,
) -> Result<(Vec<Candidate>, Vec<String>), crate::protocol::CommandError> {
    use crate::domains;
    let collection = super::super::candidate_discovery::investigations(root, directory)?;
    let selected: Vec<_> = if let Some(selector) = selector {
        let (_, value) = domains::resolve_selector(&collection.items, selector, |c| &c.name)
            .map_err(|e| super::super::selector_error(selector, e))?;
        vec![value]
    } else {
        collection.items.values().collect()
    };
    let mut resources =
        crate::resources::ResourceContext::open(root, directory, collection.resources_exist)?;
    let mut output = Vec::new();
    let mut owners = OwnerReferences::new(&collection.formal_resources, &collection.items);
    let mut warnings = collection.warnings;
    for source in selected {
        let Some(doc) = parse_scaffold(source, selector.is_some(), &mut warnings)? else {
            continue;
        };
        let observation = inspect_candidate(source, doc, &mut owners, &mut resources)?;
        warnings.extend(observation.errors.iter().cloned());
        output.push(project_candidate(root, directory, source, observation));
    }
    Ok((output, warnings))
}

struct CandidateObservation {
    blocked_resource_ids: Vec<String>,
    resource_ids: Vec<String>,
    markdown: String,
    body_ready: bool,
    resource_ready: bool,
    errors: Vec<String>,
}
fn inspect_candidate(
    source: &super::super::candidate_discovery::Candidate,
    assessed: crate::domains::investigation::AssessedCandidate,
    owners: &mut OwnerReferences<'_>,
    resources: &mut crate::resources::ResourceContext<'_>,
) -> Result<CandidateObservation, crate::protocol::CommandError> {
    let body = assessed.body;
    let document = assessed.document;
    owners.record(&source.id, &body.resource_ids);
    let mut resource_errors = Vec::new();
    let mut blocked_resource_ids = Vec::new();
    for id in &body.resource_ids {
        let issues = resources.direct_issues(std::slice::from_ref(id))?;
        if !issues.is_empty() {
            blocked_resource_ids.push(id.clone());
        }
        resource_errors.extend(issues);
    }
    resource_errors.extend(owners.check(&body.resource_ids)?);
    let visible = resources.visible_owned(&source.id, &body.resource_ids)?;
    let resource_ready =
        body.resource_errors.is_empty() && resource_errors.is_empty() && visible.is_empty();
    let mut errors = document.diagnostics;
    errors.extend(resource_errors);
    errors.extend(unreferenced_resource_issues(
        &source.id,
        &body.resource_ids,
        &visible,
    ));
    errors.sort_by(|a, b| compare_text(a, b));
    errors.dedup();
    Ok(CandidateObservation {
        blocked_resource_ids,
        resource_ids: body.resource_ids,
        markdown: document.markdown,
        body_ready: document.readiness.body_ready,
        resource_ready,
        errors,
    })
}
fn project_candidate(
    root: &crate::source::Root,
    directory: &str,
    source: &super::super::candidate_discovery::Candidate,
    observation: CandidateObservation,
) -> Candidate {
    Candidate {
        blocked_resource_ids: observation.blocked_resource_ids,
        resource_ids: observation.resource_ids,
        diagnostics: vec![],
        id: source.id.clone(),
        path: root
            .path()
            .join(directory)
            .join(&source.path)
            .display()
            .to_string(),
        markdown: observation.markdown,
        readiness: CandidateReadiness {
            scaffold_valid: true,
            body_ready: observation.body_ready,
            resource_ready: observation.resource_ready,
        },
        errors: observation.errors,
        warnings: vec![],
    }
}

// Visible owner resources cannot be silently omitted from direct references.
fn unreferenced_resource_issues(
    owner_id: &str,
    referenced: &[String],
    visible: &[(String, Option<String>)],
) -> Vec<String> {
    use crate::domains;
    let mut errors = Vec::new();
    for (resource, issue) in visible {
        if !referenced.contains(resource) {
            errors.push(format!("candidate owner resources must be directly referenced before publish: _resources/{resource} must be referenced by its owner report {}",owner_id));
            if !domains::investigation::valid_resource_id(resource) {
                errors.push(format!("candidate owner resources must be directly referenced before publish: _resources/{resource} must use a safe, normalized resource id with an owner report prefix"));
            }
            if let Some(issue) = issue {
                errors.push(format!(
                    "candidate owner resources must be directly referenced before publish: {issue}"
                ));
            }
        }
    }
    errors
}

// Known formal and candidate owner declarations share one observation cache.
struct OwnerReferences<'a> {
    known: std::collections::HashMap<String, std::collections::HashSet<String>>,
    candidates:
        &'a std::collections::BTreeMap<String, super::super::candidate_discovery::Candidate>,
}
impl<'a> OwnerReferences<'a> {
    fn new(
        formal: &std::collections::HashMap<String, Vec<String>>,
        candidates: &'a std::collections::BTreeMap<
            String,
            super::super::candidate_discovery::Candidate,
        >,
    ) -> Self {
        Self {
            known: formal
                .iter()
                .map(|(id, refs)| (id.clone(), refs.iter().cloned().collect()))
                .collect(),
            candidates,
        }
    }
    fn record(&mut self, id: &str, resources: &[String]) {
        self.known
            .entry(id.to_owned())
            .or_insert_with(|| resources.iter().cloned().collect());
    }
    fn check(
        &mut self,
        resources: &[String],
    ) -> Result<Vec<String>, crate::protocol::CommandError> {
        use crate::{domains, protocol::CommandError};
        let mut resource_errors = Vec::new();
        for resource in resources {
            let Some((owner, _)) = resource.split_once('/') else {
                continue;
            };
            if !self.known.contains_key(owner)
                && let Some(candidate) = self.candidates.get(owner)
            {
                let parsed = domains::investigation::parse_candidate(
                    candidate.text.as_bytes(),
                    &candidate.id,
                    &candidate.path,
                )
                .map_err(|e| CommandError::new("candidate-owner-invalid", e))?;
                if !parsed.readiness.scaffold_valid {
                    return Err(CommandError::new(
                        "candidate-owner-invalid",
                        format!("required candidate resource owner is invalid: {owner}"),
                    ));
                }
                self.known
                    .insert(owner.to_owned(), parsed.resource_ids.into_iter().collect());
            }
            match self.known.get(owner) {
                None => resource_errors.push(format!(
                    "_resources/{resource} owner report {owner} does not exist"
                )),
                Some(refs) if !refs.contains(resource) => resource_errors.push(format!(
                    "_resources/{resource} must be referenced by its owner report {owner}"
                )),
                _ => {}
            }
        }
        Ok(resource_errors)
    }
}

fn parse_scaffold(
    source: &super::super::candidate_discovery::Candidate,
    explicit: bool,
    warnings: &mut Vec<String>,
) -> Result<Option<crate::domains::investigation::AssessedCandidate>, crate::protocol::CommandError>
{
    use crate::{domains, protocol::CommandError};
    let parsed = domains::investigation::parse_candidate_assessed(
        source.text.as_bytes(),
        &source.id,
        &source.path,
    );
    let doc = match parsed {
        Ok(assessment) if assessment.document.readiness.scaffold_valid => assessment,
        Ok(assessment) => {
            let doc = assessment.document;
            if explicit {
                return Err(CommandError::new(
                    "candidate-invalid",
                    format!("{} is not a valid candidate scaffold", source.path),
                ));
            }
            warnings.extend(
                doc.diagnostics
                    .iter()
                    .map(|e| format!("{}: {e}", source.path)),
            );
            return Ok(None);
        }
        Err(e) => {
            if explicit {
                return Err(CommandError::new("candidate-invalid", e));
            }
            warnings.push(format!("{}: {e}", source.path));
            return Ok(None);
        }
    };
    Ok(Some(doc))
}
