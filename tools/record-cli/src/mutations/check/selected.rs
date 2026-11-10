use super::*;

/// Selected checks read the published locator when usable; only unresolved or
/// moved IDs trigger header discovery. They do not check the complete graph or
/// the index's currentness, and must not claim those as coverage.
pub(super) fn selected_investigations(
    root: &Root,
    directory: &str,
    ids: &[String],
) -> Result<CheckResult, CheckError> {
    let dir = RelativePath::new(directory)
        .map_err(|e| error("path-invalid", directory, e.to_string()))?;
    let requested = validate_selection(ids)?;
    let IndexedSources {
        index_path,
        mut found,
        formal_count,
    } = locate_indexed(root, &dir, directory, ids)?;
    discover_unresolved(root, &dir, directory, &requested, &mut found)?;
    let SourceValidation {
        mut refs,
        report_refs,
        mut diagnostics,
    } = validate_sources(ids, &found);
    refs.sort();
    refs.dedup();
    validate_resources(root, &dir, directory, &refs, &mut diagnostics)?;
    let mut checked_ids = ids.to_vec();
    checked_ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    let formal_count = formal_count.unwrap_or(found.len());
    let coverage = SelectedCoverage {
        checked_ids,
        formal_count,
        index_path,
    };
    if !diagnostics.is_empty() {
        let errors = diagnostics
            .iter()
            .map(|e| format!("{}: {}", e.path, e.message))
            .collect();
        return Err(aggregate(
            diagnostics,
            coverage.result("selected-partial", found.len(), errors),
        ));
    }
    let mut result = coverage.result("selected", ids.len(), vec![]);
    result.resource_refs = report_refs;
    Ok(result)
}

struct SelectedCoverage {
    checked_ids: Vec<String>,
    formal_count: usize,
    index_path: RelativePath,
}
impl SelectedCoverage {
    fn result(
        self,
        scope: &'static str,
        selected_count: usize,
        errors: Vec<String>,
    ) -> CheckResult {
        CheckResult {
            resource_refs: BTreeMap::new(),
            scope,
            checked_ids: self.checked_ids,
            formal_count: self.formal_count,
            candidate_count: 0,
            index_state: "not-checked",
            warnings: vec![],
            index_path: self
                .index_path
                .as_path()
                .to_string_lossy()
                .replace('\\', "/"),
            errors,
            summary: None,
            available_report_count: Some(self.formal_count),
            selected_report_count: Some(selected_count),
            index_checked: Some(false),
        }
    }
}

fn validate_selection(ids: &[String]) -> Result<HashSet<String>, CheckError> {
    let mut requested = HashSet::new();
    for id in ids {
        if !domains::is_kebab(id) {
            return Err(error("invalid-selection", id, "invalid Investigation ID"));
        }
        if !requested.insert(id.clone()) {
            return Err(error("invalid-selection", id, "repeated Investigation ID"));
        }
    }
    Ok(requested)
}

struct SourceValidation {
    refs: Vec<String>,
    report_refs: crate::resource_review::ReportResources,
    diagnostics: Vec<CheckError>,
}
fn validate_sources(ids: &[String], found: &FoundSources) -> SourceValidation {
    let mut refs = Vec::new();
    let mut report_refs = BTreeMap::new();
    let mut diagnostics = Vec::new();
    for id in ids {
        let Some((path, bytes)) = found.get(id) else {
            diagnostics.push(error(
                "not-found",
                id,
                "Investigation ID does not resolve to a source",
            ));
            continue;
        };
        if let Ok(text) = std::str::from_utf8(bytes)
            && matches!(domains::investigation::candidate_header(text), Err(ref message) if message == "unsupported-unpaired-surrogate")
        {
            diagnostics.push(error(
                "unsupported-unpaired-surrogate",
                path,
                "unpaired UTF-16 surrogate in Investigation frontmatter",
            ));
            continue;
        }
        match domains::investigation::parse_established(bytes, id, path) {
            Ok(parsed) => {
                refs.extend(parsed.state.resource_ids.iter().cloned());
                report_refs.insert(id.clone(), parsed.state.resource_ids);
            }
            Err(e) => {
                let code = if e.contains("unsupported-unpaired-surrogate") {
                    "unsupported-unpaired-surrogate"
                } else {
                    "source-invalid"
                };
                diagnostics.push(error(code, path, e));
            }
        }
    }
    SourceValidation {
        refs,
        report_refs,
        diagnostics,
    }
}

fn validate_resources(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
    refs: &[String],
    diagnostics: &mut Vec<CheckError>,
) -> Result<(), CheckError> {
    let resource_path = RelativePath::new(dir.as_path().join("_resources"))
        .map_err(|e| error("path-invalid", directory, e.to_string()))?;
    let resources_exist = if refs.is_empty() {
        false
    } else {
        match source::enumerate_directory(root, &resource_path) {
            Ok(_) => true,
            Err(source::SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => false,
            Err(e) => return Err(error("resource-read", "_resources", e.to_string())),
        }
    };
    if !refs.is_empty() {
        match crate::resources::referenced_resource_issues(root, directory, refs, resources_exist) {
            Ok(issues) => diagnostics.extend(
                issues
                    .into_iter()
                    .map(|message| error("resource-invalid", "_resources", message)),
            ),
            Err(e) => diagnostics.push(error("resource-read", "_resources", e.to_string())),
        }
    }
    Ok(())
}

type FoundSources = BTreeMap<String, (String, Vec<u8>)>;

struct IndexedSources {
    index_path: RelativePath,
    found: FoundSources,
    formal_count: Option<usize>,
}

fn locate_indexed(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
    ids: &[String],
) -> Result<IndexedSources, CheckError> {
    let index_path = RelativePath::new(dir.as_path().join("investigation-index.json"))
        .map_err(|e| error("path-invalid", directory, e.to_string()))?;
    let index_file = source::capture(root, &index_path)
        .map_err(|e| error("index-read", directory, e.to_string()))?;
    let index = match index_file {
        ExpectedFile::Missing => None,
        ExpectedFile::Present(file) => {
            crate::index::parse_index(&file.bytes, &domains::investigation::Definition).ok()
        }
    };
    let mut found: BTreeMap<String, (String, Vec<u8>)> = BTreeMap::new();
    for id in ids {
        if let Some(state) = index.as_ref().and_then(|i| i.index().entries.get(id))
            && let Some(file) = indexed_source(root, dir, id, &state.source_path)?
        {
            found.insert(id.clone(), (state.source_path.clone(), file));
        }
    }
    Ok(IndexedSources {
        index_path,
        found,
        formal_count: index.as_ref().map(|i| i.index().entries.len()),
    })
}

fn indexed_source(
    root: &Root,
    dir: &RelativePath,
    id: &str,
    source_path: &str,
) -> Result<Option<Vec<u8>>, CheckError> {
    let path = RelativePath::new(dir.as_path().join(source_path))
        .map_err(|e| error("path-invalid", source_path, e.to_string()))?;
    let Some(header) = source::capture_header(root, &path)
        .map_err(|e| error("source-read", source_path, e.to_string()))?
    else {
        return Ok(None);
    };
    let text = std::str::from_utf8(&header.bytes)
        .map_err(|e| error("source-encoding", source_path, e.to_string()))?;
    if domains::investigation::id_from_markdown(text).as_deref() != Some(id) {
        return Ok(None);
    }
    Ok(Some(capture_selected(root, &path, source_path, id)?))
}

fn capture_selected(
    root: &Root,
    path: &RelativePath,
    name: &str,
    id: &str,
) -> Result<Vec<u8>, CheckError> {
    let ExpectedFile::Present(file) =
        source::capture(root, path).map_err(|e| error("source-read", name, e.to_string()))?
    else {
        return Err(error("source-changed", name, "source disappeared"));
    };
    let text =
        source::strict_text(&file).map_err(|e| error("source-encoding", name, e.to_string()))?;
    if domains::investigation::id_from_markdown(text).as_deref() != Some(id) {
        return Err(error("source-changed", name, "source identity changed"));
    }
    Ok(file.bytes)
}

fn discover_unresolved(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
    requested: &HashSet<String>,
    found: &mut FoundSources,
) -> Result<(), CheckError> {
    if found.len() < requested.len() {
        let unresolved: HashSet<_> = requested
            .iter()
            .filter(|id| !found.contains_key(*id))
            .cloned()
            .collect();
        let listing = source::enumerate_directory(root, dir)
            .map_err(|e| error("collection-read", directory, e.to_string()))?;
        for member in listing.members {
            discover_member(root, dir, member, &unresolved, found)?;
        }
    }
    Ok(())
}

fn discover_member(
    root: &Root,
    dir: &RelativePath,
    member: source::DirectoryMember,
    unresolved: &HashSet<String>,
    found: &mut FoundSources,
) -> Result<(), CheckError> {
    if !is_source_member(&member)? {
        return Ok(());
    }
    let (path, identity) = capture_member_identity(root, dir, &member.name)?;
    if let Some(id) = identity
        && unresolved.contains(&id)
    {
        if found.contains_key(&id) {
            return Err(error("duplicate-id", member.name, id));
        }
        let bytes = capture_selected(root, &path, &member.name, &id)?;
        found.insert(id, (member.name, bytes));
    }
    Ok(())
}

fn capture_member_identity(
    root: &Root,
    dir: &RelativePath,
    name: &str,
) -> Result<(RelativePath, Option<String>), CheckError> {
    let path = RelativePath::new(dir.as_path().join(name))
        .map_err(|e| error("path-invalid", name, e.to_string()))?;
    let header = source::capture_header(root, &path)
        .map_err(|e| error("source-read", name, e.to_string()))?
        .ok_or_else(|| error("source-changed", name, "source disappeared"))?;
    let text = std::str::from_utf8(&header.bytes)
        .map_err(|e| error("source-encoding", name, e.to_string()))?;
    Ok((path, domains::investigation::id_from_markdown(text)))
}

fn is_source_member(member: &source::DirectoryMember) -> Result<bool, CheckError> {
    let name = &member.name;
    if name == "investigation-index.json" || name == "_resources" || name.starts_with("_candidate.")
    {
        return Ok(false);
    }
    if member.kind == MemberKind::File && name.strip_suffix(".md").is_some_and(domains::is_kebab) {
        return Ok(true);
    }
    Err(error("member-invalid", name, "unsafe Investigation source"))
}
