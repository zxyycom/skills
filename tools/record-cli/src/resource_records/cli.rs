use super::model::{self, Record};
use serde_json::{Value, json};
use std::{fs, path::Path};
mod args;
mod entry;
mod storage;
mod trace;
use args::Args;
pub use entry::main_entry;
use storage::{encode, load_index, read_file, safe_dir, scan, sync};

fn run(a: &Args) -> Result<Value, String> {
    let root = fs::canonicalize(a.root.as_deref().unwrap_or(".")).map_err(|e| e.to_string())?;
    let dir = a.dir.as_deref().unwrap_or("resources");
    match a.command.as_str() {
        "sync-index" => return sync(&root, dir),
        "check" => return check(&root, dir),
        _ => {}
    }
    query(a, &root, dir)
}

fn query(a: &Args, root: &Path, dir: &str) -> Result<Value, String> {
    if a.command == "search" && !a.metadata {
        return search_body(a, root, dir);
    }
    let idx = load_index(root, dir)?;
    match a.command.as_str() {
        "list" => list(a, &idx),
        "show" => show(a, &idx, root, dir),
        "search" => search_metadata(a, &idx),
        "trace" => trace::run(a, &idx),
        _ => Err("unsupported command".into()),
    }
}

fn search_body(a: &Args, root: &Path, dir: &str) -> Result<Value, String> {
    let (idx, bodies) = scan(root, dir)?;
    let q = &a.positionals[0];
    let mut hits = Vec::new();
    for e in &idx.records {
        let body = &bodies
            .iter()
            .find(|(p, _)| p == &e.source_path)
            .ok_or("body missing")?
            .1;
        if q.contains('\n') || q.contains('\r') {
            for (offset, matched) in body.match_indices(q) {
                let line = body[..offset].bytes().filter(|b| *b == b'\n').count() + 1;
                hits.push(json!({"id":e.record.id(),"sourcePath":e.source_path,"field":"body","line":line,"text":matched}));
            }
            continue;
        }
        for (n, line) in body.lines().enumerate() {
            if line.contains(q) {
                hits.push(json!({"id":e.record.id(),"sourcePath":e.source_path,"field":"body","line":n+1,"text":line}));
            }
        }
    }
    let total = hits.len();
    let hits: Vec<_> = hits
        .into_iter()
        .skip(a.offset)
        .take(a.limit.unwrap_or(50))
        .collect();
    Ok(
        json!({"hits":hits,"total":total,"offset":a.offset,"limit":a.limit.unwrap_or(50),"source":"current-files","coverage":"all-record-bodies"}),
    )
}

fn list(a: &Args, idx: &model::Index) -> Result<Value, String> {
    let mut out = Vec::new();
    for e in &idx.records {
        let r = &e.record;
        if a.kind.as_ref().is_some_and(|k| k != r.kind())
            || a.tags.iter().any(|t| !r.tags().contains(t))
        {
            continue;
        }
        if !in_collection(r, idx, a.collection.as_deref(), a.descendants) {
            continue;
        }
        if let Some(slot) = &a.slot
            && !matches!(r,Record::Collection{selections,..} if selections.iter().any(|s|&s.slot==slot))
        {
            continue;
        }
        out.push(e);
    }
    let total = out.len();
    let records: Vec<_> = out
        .into_iter()
        .skip(a.offset)
        .take(a.limit.unwrap_or(50))
        .collect();
    Ok(
        json!({"records":records,"total":total,"offset":a.offset,"limit":a.limit.unwrap_or(50),"freshness":"unchecked"}),
    )
}

fn show(a: &Args, idx: &model::Index, root: &Path, dir: &str) -> Result<Value, String> {
    let e = idx
        .records
        .iter()
        .find(|e| e.record.id() == a.positionals[0])
        .ok_or("record not found")?;
    let path = root.join(&e.source_path);
    let records_dir = safe_dir(root, &format!("{dir}/records"))?;
    if path.parent() != Some(records_dir.as_path()) {
        return Err("unsafe source path".into());
    }
    let bytes = read_file(&path)?;
    let text = std::str::from_utf8(&bytes).map_err(|e| e.to_string())?;
    let (record, body) = model::parse(text)?;
    if record.id() != e.record.id() {
        return Err("current source ID does not match index".into());
    }
    let selected = selected_part(&record, a)?;
    Ok(
        json!({"record":record,"body":body,"selected":selected,"sourcePath":e.source_path,"freshness":if model::fingerprint(text)==e.source_revision{"current"}else{"stale"}}),
    )
}

fn search_metadata(a: &Args, idx: &model::Index) -> Result<Value, String> {
    let q = &a.positionals[0];
    let mut hits = Vec::new();
    for e in &idx.records {
        let value = serde_json::to_value(&e.record).map_err(|e| e.to_string())?;
        fn walk(v: &Value, p: &str, q: &str, out: &mut Vec<String>) {
            match v {
                Value::String(s) if s.contains(q) => out.push(p.to_string()),
                Value::Array(a) => {
                    for (i, x) in a.iter().enumerate() {
                        walk(x, &format!("{p}[{i}]"), q, out)
                    }
                }
                Value::Object(m) => {
                    for (k, x) in m {
                        walk(x, &format!("{p}.{k}"), q, out)
                    }
                }
                _ => {}
            }
        }
        let mut fields = Vec::new();
        walk(&value, "record", q, &mut fields);
        if !fields.is_empty() {
            hits.push(json!({"id":e.record.id(),"fields":fields}));
        }
    }
    let total = hits.len();
    let hits: Vec<_> = hits
        .into_iter()
        .skip(a.offset)
        .take(a.limit.unwrap_or(50))
        .collect();
    Ok(
        json!({"hits":hits,"total":total,"offset":a.offset,"limit":a.limit.unwrap_or(50),"freshness":"unchecked","source":"index","coverage":"metadata"}),
    )
}

fn check(root: &Path, dir: &str) -> Result<Value, String> {
    let (current, _) = scan(root, dir)?;
    let idx = load_index(root, dir)?;
    if encode(&current)? != encode(&idx)? {
        return Err("index stale; run sync-index".into());
    }
    Ok(json!({"valid":true,"count":current.records.len(),"freshness":"current"}))
}

fn in_collection(
    r: &Record,
    idx: &model::Index,
    collection: Option<&str>,
    descendants: bool,
) -> bool {
    let Some(c) = collection else {
        return true;
    };
    let mut at = match r {
        Record::Collection { id, .. } => id.as_str(),
        Record::Resource { collection, .. } => collection.as_str(),
    };
    loop {
        if at == c {
            return true;
        }
        if !descendants {
            return false;
        }
        let Some(parent) = idx.records.iter().find_map(|x| match &x.record {
            Record::Collection { id, parent, .. } if id == at => parent.as_deref(),
            _ => None,
        }) else {
            return false;
        };
        at = parent;
    }
}

fn selected_part(record: &Record, a: &Args) -> Result<Value, String> {
    Ok(if let Some(v) = &a.version {
        match record {
            Record::Resource { versions, .. } => {
                let version = versions
                    .iter()
                    .find(|x| &x.id == v)
                    .ok_or("version not found")?;
                if let Some(m) = &a.member {
                    if let Some(f) = version.files.iter().find(|x| &x.id == m) {
                        json!({"file":f})
                    } else if let Some(x) = version.members.iter().find(|x| &x.id == m) {
                        json!({"member":x})
                    } else {
                        return Err("member not found".into());
                    }
                } else {
                    json!({"version":version})
                }
            }
            _ => return Err("collection has no versions".into()),
        }
    } else {
        json!({})
    })
}
