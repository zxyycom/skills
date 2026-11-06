use super::*;

/// Candidate header discovery tolerates invalid scaffold, but not duplicate identity declarations.
pub fn candidate_header(text: &str) -> Result<Option<String>, String> {
    let header = text
        .strip_prefix('\u{feff}')
        .unwrap_or(text)
        .replace("\r\n", "\n");
    if let Some(rest) = header.strip_prefix("---\n") {
        let yaml = rest
            .find("\n---\n")
            .map(|i| &rest[..i])
            .or_else(|| rest.strip_suffix("\n---"));
        if let Some(yaml) = yaml {
            for line in yaml.lines() {
                let line = line.trim_start();
                if ["title: ", "question: ", "summary: "]
                    .iter()
                    .any(|prefix| line.starts_with(prefix))
                    && crate::index::has_unpaired_json_surrogate(line)
                {
                    return Err("unsupported-unpaired-surrogate".into());
                }
            }
        }
    }
    let Some(header) = super::super::candidate_header_fields(text)? else {
        return Ok(None);
    };
    let super::super::candidate_header::CandidateHeaderFields { document: doc, .. } = header;
    Ok(doc
        .as_hash()
        .and_then(|map| map.get(&yaml_rust2::Yaml::String("id".into())))
        .and_then(yaml_rust2::Yaml::as_str)
        .filter(|id| is_kebab(id))
        .map(str::to_owned))
}
