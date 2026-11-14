use super::super::{
    graph,
    model::{self, Entry, Index},
};
use serde_json::{Value, json};
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub(super) fn safe_relative(s: &str) -> bool {
    !s.is_empty()
        && !s.contains('\0')
        && !s.contains('\\')
        && !s.contains(':')
        && s.split('/').all(|p| !p.is_empty() && p != "." && p != "..")
}
pub(super) fn safe_dir(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if !safe_relative(relative) {
        return Err("resources-dir must be a workspace-relative path".into());
    }
    let mut p = root.to_path_buf();
    for part in relative.split('/') {
        p.push(part);
        let m = fs::symlink_metadata(&p).map_err(|e| format!("{}: {e}", p.display()))?;
        if !m.is_dir() || m.file_type().is_symlink() {
            return Err(format!("unsafe directory {}", p.display()));
        }
    }
    Ok(p)
}
pub(super) fn read_file(p: &Path) -> Result<Vec<u8>, String> {
    let m = fs::symlink_metadata(p).map_err(|e| format!("{}: {e}", p.display()))?;
    if !m.is_file() || m.file_type().is_symlink() {
        return Err(format!("not a regular file: {}", p.display()));
    }
    fs::read(p).map_err(|e| format!("{}: {e}", p.display()))
}
pub(super) fn scan(root: &Path, dir: &str) -> Result<(Index, Vec<(String, String)>), String> {
    let rd = safe_dir(root, &format!("{dir}/records"))?;
    let mut entries = Vec::new();
    let mut bodies = Vec::new();
    for item in fs::read_dir(&rd).map_err(|e| e.to_string())? {
        let item = item.map_err(|e| e.to_string())?;
        let name = item
            .file_name()
            .into_string()
            .map_err(|_| "non-UTF8 filename")?;
        if !name.ends_with(".md") {
            continue;
        }
        let (entry, body) = read_record(&item.path(), dir, &name)?;
        bodies.push((entry.source_path.clone(), body));
        entries.push(entry);
    }
    entries.sort_by(|a, b| a.record.id().cmp(b.record.id()));
    model::record_map(&entries)?;
    graph::build(&entries)?;
    Ok((
        Index {
            schema_version: 1,
            records: entries,
        },
        bodies,
    ))
}
pub(super) fn index_path(root: &Path, dir: &str) -> Result<PathBuf, String> {
    Ok(safe_dir(root, dir)?.join("resource-index.json"))
}
pub(super) fn load_index(root: &Path, dir: &str) -> Result<Index, String> {
    let p = index_path(root, dir)?;
    let bytes = read_file(&p)?;
    let idx: Index = serde_json::from_slice(&bytes).map_err(|e| format!("{}: {e}", p.display()))?;
    if idx.schema_version != 1 {
        return Err("unsupported index schemaVersion".into());
    }
    let mut previous: Option<&str> = None;
    let mut paths = HashSet::new();
    for e in &idx.records {
        model::validate_record(&e.record)?;
        if previous.is_some_and(|id| id >= e.record.id()) || !paths.insert(&e.source_path) {
            return Err("index records must have unique paths and sorted unique IDs".into());
        }
        previous = Some(e.record.id());
        let Some(digest) = e.source_revision.strip_prefix("sha256:") else {
            return Err("invalid sourceRevision".into());
        };
        if digest.len() != 64
            || !digest
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err("invalid sourceRevision".into());
        }
        if !safe_relative(&e.source_path)
            || !e.source_path.starts_with(&format!("{dir}/records/"))
            || e.source_path[format!("{dir}/records/").len()..].contains('/')
            || !e.source_path.ends_with(".md")
        {
            return Err("invalid index sourcePath".into());
        }
    }
    model::record_map(&idx.records)?;
    graph::build(&idx.records)?;
    Ok(idx)
}
pub(super) fn encode(idx: &Index) -> Result<Vec<u8>, String> {
    let mut b = serde_json::to_vec_pretty(idx).map_err(|e| e.to_string())?;
    b.push(b'\n');
    Ok(b)
}
pub(super) fn sync(root: &Path, dir: &str) -> Result<Value, String> {
    let (idx, _) = scan(root, dir)?;
    let path = index_path(root, dir)?;
    let bytes = encode(&idx)?;
    // Do not commit an index the normal reader cannot deserialize.
    serde_json::from_slice::<Index>(&bytes)
        .map_err(|e| format!("generated index is not readable: {e}"))?;
    let old = existing_index(&path)?;
    if old.as_deref() == Some(bytes.as_slice()) {
        return Ok(json!({"changed":false,"indexPath":path,"count":idx.records.len()}));
    }
    commit_index(&path, &bytes, old.is_some())?;
    Ok(json!({"changed":true,"indexPath":path,"count":idx.records.len()}))
}

fn read_record(p: &Path, dir: &str, name: &str) -> Result<(Entry, String), String> {
    let bytes = read_file(p)?;
    let text = std::str::from_utf8(&bytes).map_err(|e| format!("{}: {e}", p.display()))?;
    let (record, body) = model::parse(text).map_err(|e| format!("{}: {e}", p.display()))?;
    Ok((
        Entry {
            source_revision: model::fingerprint(text),
            source_path: format!("{dir}/records/{name}"),
            record,
        },
        body,
    ))
}

fn commit_index(path: &Path, bytes: &[u8], exists: bool) -> Result<(), String> {
    if exists {
        let mut tmp = tempfile::NamedTempFile::new_in(path.parent().ok_or("no parent")?)
            .map_err(|e| e.to_string())?;
        tmp.write_all(bytes).map_err(|e| e.to_string())?;
        tmp.persist(path).map_err(|e| {
            format!(
                "replace failed: {}; previous index preserved; retry sync-index",
                e.error
            )
        })?;
    } else {
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|e| format!("create index: {e}"))?;
        f.write_all(bytes).map_err(|e| {
            format!("index created but write failed: {e}; inspect and retry sync-index")
        })?;
    }
    Ok(())
}

fn existing_index(path: &Path) -> Result<Option<Vec<u8>>, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => read_file(path).map(Some),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
