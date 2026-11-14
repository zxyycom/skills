use super::model::{Entry, Record, Reference, Target, record_map};
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Serialize)]
pub struct Edge {
    pub from: String,
    pub to: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    pub evidence: Option<Value>,
    pub terminal: Option<Value>,
}
pub fn version_key(r: &str, v: &str) -> String {
    format!("{r}@{v}")
}
pub fn file_key(r: &str, v: &str, m: &str) -> String {
    format!("{r}@{v}#{m}")
}
pub fn key(r: &Reference) -> String {
    match &r.member {
        Some(m) => file_key(&r.resource, &r.version, m),
        None => version_key(&r.resource, &r.version),
    }
}
fn cycle(edges: &[Edge], types: &[&str]) -> bool {
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();
    for e in edges {
        if types.contains(&e.kind.as_str())
            && let Some(t) = &e.to
        {
            adj.entry(&e.from).or_default().push(t);
        }
    }
    // Kahn's algorithm keeps traversal state on the heap, even for very long chains.
    let mut indegree: HashMap<&str, usize> = HashMap::new();
    for (from, targets) in &adj {
        indegree.entry(from).or_default();
        for target in targets {
            *indegree.entry(target).or_default() += 1;
        }
    }
    let mut ready: Vec<&str> = indegree
        .iter()
        .filter_map(|(&n, &d)| (d == 0).then_some(n))
        .collect();
    let mut processed = 0;
    while let Some(n) = ready.pop() {
        processed += 1;
        if let Some(targets) = adj.get(n) {
            for target in targets {
                let degree = indegree.get_mut(target).expect("edge target exists");
                *degree -= 1;
                if *degree == 0 {
                    ready.push(target);
                }
            }
        }
    }
    processed != indegree.len()
}
struct GraphBuilder<'a> {
    records: HashMap<String, &'a Record>,
    parents: HashMap<String, String>,
    nodes: HashSet<String>,
    files: HashSet<String>,
    aliases: HashMap<String, String>,
    edges: Vec<Edge>,
}
impl<'a> GraphBuilder<'a> {
    fn new(entries: &'a [Entry]) -> Result<Self, String> {
        Ok(Self {
            records: record_map(entries)?,
            parents: HashMap::new(),
            nodes: HashSet::new(),
            files: HashSet::new(),
            aliases: HashMap::new(),
            edges: Vec::new(),
        })
    }
    fn add_edge(&mut self, from: String, to: String, kind: &str) {
        self.edges.push(Edge {
            from,
            to: Some(to),
            kind: kind.into(),
            evidence: None,
            terminal: None,
        });
    }
    fn index_entry(&mut self, e: &Entry) -> Result<(), String> {
        self.nodes.insert(e.record.id().to_string());
        match &e.record {
            Record::Collection { id, parent, .. } => {
                self.index_collection(e, id, parent.as_deref())
            }
            Record::Resource {
                id,
                collection,
                versions,
                ..
            } => self.index_resource(e, id, collection, versions),
        }
    }
    fn index_collection(
        &mut self,
        e: &Entry,
        id: &str,
        parent: Option<&str>,
    ) -> Result<(), String> {
        if let Some(p) = parent {
            if !matches!(self.records.get(p), Some(Record::Collection { .. })) {
                return Err(format!("{}: parent {p} is not a collection", e.source_path));
            }
            self.parents.insert(id.into(), p.into());
            self.add_edge(id.into(), p.into(), "parent");
        }
        Ok(())
    }
    fn index_resource(
        &mut self,
        e: &Entry,
        id: &str,
        collection: &str,
        versions: &[super::model::Version],
    ) -> Result<(), String> {
        if !matches!(
            self.records.get(collection),
            Some(Record::Collection { .. })
        ) {
            return Err(format!(
                "{}: collection {collection} missing",
                e.source_path
            ));
        }
        self.add_edge(id.into(), collection.into(), "collection");
        for v in versions {
            self.nodes.insert(version_key(id, &v.id));
            for f in &v.files {
                let k = file_key(id, &v.id, &f.id);
                self.nodes.insert(k.clone());
                self.files.insert(k);
            }
            for m in &v.members {
                let k = file_key(id, &v.id, &m.id);
                self.nodes.insert(k.clone());
                self.aliases.insert(k, key(&m.target));
            }
        }
        Ok(())
    }
    fn add_selection(
        &mut self,
        e: &Entry,
        id: &str,
        selection: &super::model::Selection,
    ) -> Result<(), String> {
        let target = key(&selection.target);
        if !self.nodes.contains(&target) {
            return Err(format!(
                "{}: selections.{} target missing",
                e.source_path, selection.slot
            ));
        }
        let target_record = self
            .records
            .get(&selection.target.resource)
            .ok_or("selection resource missing")?;
        let mut c = match target_record {
            Record::Resource { collection, .. } => collection.as_str(),
            _ => return Err("selection must target a resource".into()),
        };
        while c != id {
            c = self
                .parents
                .get(c)
                .ok_or_else(|| format!("{}: selection outside collection", e.source_path))?;
        }
        self.edges.push(Edge { from: id.into(), to: Some(target), kind: "selection".into(), evidence: Some(json!({"slot":selection.slot,"basis":selection.basis,"scope":selection.scope,"evidence":selection.evidence})), terminal: None });
        Ok(())
    }
    fn add_version(
        &mut self,
        e: &Entry,
        id: &str,
        v: &super::model::Version,
    ) -> Result<(), String> {
        let vk = version_key(id, &v.id);
        for parent in &v.parents {
            let pk = key(parent);
            if !self.nodes.contains(&pk) {
                return Err(format!(
                    "{}: versions.{}.parents target missing",
                    e.source_path, v.id
                ));
            }
            self.add_edge(vk.clone(), pk, "version-parent");
        }
        for member in &v.members {
            let to = key(&member.target);
            if !self.files.contains(&to) {
                return Err(format!(
                    "{}: member {} must target an owned file",
                    e.source_path, member.id
                ));
            }
            self.add_edge(file_key(id, &v.id, &member.id), to, "member");
        }
        for f in &v.files {
            self.add_file_relations(e, id, v, f)?;
        }
        Ok(())
    }
    fn add_file_relations(
        &mut self,
        e: &Entry,
        id: &str,
        v: &super::model::Version,
        f: &super::model::File,
    ) -> Result<(), String> {
        let from = file_key(id, &v.id, &f.id);
        for rel in &f.relations {
            let (to, terminal) = match &rel.target {
                Target::Record { record } => {
                    let raw = key(record);
                    let resolved = self.aliases.get(&raw).unwrap_or(&raw);
                    if !self.files.contains(resolved) {
                        return Err(format!(
                            "{}: versions.{}.files.{}.relations target missing",
                            e.source_path, v.id, f.id
                        ));
                    }
                    (Some(resolved.clone()), None)
                }
                Target::Evidence { evidence } => (None, Some(json!({"evidence":evidence}))),
                Target::Unknown { unknown } => (None, Some(json!({"unknown":unknown}))),
            };
            self.edges.push(Edge { from: from.clone(), to, kind: rel.kind.clone(), evidence: Some(json!({"evidence":rel.evidence,"scope":rel.scope,"order":rel.order,"target":rel.target})), terminal });
        }
        Ok(())
    }
    fn add_entry_relations(&mut self, e: &Entry) -> Result<(), String> {
        match &e.record {
            Record::Collection { id, selections, .. } => {
                for selection in selections {
                    self.add_selection(e, id, selection)?;
                }
            }
            Record::Resource { id, versions, .. } => {
                for version in versions {
                    self.add_version(e, id, version)?;
                }
            }
        }
        Ok(())
    }
}
pub fn build(entries: &[Entry]) -> Result<Vec<Edge>, String> {
    let mut graph = GraphBuilder::new(entries)?;
    for e in entries {
        graph.index_entry(e)?;
    }
    if cycle(&graph.edges, &["parent"]) {
        return Err("collection parent cycle".into());
    }
    for e in entries {
        graph.add_entry_relations(e)?;
    }
    if cycle(&graph.edges, &["version-parent"]) {
        return Err("version parents cycle".into());
    }
    if cycle(&graph.edges, &["input", "preview-of"]) {
        return Err("file dependency cycle".into());
    }
    Ok(graph.edges)
}
