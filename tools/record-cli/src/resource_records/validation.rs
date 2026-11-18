use super::model::*;
use std::{
    collections::HashSet,
    path::{Component, Path},
};

fn id(s: &str) -> bool {
    !s.is_empty()
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
}
fn nonempty(s: &str) -> bool {
    !s.trim().is_empty()
}
fn path(s: &str) -> bool {
    !s.contains('\0')
        && !s.contains('\\')
        && !s.contains(':')
        && !s.is_empty()
        && s.split('/').all(|v| !v.is_empty() && v != "." && v != "..")
        && Path::new(s)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
}
fn evidence(e: &Evidence) -> Result<(), String> {
    if !path(&e.path) {
        return Err("path must be a workspace-relative path without dot segments".into());
    }
    if e.locator.as_ref().is_some_and(|s| !nonempty(s)) {
        return Err("locator must not be empty".into());
    }
    Ok(())
}
fn location(l: &Location) -> Result<(), String> {
    match l {
        Location::Workspace { path: p } => validate_path(p, "path")?,
        Location::External {
            storage,
            path: p,
            custody,
        } => {
            if !nonempty(storage) {
                return Err("storage must not be empty".into());
            }
            validate_path(p, "path")?;
            validate_path(custody, "custody")?;
        }
    }
    Ok(())
}
fn validate_path(value: &str, field: &str) -> Result<(), String> {
    if path(value) {
        Ok(())
    } else {
        Err(format!(
            "{field} must be a relative path without dot segments"
        ))
    }
}
fn reference(r: &Reference, member: bool) -> Result<(), String> {
    validate_id(&r.resource, "resource")?;
    validate_id(&r.version, "version")?;
    match &r.member {
        Some(value) => validate_id(value, "member")?,
        None if member => return Err("member is required".into()),
        None => {}
    }
    Ok(())
}
fn validate_id(value: &str, field: &str) -> Result<(), String> {
    if id(value) {
        Ok(())
    } else {
        Err(format!(
            "{field} must be a nonempty ASCII identifier using letters, digits, '-', '_' or '.'"
        ))
    }
}
fn unique<'a>(items: impl Iterator<Item = &'a str>) -> bool {
    let mut s = HashSet::new();
    items.into_iter().all(|v| s.insert(v))
}
pub fn validate_record(r: &Record) -> Result<(), String> {
    let (sv, title, tags) = match r {
        Record::Collection {
            schema_version,
            title,
            tags,
            ..
        }
        | Record::Resource {
            schema_version,
            title,
            tags,
            ..
        } => (*schema_version, title, tags),
    };
    if sv != 1 {
        return Err("schemaVersion must be 1".into());
    }
    validate_id(r.id(), "id")?;
    if !nonempty(title) {
        return Err("title must not be empty".into());
    }
    if tags.iter().any(|t| !nonempty(t)) {
        return Err("tags must not contain empty values".into());
    }
    if !unique(tags.iter().map(String::as_str)) {
        return Err("tags must be unique".into());
    }
    match r {
        Record::Collection {
            parent, selections, ..
        } => validate_collection(parent.as_deref(), selections)?,
        Record::Resource {
            collection,
            versions,
            ..
        } => {
            validate_resource(collection, versions)?;
        }
    }
    Ok(())
}

fn validate_collection(parent: Option<&str>, selections: &[Selection]) -> Result<(), String> {
    if parent.is_some_and(|p| !id(p)) {
        return Err(
            "parent must be a nonempty ASCII identifier using letters, digits, '-', '_' or '.'"
                .into(),
        );
    }
    if !unique(selections.iter().map(|s| s.slot.as_str())) {
        return Err("selections.slot duplicate".into());
    }
    for (index, s) in selections.iter().enumerate() {
        let field = format!("selections[{index}]");
        validate_id(&s.slot, &format!("{field}.slot"))?;
        reference(&s.target, false).map_err(|e| format!("{field}.target.{e}"))?;
        if !matches!(
            s.basis.as_str(),
            "agent-provisional" | "user-preference" | "user-confirmed"
        ) {
            return Err(format!(
                "{field}.basis must be agent-provisional, user-preference or user-confirmed"
            ));
        }
        if !nonempty(&s.scope) {
            return Err(format!("{field}.scope must not be empty"));
        }
        evidence(&s.evidence).map_err(|e| format!("{field}.evidence.{e}"))?;
    }
    Ok(())
}

fn validate_version(v: &Version) -> Result<(), String> {
    validate_id(&v.id, "versions.id")?;
    if v.files.is_empty() && v.members.is_empty() {
        return Err(format!(
            "versions.{} must contain at least one file or member",
            v.id
        ));
    }
    if !unique(
        v.files
            .iter()
            .map(|f| f.id.as_str())
            .chain(v.members.iter().map(|m| m.id.as_str())),
    ) {
        return Err(format!(
            "versions.{} file and member IDs must be unique",
            v.id
        ));
    }
    validate_parents(v)?;
    validate_members(v)?;

    for f in &v.files {
        validate_file(v, f)?;
    }
    Ok(())
}

fn validate_file(v: &Version, f: &File) -> Result<(), String> {
    let field = format!("versions.{}.files.{}", v.id, f.id);
    validate_id(&f.id, &format!("{field}.id"))?;
    if !matches!(f.role.as_str(), "primary" | "derivative") {
        return Err(format!("{field}.role must be primary or derivative"));
    }
    if f.sha256.as_ref().is_some_and(|s| !valid_sha(s)) {
        return Err(format!(
            "{field}.sha256 must be 64 lowercase hexadecimal characters"
        ));
    }
    if f.gap.as_ref().is_some_and(|g| !nonempty(g)) {
        return Err(format!("{field}.gap must not be empty"));
    }
    if (f.sha256.is_none() || f.locations.is_empty()) && f.gap.is_none() {
        return Err(format!(
            "{field}.gap is required when sha256 is null or locations is empty"
        ));
    }
    for (index, l) in f.locations.iter().enumerate() {
        location(l).map_err(|e| format!("{field}.locations[{index}].{e}"))?;
    }

    validate_relations(v, f)
}

fn validate_relations(v: &Version, f: &File) -> Result<(), String> {
    let mut orders = HashSet::new();
    let mut edges = HashSet::new();
    for (rel_index, rel) in f.relations.iter().enumerate() {
        let field = format!("versions.{}.files.{}.relations[{rel_index}]", v.id, f.id);
        if !matches!(rel.kind.as_str(), "input" | "preview-of" | "reference") {
            return Err(format!(
                "{field}.type must be input, preview-of or reference"
            ));
        }
        if !nonempty(&rel.scope) {
            return Err(format!("{field}.scope must not be empty"));
        }
        evidence(&rel.evidence).map_err(|e| format!("{field}.evidence.{e}"))?;
        validate_target(&rel.target, &field)?;
        validate_order(rel, &field, &mut orders)?;
        let key = serde_json::to_string(rel).map_err(|e| e.to_string())?;
        if !edges.insert(key) {
            return Err(format!("{field}: duplicate relation"));
        }
    }
    Ok(())
}

fn validate_resource(collection: &str, versions: &[Version]) -> Result<(), String> {
    validate_id(collection, "collection")?;
    if versions.is_empty() {
        return Err("versions must not be empty".into());
    }
    if !unique(versions.iter().map(|v| v.id.as_str())) {
        return Err("versions.id must be unique".into());
    }
    for v in versions {
        validate_version(v)?;
    }
    Ok(())
}

fn validate_members(v: &Version) -> Result<(), String> {
    for (index, m) in v.members.iter().enumerate() {
        let field = format!("versions.{}.members[{index}]", v.id);
        validate_id(&m.id, &format!("{field}.id"))?;
        reference(&m.target, true).map_err(|e| format!("{field}.target.{e}"))?;
        if !nonempty(&m.role) {
            return Err(format!("{field}.role must not be empty"));
        }
        for (index, l) in m.locations.iter().enumerate() {
            location(l).map_err(|e| format!("{field}.locations[{index}].{e}"))?;
        }
    }
    Ok(())
}

fn valid_sha(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

fn validate_target(target: &Target, field: &str) -> Result<(), String> {
    match target {
        Target::Record { record } => {
            reference(record, true).map_err(|e| format!("{field}.target.record.{e}"))?
        }
        Target::Evidence { evidence: e } => {
            evidence(e).map_err(|e| format!("{field}.target.evidence.{e}"))?
        }
        Target::Unknown { unknown } if !nonempty(unknown) => {
            return Err(format!("{field}.target.unknown empty"));
        }
        _ => {}
    }
    Ok(())
}

fn validate_order(
    rel: &Relation,
    field: &str,
    orders: &mut HashSet<(String, String, u64)>,
) -> Result<(), String> {
    if rel.kind == "input" {
        let order = rel
            .order
            .filter(|n| *n > 0)
            .ok_or_else(|| format!("{field}.order must be positive"))?;
        let locator = rel
            .evidence
            .locator
            .as_ref()
            .ok_or_else(|| format!("{field}.evidence.locator required"))?;
        if !orders.insert((rel.evidence.path.clone(), locator.clone(), order)) {
            return Err(format!("{field}.order duplicate in invocation"));
        }
    } else if rel.order.is_some() {
        return Err(format!("{field}.order only applies to input"));
    }
    Ok(())
}

fn validate_parents(v: &Version) -> Result<(), String> {
    for (index, p) in v.parents.iter().enumerate() {
        let field = format!("versions.{}.parents[{index}]", v.id);
        reference(p, false).map_err(|e| format!("{field}.{e}"))?;
        if p.member.is_some() {
            return Err(format!("{field}.member is not allowed for version parents"));
        }
    }
    Ok(())
}
