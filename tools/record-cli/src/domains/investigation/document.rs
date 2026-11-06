use super::*;

/// Parse candidate bytes without reading resource files. `resource_ready: None` is
/// deliberate: filesystem existence, ownership and safety need a trusted snapshot.
pub fn parse_candidate(
    bytes: &[u8],
    id: &str,
    source_path: &str,
) -> Result<super::super::CandidateDocument<InvestigationState>, String> {
    parse_candidate_assessed(bytes, id, source_path).map(|parsed| parsed.document)
}

/// A single candidate parse shares its strict body assessment with resource checks.
pub(crate) struct AssessedCandidate {
    pub document: super::super::CandidateDocument<InvestigationState>,
    pub body: BodyAssessment,
}
pub(crate) fn parse_candidate_assessed(
    bytes: &[u8],
    id: &str,
    source_path: &str,
) -> Result<AssessedCandidate, String> {
    if !source_path
        .strip_prefix("_candidate.")
        .is_some_and(is_kebab)
    {
        return Err("invalid candidate locator".into());
    }
    parse_candidate_inner(bytes, id, source_path)
}
fn parse_candidate_inner(
    bytes: &[u8],
    id: &str,
    source_path: &str,
) -> Result<AssessedCandidate, String> {
    let markdown = std::str::from_utf8(bytes)
        .map_err(|_| "invalid UTF-8")?
        .to_owned();
    let front = parse_frontmatter(bytes, id)?;
    let scaffold = assess_body(bytes, front.end_line, true)?;
    let body = assess_body(bytes, front.end_line, false)?;
    let mut diagnostics = candidate_diagnostics(id, &markdown, &scaffold, &body);
    let CandidateProjection { valid, state } =
        candidate_projection(front, id, source_path, &body.resource_ids);
    let resource_ids = body.resource_ids.clone();
    if !valid {
        diagnostics.push("candidate cannot form a valid projection (path, timestamp, identity date, or metadata)".into());
    }
    let scaffold_valid = scaffold.body_errors.is_empty() && valid;
    let document = super::super::CandidateDocument {
        markdown,
        state,
        resource_ids,
        readiness: super::super::Readiness {
            scaffold_valid,
            body_ready: body.body_errors.is_empty(),
            resource_ready: None,
        },
        diagnostics,
    };
    Ok(AssessedCandidate { document, body })
}

struct CandidateProjection {
    valid: bool,
    state: Option<InvestigationState>,
}
fn candidate_projection(
    front: Frontmatter,
    id: &str,
    source_path: &str,
    resource_ids: &[String],
) -> CandidateProjection {
    let candidate_locator = source_path
        .strip_prefix("_candidate.")
        .is_some_and(is_kebab);
    let valid = (candidate_locator || super::super::path_name(source_path))
        && super::super::valid_timestamp(&front.formed_at)
        && identity_date_matches(id, &front.formed_at)
        && super::super::single_line(&front.title)
        && super::super::single_line(&front.question);
    let state = if valid && !candidate_locator {
        Some(InvestigationState {
            formed_at: front.formed_at,
            name: super::super::name_from_id(id).to_owned(),
            question: front.question,
            relations: front.relations,
            resource_ids: resource_ids.to_vec(),
            source_path: source_path.to_owned(),
            tags: front.tags,
            title: front.title,
        })
    } else {
        None
    };
    CandidateProjection { valid, state }
}

fn identity_date_matches(id: &str, formed_at: &str) -> bool {
    let dated = super::super::name_from_id(id) != id;
    !dated
        || time::OffsetDateTime::parse(formed_at, &time::format_description::well_known::Rfc3339)
            .ok()
            .is_some_and(|value| {
                let utc = value.to_offset(time::UtcOffset::UTC);
                format!(
                    "{:02}{:02}{:02}",
                    utc.year().rem_euclid(100),
                    utc.month() as u8,
                    utc.day()
                ) == id[..6]
            })
}

fn candidate_diagnostics(
    id: &str,
    markdown: &str,
    scaffold: &BodyAssessment,
    body: &BodyAssessment,
) -> Vec<String> {
    let mut diagnostics = scaffold.body_errors.clone();
    diagnostics.extend(body.body_errors.iter().cloned());
    diagnostics.extend(body.resource_errors.iter().cloned());
    let normalized_lines = markdown.replace("\r\n", "\n").replace('\r', "\n");
    let lines: Vec<_> = normalized_lines.lines().collect();
    let mut invalid_links = invalid_resource_lines(&lines).into_iter();
    for diagnostic in &mut diagnostics {
        if let Some(title) = diagnostic.strip_prefix("empty section: ")
            && let Some(line) = lines.iter().position(|line| *line == format!("## {title}"))
        {
            *diagnostic = format!("{id}:{} section \"{title}\" must not be empty", line + 1);
        } else if diagnostic == "invalid attached resource link" {
            if let Some(line) = invalid_links.next() {
                *diagnostic = format!(
                    "{id}:{line} each attached resource must be one valid local Markdown inline link"
                );
            } else {
                *diagnostic = format!("{id}: invalid attached resource link");
            }
        } else if !diagnostic.starts_with(&format!("{id}:")) {
            *diagnostic = format!("{id}: {diagnostic}");
        }
    }
    diagnostics
}

fn invalid_resource_lines(lines: &[&str]) -> Vec<usize> {
    let mut invalid_links = Vec::new();
    if let Some(start) = lines.iter().position(|line| *line == "## 随附资源") {
        for (index, line) in lines.iter().enumerate().skip(start + 1) {
            if line.starts_with("## ") {
                break;
            }
            if line.js_trim().is_empty() {
                continue;
            }
            let target = line
                .strip_prefix("- [")
                .and_then(|value| value.split_once("]("))
                .filter(|(label, _)| !label.is_empty() && !label.contains(']'))
                .and_then(|(_, value)| value.strip_suffix(')'))
                .and_then(|value| value.strip_prefix("./_resources/"));
            if !target.is_some_and(valid_resource_id) {
                invalid_links.push(index + 1);
            }
        }
    }
    invalid_links
}

/// Replace only the relation block after checking the resulting line contract.
pub fn replace_relations(
    bytes: &[u8],
    expected_id: &str,
    relations: &[Relation],
) -> Result<String, String> {
    let front = parse_frontmatter(bytes, expected_id)?;
    let normalized = std::str::from_utf8(bytes)
        .map_err(|_| "invalid UTF-8")?
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    let mut lines: Vec<String> = normalized.split('\n').map(str::to_owned).collect();
    let replacement = render_relation_lines(relations)?;
    lines.splice(
        front.relations_start_line..front.relations_end_line,
        replacement,
    );
    let result = lines.join("\n");
    parse_frontmatter(result.as_bytes(), expected_id)?;
    Ok(result)
}

/// Validate established document text only. Filesystem resource proofs and
/// collection-wide relation/owner validation remain separate obligations.
pub fn parse_established(
    bytes: &[u8],
    id: &str,
    source_path: &str,
) -> Result<super::super::EstablishedDocument<InvestigationState>, String> {
    if !super::super::path_name(source_path) {
        return Err("invalid established source path".into());
    }
    let parsed = parse_candidate_inner(bytes, id, source_path)?.document;
    if !parsed.readiness.scaffold_valid
        || !parsed.readiness.body_ready
        || !parsed.diagnostics.is_empty()
    {
        return Err(parsed.diagnostics.join("; "));
    }
    let state = parsed.state.ok_or("invalid established projection")?;
    Ok(super::super::EstablishedDocument {
        markdown: parsed.markdown,
        state,
    })
}

/// Discover identity using only the required first three frontmatter lines.
pub fn id_from_markdown(markdown: &str) -> Option<String> {
    let normalized = markdown.replace("\r\n", "\n").replace('\r', "\n");
    let mut lines = normalized.split('\n');
    if lines.next()? != "---" || !lines.next()?.starts_with("title: ") {
        return None;
    }
    let raw = lines.next()?.strip_prefix("id: ")?;
    if !raw.starts_with('"') || !raw.ends_with('"') {
        return None;
    }
    let id: String = serde_json::from_str(raw).ok()?;
    is_kebab(&id).then_some(id)
}

/// Serialize canonical line-oriented report frontmatter (without trailing newline).
pub fn serialize_frontmatter(front: &Frontmatter) -> Result<String, String> {
    let quote = |value: &str| serde_json::to_string(value).map_err(|e| e.to_string());
    let mut lines = vec![
        "---".into(),
        format!("title: {}", quote(&front.title)?),
        format!("id: {}", quote(&front.id)?),
        format!("formedAt: {}", quote(&front.formed_at)?),
        format!("question: {}", quote(&front.question)?),
        "tags:".into(),
    ];
    for tag in &front.tags {
        lines.push(format!("  - {}", quote(tag)?));
    }
    lines.extend(render_relation_lines(&front.relations)?);
    lines.push("---".into());
    let result = lines.join("\n");
    parse_frontmatter(result.as_bytes(), &front.id)?;
    Ok(result)
}

// Both whole-document serialization and local rewriting use the same line contract.
fn render_relation_lines(relations: &[Relation]) -> Result<Vec<String>, String> {
    if relations.is_empty() {
        return Ok(vec!["relations: []".into()]);
    }
    let quote = |value: &str| serde_json::to_string(value).map_err(|e| e.to_string());
    let mut lines = vec!["relations:".into()];
    for relation in relations {
        lines.push(format!("  - type: {}", quote(&relation.relation_type)?));
        lines.push(format!("    target: {}", quote(&relation.target)?));
        if let Some(summary) = &relation.summary {
            lines.push(format!("    summary: {}", quote(summary)?));
        }
    }
    Ok(lines)
}

/// Rewrite an identity in the declared ID, relation targets and local resource links.
pub fn replace_identity(
    bytes: &[u8],
    document_id: &str,
    old_id: &str,
    next_id: &str,
) -> Result<String, String> {
    if !is_kebab(old_id) || !is_kebab(next_id) {
        return Err("invalid investigation ID".into());
    }
    let front = parse_frontmatter(bytes, document_id)?;
    let relations: Vec<_> = front
        .relations
        .into_iter()
        .map(|mut relation| {
            if relation.target == old_id {
                relation.target = next_id.to_owned();
            }
            relation
        })
        .collect();
    let updated = replace_relations(bytes, document_id, &relations)?;
    let mut lines: Vec<_> = updated.split('\n').map(str::to_owned).collect();
    let final_id = if document_id == old_id {
        lines[2] = format!(
            "id: {}",
            serde_json::to_string(next_id).map_err(|e| e.to_string())?
        );
        next_id
    } else {
        document_id
    };
    let output = lines.join("\n").replace(
        &format!("](./_resources/{old_id}/"),
        &format!("](./_resources/{next_id}/"),
    );
    parse_frontmatter(output.as_bytes(), final_id)?;
    Ok(output)
}
