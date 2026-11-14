use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
pub struct Reference {
    pub resource: String,
    pub version: String,
    #[serde(
        default,
        deserialize_with = "non_null_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub member: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Evidence {
    pub path: String,
    #[serde(
        default,
        deserialize_with = "non_null_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub locator: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Location {
    Workspace {
        path: String,
    },
    External {
        storage: String,
        path: String,
        custody: String,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged, deny_unknown_fields)]
pub enum Target {
    Record { record: Reference },
    Evidence { evidence: Evidence },
    Unknown { unknown: String },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Relation {
    #[serde(rename = "type")]
    pub kind: String,
    pub target: Target,
    pub evidence: Evidence,
    pub scope: String,
    #[serde(
        default,
        deserialize_with = "non_null_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub order: Option<u64>,
}
fn required_optional<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Option<String>, D::Error> {
    Option::<String>::deserialize(d)
}
fn non_null_option<'de, D, T>(d: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(d).map(Some)
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct File {
    pub id: String,
    pub role: String,
    #[serde(deserialize_with = "required_optional")]
    pub sha256: Option<String>,
    pub locations: Vec<Location>,
    #[serde(
        default,
        deserialize_with = "non_null_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub gap: Option<String>,
    #[serde(
        default,
        deserialize_with = "non_null_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub specs: Option<serde_json::Map<String, Value>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub relations: Vec<Relation>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Member {
    pub id: String,
    pub target: Reference,
    pub role: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub locations: Vec<Location>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Version {
    pub id: String,
    pub files: Vec<File>,
    pub members: Vec<Member>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parents: Vec<Reference>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub slot: String,
    pub target: Reference,
    pub basis: String,
    pub scope: String,
    pub evidence: Evidence,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum Record {
    Collection {
        #[serde(rename = "schemaVersion")]
        schema_version: u32,
        id: String,
        title: String,
        #[serde(
            default,
            deserialize_with = "non_null_option",
            skip_serializing_if = "Option::is_none"
        )]
        parent: Option<String>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        tags: Vec<String>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        selections: Vec<Selection>,
    },
    Resource {
        #[serde(rename = "schemaVersion")]
        schema_version: u32,
        id: String,
        title: String,
        collection: String,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        tags: Vec<String>,
        versions: Vec<Version>,
    },
}
impl Record {
    pub fn id(&self) -> &str {
        match self {
            Self::Collection { id, .. } | Self::Resource { id, .. } => id,
        }
    }
    pub fn kind(&self) -> &str {
        match self {
            Self::Collection { .. } => "collection",
            Self::Resource { .. } => "resource",
        }
    }
    pub fn tags(&self) -> &[String] {
        match self {
            Self::Collection { tags, .. } | Self::Resource { tags, .. } => tags,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "sourceRevision")]
    pub source_revision: String,
    pub record: Record,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Index {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    pub records: Vec<Entry>,
}

pub use super::parsing::{fingerprint, parse};
pub use super::validation::validate_record;
pub fn record_map(entries: &[Entry]) -> Result<HashMap<String, &Record>, String> {
    let mut m = HashMap::new();
    for e in entries {
        if m.insert(e.record.id().to_owned(), &e.record).is_some() {
            return Err(format!("{}: duplicate id {}", e.source_path, e.record.id()));
        }
    }
    Ok(m)
}
