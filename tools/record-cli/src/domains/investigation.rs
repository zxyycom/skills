mod graph;
mod resource_id;
mod validation;
pub use resource_id::valid_resource_id;
mod frontmatter;
pub use frontmatter::*;
mod body;
pub use body::*;
mod document;
pub(crate) use document::parse_candidate_assessed;
pub use document::*;
mod resource_owner;
pub use resource_owner::*;
mod candidate_header;
pub use candidate_header::*;

use super::{JsTrim, Relation, is_kebab};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InvestigationState {
    pub formed_at: String,
    pub name: String,
    pub question: String,
    pub relations: Vec<Relation>,
    pub resource_ids: Vec<String>,
    pub source_path: String,
    pub tags: Vec<String>,
    pub title: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct InvestigationId(String);
impl InvestigationId {
    pub fn parse(value: &str) -> Result<Self, String> {
        if is_kebab(value) {
            Ok(Self(value.to_owned()))
        } else {
            Err("invalid Investigation ID".into())
        }
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

pub struct Definition;
impl crate::index::sealed::Sealed for Definition {}
impl crate::index::DomainDefinition for Definition {
    type State = InvestigationState;
    fn namespace(&self) -> &'static str {
        "investigations"
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
        for (id, state) in &index.entries {
            if !validation::valid_state(id, state) || !paths.insert(&state.source_path) {
                return Err(crate::index::IndexError::Domain(format!(
                    "invalid investigation state: {id}"
                )));
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
#[path = "investigation/tests/frontmatter.rs"]
mod frontmatter_tests;
