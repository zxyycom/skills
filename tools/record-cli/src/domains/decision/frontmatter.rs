use super::*;
use yaml_rust2::Yaml;

/// Parsed source metadata; candidate nulls are not representable by index state.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frontmatter {
    pub id: String,
    pub title: String,
    pub status: String,
    pub alignment: Option<String>,
    pub created_at: Option<String>,
    pub purpose: String,
    pub background: String,
    pub decision: String,
    pub tags: Vec<String>,
    pub relations: Vec<Relation>,
    pub body: String,
}

/// Parse genuine YAML frontmatter, preserving candidate lifecycle nulls.
pub fn parse_frontmatter(bytes: &[u8], expected_id: &str) -> Result<Frontmatter, String> {
    use yaml_rust2::YamlLoader;
    let input = std::str::from_utf8(bytes).map_err(|_| "invalid UTF-8")?;
    let text = input
        .strip_prefix('\u{feff}')
        .unwrap_or(input)
        .replace("\r\n", "\n");
    let after = text.strip_prefix("---\n").ok_or("missing frontmatter")?;
    let end = after
        .find("\n---\n")
        .map(|i| (i, i + 5))
        .or_else(|| after.strip_suffix("\n---").map(|v| (v.len(), after.len())))
        .ok_or("missing frontmatter end")?;
    let docs =
        YamlLoader::load_from_str(&after[..end.0]).map_err(|e| format!("invalid YAML: {e}"))?;
    if docs.len() != 1 {
        return Err("expected one YAML mapping".into());
    }
    let map = docs[0].as_hash().ok_or("frontmatter must be a mapping")?;
    let body = after[end.1..].trim_start_matches('\n').to_owned();
    decode_frontmatter(map, expected_id, body)
}

fn decode_frontmatter(
    map: &YamlMap,
    expected_id: &str,
    body: String,
) -> Result<Frontmatter, String> {
    validate_field_order(map)?;
    let id = field(map, "id")?.to_owned();
    if !is_kebab(&id) || id != expected_id {
        return Err("frontmatter ID does not match expected ID".into());
    }
    let lifecycle = parse_lifecycle(map)?;
    let ProjectionFields {
        title,
        purpose,
        background,
        decision,
    } = projection_fields(map)?;
    let tags = parse_tags(&map[&Yaml::String("tags".into())])?;
    let relations = parse_relations(&map[&Yaml::String("relations".into())])?;
    if relations.iter().any(|relation| relation.target == id) {
        return Err("decision relation cannot target itself".into());
    }
    Ok(Frontmatter {
        id,
        title,
        status: lifecycle.status,
        alignment: lifecycle.alignment,
        created_at: lifecycle.created_at,
        purpose,
        background,
        decision,
        tags,
        relations,
        body,
    })
}

// Canonical ordering is part of the source format, not YAML map semantics.
fn validate_field_order(map: &YamlMap) -> Result<(), String> {
    let keys = [
        "title",
        "id",
        "status",
        "alignment",
        "createdAt",
        "purpose",
        "background",
        "decision",
        "tags",
        "relations",
    ];
    if map.len() != keys.len()
        || !map
            .keys()
            .zip(keys)
            .all(|(key, expected)| key.as_str() == Some(expected))
    {
        return Err("frontmatter fields must use canonical order".into());
    }
    Ok(())
}

type YamlMap = yaml_rust2::yaml::Hash;

fn field<'a>(map: &'a YamlMap, key: &str) -> Result<&'a str, String> {
    map.get(&Yaml::String(key.into()))
        .and_then(Yaml::as_str)
        .ok_or_else(|| format!("{key} must be a string"))
}

fn nullable(map: &YamlMap, key: &str) -> Result<Option<String>, String> {
    match map.get(&Yaml::String(key.into())) {
        Some(Yaml::Null) => Ok(None),
        Some(Yaml::String(value)) => Ok(Some(value.clone())),
        _ => Err(format!("{key} must be a string or null")),
    }
}

struct Lifecycle {
    status: String,
    alignment: Option<String>,
    created_at: Option<String>,
}
fn parse_lifecycle(map: &YamlMap) -> Result<Lifecycle, String> {
    let status = field(map, "status")?.to_owned();
    let alignment = nullable(map, "alignment")?;
    let created_at = nullable(map, "createdAt")?;
    match status.as_str() {
        "candidate" if alignment.is_none() && created_at.is_none() => {}
        "active" | "archived"
            if alignment
                .as_deref()
                .is_some_and(|v| matches!(v, "aligned" | "unaligned"))
                && created_at
                    .as_deref()
                    .is_some_and(super::super::valid_timestamp) => {}
        _ => return Err("invalid lifecycle metadata".into()),
    }
    Ok(Lifecycle {
        status,
        alignment,
        created_at,
    })
}

struct ProjectionFields {
    title: String,
    purpose: String,
    background: String,
    decision: String,
}
fn projection_fields(map: &YamlMap) -> Result<ProjectionFields, String> {
    Ok(ProjectionFields {
        title: projection(map, "title")?,
        purpose: projection(map, "purpose")?,
        background: projection(map, "background")?,
        decision: projection(map, "decision")?,
    })
}

fn projection(map: &YamlMap, key: &str) -> Result<String, String> {
    let value = field(map, key)?;
    if value.contains(['\r', '\n']) || !(4..=100).contains(&value.js_trim().chars().count()) {
        return Err(format!("invalid {key} projection"));
    }
    Ok(value.to_owned())
}

fn parse_tags(value: &Yaml) -> Result<Vec<String>, String> {
    let tags = value
        .as_vec()
        .ok_or("tags must be an array")?
        .iter()
        .map(|value| {
            value
                .as_str()
                .filter(|tag| is_kebab(tag))
                .map(str::to_owned)
                .ok_or("invalid tag".to_owned())
        })
        .collect::<Result<Vec<_>, _>>()?;
    if tags.is_empty() || !super::super::sorted(&tags) {
        return Err("tags must be non-empty, unique and sorted".into());
    }
    Ok(tags)
}

fn parse_relations(value: &Yaml) -> Result<Vec<Relation>, String> {
    let mut targets = std::collections::HashSet::new();
    value
        .as_vec()
        .ok_or("relations must be an array")?
        .iter()
        .map(|item| parse_relation(item, &mut targets))
        .collect()
}

fn parse_relation(
    value: &Yaml,
    targets: &mut std::collections::HashSet<String>,
) -> Result<Relation, String> {
    let relation = value.as_hash().ok_or("relation must be a mapping")?;
    if !canonical_relation_keys(relation) {
        return Err("relation fields must use canonical order".into());
    }
    let ty = relation
        .get(&Yaml::String("type".into()))
        .and_then(Yaml::as_str)
        .ok_or("invalid relation type")?;
    let target = relation
        .get(&Yaml::String("target".into()))
        .and_then(Yaml::as_str)
        .ok_or("invalid relation target")?;
    if !["修订", "替代", "判定无效", "归并", "拆分", "重划"].contains(&ty)
        || !is_kebab(target)
        || !targets.insert(target.to_owned())
    {
        return Err("invalid or duplicate relation".into());
    }
    let summary = parse_relation_summary(relation.get(&Yaml::String("summary".into())))?;
    Ok(Relation {
        relation_type: ty.into(),
        target: target.into(),
        summary,
    })
}

fn canonical_relation_keys(relation: &YamlMap) -> bool {
    let expected: &[&str] = if relation.contains_key(&Yaml::String("summary".into())) {
        &["type", "target", "summary"]
    } else {
        &["type", "target"]
    };
    relation.len() == expected.len()
        && relation
            .keys()
            .zip(expected)
            .all(|(key, expected)| key.as_str() == Some(*expected))
}

fn parse_relation_summary(value: Option<&Yaml>) -> Result<Option<String>, String> {
    let summary = match value {
        None => None,
        Some(Yaml::String(s)) => {
            let value = s.js_trim();
            if value.contains(['\r', '\n']) || value.chars().count() > 40 {
                return Err("invalid relation summary".into());
            }
            if value.is_empty() {
                None
            } else {
                Some(value.to_owned())
            }
        }
        _ => return Err("summary must be a string".into()),
    };
    Ok(summary)
}
