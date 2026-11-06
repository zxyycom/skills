use super::*;

/// Serialize a validated model to YAML and verify its semantic round trip.
/// The YAML emitter may choose different quoting than the TypeScript emitter.
pub fn serialize_document(front: &Frontmatter) -> Result<String, String> {
    let yaml = yaml_document(front);
    use yaml_rust2::YamlEmitter;
    let mut result = String::new();
    YamlEmitter::new(&mut result)
        .dump(&yaml)
        .map_err(|e| e.to_string())?;
    result.push_str("\n---\n\n");
    result.push_str(&front.body);
    let parsed = parse_frontmatter(result.as_bytes(), &front.id)?;
    if &parsed != front {
        return Err("YAML serialization changed document semantics".into());
    }
    Ok(result)
}

// YAML node construction is separate from emission and round-trip verification.
fn yaml_document(front: &Frontmatter) -> yaml_rust2::Yaml {
    use yaml_rust2::{Yaml, yaml::Hash};
    let mut map = Hash::new();
    let string = |value: &str| Yaml::String(value.to_owned());
    for (key, value) in [
        ("title", string(&front.title)),
        ("id", string(&front.id)),
        ("status", string(&front.status)),
        (
            "alignment",
            front.alignment.as_deref().map_or(Yaml::Null, string),
        ),
        (
            "createdAt",
            front.created_at.as_deref().map_or(Yaml::Null, string),
        ),
        ("purpose", string(&front.purpose)),
        ("background", string(&front.background)),
        ("decision", string(&front.decision)),
        (
            "tags",
            Yaml::Array(front.tags.iter().map(|v| string(v)).collect()),
        ),
    ] {
        map.insert(string(key), value);
    }
    let mut relations = Vec::new();
    for relation in &front.relations {
        let mut map = Hash::new();
        map.insert(string("type"), string(&relation.relation_type));
        map.insert(string("target"), string(&relation.target));
        if let Some(summary) = &relation.summary {
            map.insert(string("summary"), string(summary));
        }
        relations.push(Yaml::Hash(map));
    }
    map.insert(string("relations"), Yaml::Array(relations));
    Yaml::Hash(map)
}
