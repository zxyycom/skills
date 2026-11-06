//! V4 snapshot structures. Deserialization alone does not establish validation.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Revision {
    pub metadata: String,
    pub entries: BTreeMap<String, String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct IndexV4<S> {
    pub schema_version: u32,
    pub namespace: String,
    pub definition_version: u32,
    pub metadata: serde_json::Value,
    pub source_revision: Revision,
    pub entries: BTreeMap<String, S>,
}
/// The constructor is deliberately private; domain validation is mandatory.
#[derive(Clone, Debug)]
pub struct ValidatedIndex<S>(IndexV4<S>);
impl<S> ValidatedIndex<S> {
    pub fn index(&self) -> &IndexV4<S> {
        &self.0
    }
}

#[derive(Debug)]
pub enum IndexError {
    Encoding,
    UnsupportedSurrogate,
    Json(String),
    Schema(String),
    Domain(String),
}
impl std::fmt::Display for IndexError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for IndexError {}

/// Implementations own all domain ID, state, query field and collection checks.
pub(crate) mod sealed {
    pub trait Sealed {}
}
pub trait DomainDefinition: sealed::Sealed {
    type State: for<'de> Deserialize<'de> + Serialize;
    fn namespace(&self) -> &'static str;
    fn definition_version(&self) -> u32;
    fn validate(&self, index: &mut IndexV4<Self::State>) -> Result<(), IndexError>;
    fn graph(&self, _index: &IndexV4<Self::State>) -> Result<RelationGraph, IndexError> {
        Err(IndexError::Domain(
            "domain graph validation is not implemented".into(),
        ))
    }
}
pub fn parse_index<D: DomainDefinition>(
    bytes: &[u8],
    domain: &D,
) -> Result<ValidatedIndex<D::State>, IndexError> {
    let text = std::str::from_utf8(bytes).map_err(|_| IndexError::Encoding)?;
    if has_unpaired_json_surrogate(text) {
        return Err(IndexError::UnsupportedSurrogate);
    }
    // JSON.parse semantics keep the last occurrence of duplicate object members.
    // Deserialize through Value so serde's struct duplicate-field rejection does not
    // silently strengthen the on-disk contract.
    let value: serde_json::Value =
        serde_json::from_str(text).map_err(|e| IndexError::Json(e.to_string()))?;
    let index: IndexV4<D::State> =
        serde_json::from_value(value).map_err(|e| IndexError::Json(e.to_string()))?;
    build_index(index, domain)
}
/// Detect only JSON string escape sequences, not literal `\\u` text.
/// JSON syntax errors remain the JSON parser's responsibility.
pub fn has_unpaired_json_surrogate(text: &str) -> bool {
    fn unit(bytes: &[u8], offset: usize) -> Option<u16> {
        let digits = bytes.get(offset..offset + 4)?;
        let mut result = 0u16;
        for byte in digits {
            result = (result << 4) | (*byte as char).to_digit(16)? as u16;
        }
        Some(result)
    }
    let bytes = text.as_bytes();
    let mut i = 0usize;
    let mut quoted = false;
    while i < bytes.len() {
        match bytes[i] {
            b'"' => {
                quoted = !quoted;
                i += 1;
            }
            b'\\' if quoted => {
                if bytes.get(i + 1) != Some(&b'u') {
                    i = i.saturating_add(2);
                    continue;
                }
                let Some(value) = unit(bytes, i + 2) else {
                    i = i.saturating_add(2);
                    continue;
                };
                i += 6;
                if (0xd800..=0xdbff).contains(&value) {
                    if bytes.get(i..i + 2) != Some(b"\\u")
                        || !unit(bytes, i + 2).is_some_and(|low| (0xdc00..=0xdfff).contains(&low))
                    {
                        return true;
                    }
                    i += 6;
                } else if (0xdc00..=0xdfff).contains(&value) {
                    return true;
                }
            }
            _ => i += 1,
        }
    }
    false
}

pub fn build_index<D: DomainDefinition>(
    mut index: IndexV4<D::State>,
    domain: &D,
) -> Result<ValidatedIndex<D::State>, IndexError> {
    if index.schema_version != 4
        || index.namespace != domain.namespace()
        || index.definition_version != domain.definition_version()
    {
        return Err(IndexError::Schema(
            "index schema or definition identity does not match".into(),
        ));
    }
    if index
        .entries
        .keys()
        .ne(index.source_revision.entries.keys())
    {
        return Err(IndexError::Schema("index and revision IDs differ".into()));
    }
    domain.validate(&mut index)?;
    Ok(ValidatedIndex(index))
}
/// A stage-local snapshot. Constructing a new stage requires a new verified read.
pub struct QuerySnapshot<S> {
    index: ValidatedIndex<S>,
    graph: std::sync::OnceLock<Result<RelationGraph, String>>,
}
impl<S> QuerySnapshot<S> {
    pub fn new(index: ValidatedIndex<S>) -> Self {
        Self {
            index,
            graph: std::sync::OnceLock::new(),
        }
    }
    pub fn get(&self, id: &str) -> Option<&S> {
        self.index.0.entries.get(id)
    }
    pub fn all(&self) -> impl Iterator<Item = (&str, &S)> {
        self.index
            .0
            .entries
            .iter()
            .map(|(id, state)| (id.as_str(), state))
    }
    pub fn index(&self) -> &ValidatedIndex<S> {
        &self.index
    }
    pub fn graph<D: DomainDefinition<State = S>>(
        &self,
        domain: &D,
    ) -> Result<&RelationGraph, IndexError> {
        match self.graph.get_or_init(|| {
            domain
                .graph(&self.index.0)
                .map_err(|error| error.to_string())
        }) {
            Ok(graph) => Ok(graph),
            Err(message) => Err(IndexError::Domain(message.clone())),
        }
    }
}
#[derive(Clone, Debug)]
pub struct RelationEdge {
    pub source: String,
    pub target: String,
    pub relation_type: String,
    pub summary: Option<String>,
}
#[derive(Clone, Debug)]
pub struct RelationGraph {
    pub(crate) nodes: Vec<String>,
    pub(crate) outgoing: BTreeMap<String, Vec<RelationEdge>>,
    pub(crate) incoming: BTreeMap<String, Vec<RelationEdge>>,
}
impl RelationGraph {
    pub fn nodes(&self) -> impl Iterator<Item = &str> {
        self.nodes.iter().map(String::as_str)
    }
    pub fn outgoing(&self, id: &str) -> &[RelationEdge] {
        self.outgoing.get(id).map(Vec::as_slice).unwrap_or(&[])
    }
    pub fn incoming(&self, id: &str) -> &[RelationEdge] {
        self.incoming.get(id).map(Vec::as_slice).unwrap_or(&[])
    }
}

fn js_array_index(key: &str) -> Option<u32> {
    if key.is_empty()
        || (key.len() > 1 && key.starts_with('0'))
        || !key.bytes().all(|b| b.is_ascii_digit())
    {
        return None;
    }
    let index = key.parse::<u32>().ok()?;
    (index != u32::MAX).then_some(index)
}
fn compare_js_keys(a: &str, b: &str) -> std::cmp::Ordering {
    match (js_array_index(a), js_array_index(b)) {
        (Some(a), Some(b)) => a.cmp(&b),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.encode_utf16().cmp(b.encode_utf16()),
    }
}
fn canonical_value(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Array(values) => {
            serde_json::Value::Array(values.into_iter().map(canonical_value).collect())
        }
        serde_json::Value::Object(map) => {
            let mut members: Vec<_> = map.into_iter().collect();
            members.sort_by(|(a, _), (b, _)| compare_js_keys(a, b));
            serde_json::Value::Object(
                members
                    .into_iter()
                    .map(|(key, value)| (key, canonical_value(value)))
                    .collect(),
            )
        }
        other => other,
    }
}
/// Serializes a validated state-only index with the established v4 key ordering.
/// Canonical byte equivalence is subject to domain fixture verification.
pub fn serialize_index<D: DomainDefinition>(
    index: &ValidatedIndex<D::State>,
    domain: &D,
) -> Result<Vec<u8>, IndexError> {
    let mut value = serde_json::to_value(&index.0).map_err(|e| IndexError::Json(e.to_string()))?;
    if domain.namespace() != "decisions" {
        value = canonical_value(value);
    } else if let serde_json::Value::Object(object) = &mut value {
        // The decision definition owns field order, but record-keyed collections
        // still use the shared UTF-16/JavaScript enumeration ordering.
        if let Some(serde_json::Value::Object(map)) = object.get_mut("entries") {
            let mut members: Vec<_> = std::mem::take(map).into_iter().collect();
            members.sort_by(|(a, _), (b, _)| compare_js_keys(a, b));
            *map = members.into_iter().collect();
        }
        if let Some(revision) = object.get_mut("sourceRevision") {
            *revision = canonical_value(std::mem::take(revision));
        }
        if let Some(metadata) = object.get_mut("metadata") {
            *metadata = canonical_value(std::mem::take(metadata));
        }
    }
    let mut result =
        serde_json::to_vec_pretty(&value).map_err(|e| IndexError::Json(e.to_string()))?;
    result.push(b'\n');
    Ok(result)
}

#[cfg(test)]
mod boundary_tests {
    use super::*;
    #[test]
    fn index_rejects_unpaired_surrogate_without_rejecting_emoji_or_literal_escape() {
        let hash = format!("sha256:{}", "a".repeat(64));
        let value = serde_json::json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":hash,"entries":{"240229-report":hash}},"entries":{"240229-report":{"formedAt":"2024-02-29T00:00:00Z","name":"report","question":"Question","relations":[],"resourceIds":[],"sourcePath":"report.md","tags":["test"],"title":"MARKER"}}});
        let original = serde_json::to_string(&value).unwrap();
        let bad = original.replace("\"MARKER\"", r#""\ud800""#);
        assert!(matches!(
            parse_index(bad.as_bytes(), &crate::domains::investigation::Definition),
            Err(IndexError::UnsupportedSurrogate)
        ));
        let emoji = original.replace("\"MARKER\"", r#""\ud83d\ude00""#);
        assert!(parse_index(emoji.as_bytes(), &crate::domains::investigation::Definition).is_ok());
        assert!(!has_unpaired_json_surrogate(r#"{"text":"\\ud800"}"#));
        assert!(has_unpaired_json_surrogate(r#"{"text":"\udc00"}"#));
    }
}
