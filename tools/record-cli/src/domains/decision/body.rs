use super::*;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BodyAssessment {
    pub scaffold_errors: Vec<String>,
    pub body_ready: bool,
}

pub fn assess_body(body: &str, candidate: bool) -> BodyAssessment {
    let sections = parse_sections(body);
    let (mut errors, mut ready) = assess_sections(&sections, candidate);
    if !body.starts_with("## 目的\n") {
        errors.insert(0, "body must start with ## 目的".into());
    }
    if !has_adopted_decision(&sections) {
        ready = false;
        if !candidate {
            errors.push("decision must include non-empty 采用".into());
        }
    }
    BodyAssessment {
        scaffold_errors: errors,
        body_ready: ready,
    }
}

fn parse_sections(body: &str) -> Vec<(&str, String)> {
    let mut sections: Vec<(&str, String)> = Vec::new();
    for line in body.split_inclusive('\n') {
        let line = line.strip_suffix('\n').unwrap_or(line);
        if let Some(title) = line.strip_prefix("## ").filter(|v| !v.is_empty()) {
            sections.push((title.js_trim(), String::new()));
        } else if let Some((_, content)) = sections.last_mut() {
            content.push_str(line);
            content.push('\n');
        }
    }
    sections
}

fn assess_sections(sections: &[(&str, String)], candidate: bool) -> (Vec<String>, bool) {
    let mut errors = Vec::new();
    let expected = ["目的", "背景", "决策"];
    for section in sections {
        if !expected.contains(&section.0) {
            errors.push(format!("unsupported section: {}", section.0));
        }
    }
    let mut ready = true;
    let mut previous = None;
    for title in expected {
        let found: Vec<_> = sections
            .iter()
            .enumerate()
            .filter(|(_, (name, _))| *name == title)
            .collect();
        if found.len() != 1 {
            errors.push(format!("section must occur once: {title}"));
            ready = false;
            continue;
        }
        let (i, (_, content)) = found[0];
        if previous.is_some_and(|old| i < old) {
            errors.push("sections out of order".into());
        }
        previous = Some(i);
        if content.js_trim().is_empty() {
            ready = false;
            if !candidate {
                errors.push(format!("empty section: {title}"));
            }
        }
    }
    (errors, ready)
}

fn has_adopted_decision(sections: &[(&str, String)]) -> bool {
    sections
        .iter()
        .filter(|(title, _)| *title == "决策")
        .any(|(_, content)| {
            content.lines().any(|line| {
                let Some(rest) = line
                    .strip_prefix("- ")
                    .or_else(|| line.strip_prefix("* "))
                    .or_else(|| line.strip_prefix("+ "))
                else {
                    return false;
                };
                let Some(rest) = rest
                    .strip_prefix("采用:")
                    .or_else(|| rest.strip_prefix("采用："))
                else {
                    return false;
                };
                !rest.js_trim().is_empty()
            })
        })
}

pub fn parse_candidate(
    bytes: &[u8],
    id: &str,
) -> Result<super::super::CandidateDocument<DecisionState>, String> {
    let markdown = std::str::from_utf8(bytes)
        .map_err(|_| "invalid UTF-8")?
        .to_owned();
    let front = parse_frontmatter(bytes, id)?;
    if front.status != "candidate" {
        return Err("expected candidate lifecycle".into());
    }
    let body = assess_body(&front.body, true);
    Ok(super::super::CandidateDocument {
        markdown,
        state: None,
        resource_ids: vec![],
        readiness: super::super::Readiness {
            scaffold_valid: body.scaffold_errors.is_empty(),
            body_ready: body.body_ready,
            resource_ready: None,
        },
        diagnostics: body.scaffold_errors,
    })
}

/// Validate document-local established fields and body. Relation targets and
/// source fingerprint are checked against a separately captured snapshot.
pub fn parse_established(
    bytes: &[u8],
    id: &str,
    source_path: &str,
) -> Result<super::super::EstablishedDocument<DecisionState>, String> {
    let markdown = std::str::from_utf8(bytes)
        .map_err(|_| "invalid UTF-8")?
        .to_owned();
    let front = parse_frontmatter(bytes, id)?;
    if front.status == "candidate" {
        return Err("expected established decision".into());
    }
    let archived = source_path.starts_with("archive/");
    if (front.status == "archived") != archived
        || !super::super::path_name(source_path.strip_prefix("archive/").unwrap_or(source_path))
    {
        return Err("source path does not match lifecycle".into());
    }
    let assessment = assess_body(&front.body, false);
    if !assessment.scaffold_errors.is_empty() || !assessment.body_ready {
        return Err(assessment.scaffold_errors.join("; "));
    }
    let state = DecisionState {
        name: super::super::name_from_id(id).to_owned(),
        source_path: source_path.into(),
        title: front.title,
        status: front.status,
        alignment: front.alignment.ok_or("missing alignment")?,
        created_at: front.created_at.ok_or("missing timestamp")?,
        purpose: front.purpose,
        background: front.background,
        decision: front.decision,
        tags: front.tags,
        relations: front.relations,
    };
    Ok(super::super::EstablishedDocument { markdown, state })
}

/// Discover the declared identity without requiring valid projection or body.
pub fn id_from_markdown(markdown: &str) -> Option<String> {
    let normalized = markdown
        .strip_prefix('\u{feff}')
        .unwrap_or(markdown)
        .replace("\r\n", "\n");
    let rest = normalized.strip_prefix("---\n")?;
    let yaml = rest
        .split_once("\n---\n")
        .map(|(a, _)| a)
        .or_else(|| rest.strip_suffix("\n---"))?;
    let docs = yaml_rust2::YamlLoader::load_from_str(yaml).ok()?;
    if docs.len() != 1 {
        return None;
    }
    let id = docs[0]
        .as_hash()?
        .get(&yaml_rust2::Yaml::String("id".into()))?
        .as_str()?;
    is_kebab(id).then(|| id.to_owned())
}
