use super::super::model::{Index, Record};
use super::{ListPage, args::ListView};
use std::collections::HashMap;
use std::fmt::Write;

fn details(record: &Record) -> String {
    match record {
        Record::Collection {
            id, title, parent, ..
        } => {
            let mut out = format!(
                "collection {id} title={}",
                serde_json::to_string(title).unwrap()
            );
            if let Some(parent) = parent {
                let _ = write!(out, " parent={parent}");
            }
            out
        }
        Record::Resource {
            id,
            title,
            collection,
            versions,
            ..
        } => format!(
            "resource {id} title={} collection={collection} versions={}",
            serde_json::to_string(title).unwrap(),
            versions.len()
        ),
    }
}
fn parent(record: &Record) -> Option<&str> {
    match record {
        Record::Collection { parent, .. } => parent.as_deref(),
        Record::Resource { collection, .. } => Some(collection),
    }
}
fn ancestors<'a>(
    record: &'a Record,
    collections: &HashMap<&str, &'a Record>,
) -> Result<Vec<&'a Record>, String> {
    let mut path = Vec::new();
    let mut at = parent(record);
    while let Some(id) = at {
        let record = *collections
            .get(id)
            .ok_or_else(|| format!("list tree: missing ancestor collection {id}"))?;
        // The index validates ancestry at load time; never render a partial path
        // if that invariant is broken.
        if path.len() == collections.len() {
            return Err(format!("list tree: ancestor cycle for collection {id}"));
        }
        path.push(record);
        at = parent(record);
    }
    path.reverse();
    Ok(path)
}

fn tree_row(out: &mut String, record: &Record, path: &[&Record], previous: &[&str]) {
    let common = path
        .iter()
        .zip(previous)
        .take_while(|(r, id)| r.id() == **id)
        .count();
    for (depth, ancestor) in path.iter().enumerate().skip(common) {
        let _ = writeln!(
            out,
            "{}[context depth={depth}] {}",
            "  ".repeat(depth.min(40)),
            details(ancestor)
        );
    }
    let depth = path.len();
    let _ = writeln!(
        out,
        "{}[match depth={depth}] {}",
        "  ".repeat(depth.min(40)),
        details(record)
    );
}

pub(super) fn list(page: &ListPage<'_>, idx: &Index, view: ListView) -> Result<String, String> {
    let mut out = format!(
        "total={} offset={} limit={} freshness={}\n",
        page.total, page.offset, page.limit, page.freshness
    );
    if matches!(view, ListView::Tree) {
        let collections: HashMap<_, _> = idx
            .records
            .iter()
            .filter_map(|e| match &e.record {
                Record::Collection { id, .. } => Some((id.as_str(), &e.record)),
                _ => None,
            })
            .collect();
        let mut previous: Vec<&str> = Vec::new();
        for entry in &page.records {
            let path = ancestors(&entry.record, &collections)?;
            tree_row(&mut out, &entry.record, &path, &previous);
            previous = path.iter().map(|r| r.id()).collect();
        }
    } else {
        for entry in &page.records {
            let _ = writeln!(out, "[match] {}", details(&entry.record));
        }
    }
    out.pop();
    Ok(out)
}
