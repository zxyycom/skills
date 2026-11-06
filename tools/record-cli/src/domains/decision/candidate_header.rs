use super::*;

/// Candidate discovery classification is independent from full metadata/body validation.
pub fn candidate_header(text: &str, source_path: &str) -> Result<(Option<String>, bool), String> {
    let fields = super::super::candidate_header_fields(text)?;
    let Some(header) = fields else {
        return Err(format!(
            "{source_path} cannot be safely classified: ambiguous Decision header identity/status"
        ));
    };
    let super::super::candidate_header::CandidateHeaderFields {
        keys,
        document: doc,
    } = header;
    let statuses = keys.iter().filter(|key| *key == "status").count();
    if statuses != 1 {
        return Err(format!(
            "{source_path} cannot be safely classified: ambiguous Decision header identity/status"
        ));
    }
    let map = doc
        .as_hash()
        .ok_or_else(|| format!("{source_path} cannot be safely classified"))?;
    let get = |name: &str| {
        map.get(&yaml_rust2::Yaml::String(name.into()))
            .and_then(yaml_rust2::Yaml::as_str)
    };
    let status =
        get("status").ok_or_else(|| format!("{source_path} cannot be safely classified"))?;
    if !matches!(status, "candidate" | "active" | "archived")
        || (status == "archived") != source_path.starts_with("archive/")
    {
        return Err(format!(
            "{source_path} status must match its physical sourcePath"
        ));
    }
    Ok((
        get("id").filter(|id| is_kebab(id)).map(str::to_owned),
        status == "candidate",
    ))
}
