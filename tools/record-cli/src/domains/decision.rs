mod frontmatter;
mod graph;
mod validation;
pub use frontmatter::*;
mod body;
pub use body::*;
mod rewrite;
mod serialize;
pub use rewrite::*;
pub use serialize::serialize_document;
mod candidate_header;
mod flow;
pub use candidate_header::*;

use super::{JsTrim, Relation, is_kebab};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DecisionState {
    pub name: String,
    pub source_path: String,
    pub title: String,
    pub status: String,
    pub alignment: String,
    pub created_at: String,
    pub purpose: String,
    pub background: String,
    pub decision: String,
    pub tags: Vec<String>,
    pub relations: Vec<Relation>,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct DecisionId(String);
impl DecisionId {
    pub fn parse(value: &str) -> Result<Self, String> {
        if is_kebab(value) {
            Ok(Self(value.to_owned()))
        } else {
            Err("invalid Decision ID".into())
        }
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub struct Definition;
impl crate::index::sealed::Sealed for Definition {}
impl crate::index::DomainDefinition for Definition {
    type State = DecisionState;
    fn namespace(&self) -> &'static str {
        "decisions"
    }
    fn definition_version(&self) -> u32 {
        11
    }
    fn validate(
        &self,
        index: &mut crate::index::IndexV4<Self::State>,
    ) -> Result<(), crate::index::IndexError> {
        use super::*;
        common_index(index)?;
        let mut paths = std::collections::HashSet::new();
        for (id, s) in &mut index.entries {
            if !validation::valid_state(id, s) || !paths.insert(&s.source_path) {
                return Err(crate::index::IndexError::Domain(format!(
                    "invalid decision state: {id}"
                )));
            }
            for relation in &mut s.relations {
                if let Some(summary) = &relation.summary {
                    let normalized = summary.js_trim();
                    relation.summary = if normalized.is_empty() {
                        None
                    } else {
                        Some(normalized.to_owned())
                    };
                }
            }
        }
        Ok(())
    }
    fn graph(
        &self,
        index: &crate::index::IndexV4<Self::State>,
    ) -> Result<crate::index::RelationGraph, crate::index::IndexError> {
        graph::validate(index)
    }
}

#[cfg(test)]
#[path = "decision/tests/frontmatter.rs"]
mod frontmatter_tests;

#[cfg(test)]
#[path = "decision/tests/rewrite.rs"]
mod rewrite_tests;
