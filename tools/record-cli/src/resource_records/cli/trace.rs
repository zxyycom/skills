use super::super::{
    graph,
    model::{self, Record, Reference},
};
use super::args::Args;
use serde_json::{Value, json};
use std::collections::{HashSet, VecDeque};

pub(super) fn run(a: &Args, idx: &model::Index) -> Result<Value, String> {
    let edges = graph::build(&idx.records)?;
    let anchor = trace_anchor(a, idx)?;
    let types: Vec<&str> = if a.types.is_empty() {
        vec!["input", "preview-of", "version-parent"]
    } else {
        a.types.iter().map(String::as_str).collect()
    };
    let downstream = a.direction.as_deref() == Some("downstream");
    let resolved = edges
        .iter()
        .find(|edge| !types.contains(&"member") && edge.kind == "member" && edge.from == anchor)
        .and_then(|edge| edge.to.clone())
        .unwrap_or_else(|| anchor.clone());
    let limits = TraceLimits {
        nodes: a.nodes.unwrap_or(100),
        edges: a.edges.unwrap_or(200),
        depth: a.depth.unwrap_or(1),
    };
    let ctx = TraceContext {
        types: &types,
        anchor: &anchor,
        resolved: &resolved,
        downstream,
        limits,
    };
    let walked = walk_trace(&edges, &ctx);
    let found = walked.edges;
    let truncated = walked.truncated;
    let nodes = walked.nodes;
    let max_nodes = limits.nodes;
    let max_edges = limits.edges;
    let depth = limits.depth;
    let terminals = found.iter().filter(|e| e.terminal.is_some()).count();
    Ok(
        json!({"anchor":anchor,"resolvedAnchor":resolved,"direction":if downstream{"downstream"}else{"upstream"},"edges":found,"nodes":nodes,"truncated":truncated,"unexpandedTerminals":terminals,"freshness":"unchecked","limits":{"depth":depth,"nodes":max_nodes,"edges":max_edges}}),
    )
}

fn trace_anchor(a: &Args, idx: &model::Index) -> Result<String, String> {
    let id = &a.positionals[0];
    let entry = idx
        .records
        .iter()
        .find(|e| e.record.id() == id)
        .ok_or("record not found")?;
    let anchor = if let Some(v) = &a.version {
        graph::key(&Reference {
            resource: id.clone(),
            version: v.clone(),
            member: a.member.clone(),
        })
    } else {
        id.clone()
    };
    if let Some(v) = &a.version {
        match &entry.record {
            Record::Resource { versions, .. } => {
                let ver = versions
                    .iter()
                    .find(|x| &x.id == v)
                    .ok_or("version not found")?;
                if let Some(m) = &a.member
                    && !ver.files.iter().any(|x| &x.id == m)
                    && !ver.members.iter().any(|x| &x.id == m)
                {
                    return Err("member not found".into());
                }
            }
            _ => return Err("collection has no versions".into()),
        }
    }
    Ok(anchor)
}

#[derive(Clone, Copy)]
struct TraceLimits {
    nodes: usize,
    edges: usize,
    depth: usize,
}
struct TraceResult<'a> {
    edges: Vec<&'a graph::Edge>,
    nodes: usize,
    truncated: bool,
}
struct TraceContext<'a> {
    types: &'a [&'a str],
    anchor: &'a str,
    resolved: &'a str,
    downstream: bool,
    limits: TraceLimits,
}
fn trace_next(edge: &graph::Edge, node: &str, ctx: &TraceContext<'_>) -> Option<Option<String>> {
    if !ctx.types.contains(&edge.kind.as_str()) {
        return None;
    }
    let edge_node = if node == ctx.anchor
        && matches!(edge.kind.as_str(), "input" | "preview-of" | "reference")
    {
        ctx.resolved
    } else {
        node
    };
    if ctx.downstream {
        (edge.to.as_deref() == Some(edge_node)).then(|| Some(edge.from.clone()))
    } else {
        (edge.from == edge_node).then(|| edge.to.clone())
    }
}
fn walk_trace<'a>(edges: &'a [graph::Edge], ctx: &TraceContext<'_>) -> TraceResult<'a> {
    let mut visited = HashSet::from([ctx.anchor.to_string()]);
    let mut queue = VecDeque::from([(ctx.anchor.to_string(), 0usize)]);
    let mut found = Vec::new();
    let mut truncated = false;
    while let Some((node, depth)) = queue.pop_front() {
        for edge in edges {
            let Some(next) = trace_next(edge, &node, ctx) else {
                continue;
            };
            if depth >= ctx.limits.depth || found.len() >= ctx.limits.edges {
                truncated = true;
                continue;
            }
            if let Some(next) = next
                && !visited.contains(&next)
            {
                if visited.len() >= ctx.limits.nodes {
                    truncated = true;
                    continue;
                }
                visited.insert(next.clone());
                queue.push_back((next, depth + 1));
            }
            found.push(edge);
        }
    }
    TraceResult {
        edges: found,
        nodes: visited.len(),
        truncated,
    }
}
