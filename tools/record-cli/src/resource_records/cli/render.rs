use super::super::model::{Entry, Index, Record};
use super::args::{Args, ListView};
use std::collections::{HashMap, HashSet};
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
fn ancestors<'a>(record: &'a Record, collections: &HashMap<&str, &'a Record>) -> Vec<&'a Record> {
    let mut path = Vec::new();
    let mut seen = HashSet::new();
    let mut at = parent(record);
    while let Some(id) = at {
        if !seen.insert(id) {
            break;
        }
        let Some(record) = collections.get(id) else {
            break;
        };
        path.push(*record);
        at = parent(record);
    }
    path.reverse();
    path
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

pub(super) fn list(
    records: &[&Entry],
    idx: &Index,
    total: usize,
    args: &Args,
    view: ListView,
) -> String {
    let mut out = format!(
        "total={total} offset={} limit={} freshness=unchecked\n",
        args.offset,
        args.limit.unwrap_or(50)
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
        for entry in records {
            let path = ancestors(&entry.record, &collections);
            tree_row(&mut out, &entry.record, &path, &previous);
            previous = path.iter().map(|r| r.id()).collect();
        }
    } else {
        for entry in records {
            let _ = writeln!(out, "[match] {}", details(&entry.record));
        }
    }
    out.pop();
    out
}
