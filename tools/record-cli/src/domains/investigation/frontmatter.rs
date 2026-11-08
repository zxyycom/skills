use super::*;

/// Line-oriented report frontmatter; body and resource readiness are separate checks.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frontmatter {
    pub id: String,
    pub title: String,
    pub formed_at: String,
    pub question: String,
    pub tags: Vec<String>,
    pub relations: Vec<Relation>,
    pub end_line: usize,
    pub relations_start_line: usize,
    pub relations_end_line: usize,
}

pub fn parse_frontmatter(bytes: &[u8], expected_id: &str) -> Result<Frontmatter, String> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| "invalid UTF-8")?
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    let lines: Vec<_> = text.split('\n').collect();
    let end = frontmatter_end(&lines)?;
    let HeaderFields {
        title,
        id,
        formed_at,
        question,
    } = parse_header_fields(&lines)?;
    let mut cursor = 5usize;
    if !is_kebab(&id) || id != expected_id {
        return Err("frontmatter ID does not match expected ID".into());
    }
    let tags = parse_tags(&lines, &mut cursor, end)?;
    let relations_start_line = cursor;
    let relations = parse_relations(&lines, &mut cursor, end)?;
    let relations_end_line = cursor;
    if cursor != end {
        return Err("unknown or misplaced frontmatter field".into());
    }
    validate_relation_order(&relations)?;
    Ok(Frontmatter {
        id,
        title,
        formed_at,
        question,
        tags,
        relations,
        end_line: end,
        relations_start_line,
        relations_end_line,
    })
}

struct HeaderFields {
    title: String,
    id: String,
    formed_at: String,
    question: String,
}
fn parse_header_fields(lines: &[&str]) -> Result<HeaderFields, String> {
    let mut cursor = 1usize;
    let mut required = |prefix| {
        let value = scalar(lines.get(cursor), prefix);
        cursor += 1;
        value
    };
    let title = required("title: ")?;
    let id = required("id: ")?;
    let formed_at = required("formedAt: ")?;
    let question = required("question: ")?;
    Ok(HeaderFields {
        title,
        id,
        formed_at,
        question,
    })
}

fn frontmatter_end(lines: &[&str]) -> Result<usize, String> {
    if lines.first() != Some(&"---") {
        return Err("frontmatter must start with ---".into());
    }
    let end = lines
        .iter()
        .enumerate()
        .skip(1)
        .find_map(|(i, l)| (*l == "---").then_some(i))
        .ok_or("frontmatter must end with ---")?;
    Ok(end)
}

fn scalar(line: Option<&&str>, prefix: &str) -> Result<String, String> {
    let raw = line
        .and_then(|l| l.strip_prefix(prefix))
        .ok_or_else(|| format!("expected {prefix}"))?;
    if !raw.starts_with('"') || !raw.ends_with('"') {
        return Err(format!("invalid quoted scalar for {prefix}"));
    }
    let value: String =
        serde_json::from_str(raw).map_err(|_| format!("invalid quoted scalar for {prefix}"))?;
    if value.js_trim().is_empty() || value.chars().any(|c| (c as u32) < 32) {
        return Err(format!("invalid scalar for {prefix}"));
    }
    Ok(value)
}

fn parse_tags(lines: &[&str], cursor: &mut usize, end: usize) -> Result<Vec<String>, String> {
    if lines.get(*cursor) != Some(&"tags:") {
        return Err("expected tags".into());
    }
    *cursor += 1;
    let mut tags = Vec::new();
    while *cursor < end && lines[*cursor].starts_with("  - ") {
        let tag = scalar(lines.get(*cursor), "  - ")?;
        if !is_kebab(&tag) {
            return Err("invalid tag".into());
        }
        tags.push(tag);
        *cursor += 1;
    }
    if tags.is_empty() || !super::super::sorted(&tags) {
        return Err("tags must be non-empty, unique and sorted".into());
    }
    Ok(tags)
}

fn parse_relations(
    lines: &[&str],
    cursor: &mut usize,
    end: usize,
) -> Result<Vec<Relation>, String> {
    let mut relations = Vec::new();
    if lines.get(*cursor) == Some(&"relations: []") {
        *cursor += 1;
    } else if lines.get(*cursor) == Some(&"relations:") {
        *cursor += 1;
        while *cursor < end && lines[*cursor].starts_with("  - type: ") {
            relations.push(parse_relation(lines, cursor)?);
        }
        if relations.is_empty() {
            return Err("empty relations must use relations: []".into());
        }
    } else {
        return Err("expected relations".into());
    }
    Ok(relations)
}

fn parse_relation(lines: &[&str], cursor: &mut usize) -> Result<Relation, String> {
    let relation_type = scalar(lines.get(*cursor), "  - type: ")?;
    *cursor += 1;
    let target = scalar(lines.get(*cursor), "    target: ")?;
    *cursor += 1;
    let summary = parse_relation_summary(lines, cursor)?;
    if !["补充", "复查", "修正", "推翻", "归并", "拆分"].contains(&relation_type.as_str())
        || !is_kebab(&target)
        || summary
            .as_ref()
            .is_some_and(|s| s.contains(['\r', '\n']) || s.chars().count() > 40)
    {
        return Err("invalid relation".into());
    }
    Ok(Relation {
        relation_type,
        target,
        summary,
    })
}

fn validate_relation_order(relations: &[Relation]) -> Result<(), String> {
    let rank = |r: &Relation| {
        ["补充", "复查", "修正", "推翻", "归并", "拆分"]
            .iter()
            .position(|v| *v == r.relation_type)
            .unwrap_or(usize::MAX)
    };
    let mut targets = std::collections::HashSet::new();
    if !relations.iter().all(|r| targets.insert(&r.target))
        || !relations.windows(2).all(|w| {
            rank(&w[0]) < rank(&w[1])
                || (rank(&w[0]) == rank(&w[1])
                    && w[0]
                        .target
                        .encode_utf16()
                        .cmp(w[1].target.encode_utf16())
                        .is_lt())
        })
    {
        return Err("relations must be unique and sorted".into());
    }
    Ok(())
}

fn parse_relation_summary(lines: &[&str], cursor: &mut usize) -> Result<Option<String>, String> {
    let summary = if lines
        .get(*cursor)
        .is_some_and(|line| line.starts_with("    summary: "))
    {
        let raw = lines[*cursor]
            .strip_prefix("    summary: ")
            .expect("prefix checked");
        if !raw.starts_with('"') || !raw.ends_with('"') {
            return Err("invalid quoted relation summary".into());
        }
        let v: String = serde_json::from_str(raw).map_err(|_| "invalid quoted relation summary")?;
        *cursor += 1;
        let trimmed = v.js_trim();
        (!trimmed.is_empty()).then(|| trimmed.to_owned())
    } else {
        None
    };
    Ok(summary)
}
