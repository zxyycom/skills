//! Candidate creation and transaction planning. Publication is a separate transaction.
use super::{
    candidate::{self, CandidateIdentity, Domain},
    contract::{Alignment, DecisionRelationKind, InvestigationRelationKind, Relation},
};
use crate::{
    domains::{self, Relation as DomainRelation},
    queries::candidate_discovery,
    source::{self, ExpectedFile, RelativePath, Root},
    transaction::{CommitPoint, Plan, ResourceIntent, TransactionOperation, TxError, WriteIntent},
};
use std::collections::HashSet;

#[derive(Clone, Debug)]
pub enum NewInput {
    Decision {
        title: String,
        purpose: String,
        background: String,
        decision: String,
        tags: Vec<String>,
        relations: Vec<Relation<DecisionRelationKind>>,
        preflight_alignment: Option<Alignment>,
    },
    Investigation {
        title: String,
        question: String,
        tags: Vec<String>,
        relations: Vec<Relation<InvestigationRelationKind>>,
        formed_at: Option<String>,
    },
}
#[derive(Debug)]
pub struct NewOperation {
    pub collection: RelativePath,
    pub id: String,
    pub input: NewInput,
    pub timestamp: String,
}
pub struct PreparedNew {
    pub id: String,
    pub source_path: String,
    pub scaffold_valid: bool,
    pub body_ready: bool,
    pub resource_ready: Option<bool>,
    pub warnings: Vec<String>,
}
struct ParentPreparation {
    resources: Vec<ResourceIntent>,
}

fn sorted_tags(tags: &[String]) -> Vec<String> {
    let mut tags = tags.to_vec();
    tags.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    tags
}
fn err(code: &str, message: impl ToString) -> TxError {
    TxError::new(code, message.to_string())
}
fn canonical_id(selector: String, formed: &str) -> Result<String, TxError> {
    let parsed =
        time::OffsetDateTime::parse(formed, &time::format_description::well_known::Rfc3339)
            .map_err(|e| err("invalid-time", e))?
            .to_offset(time::UtcOffset::UTC);
    if !domains::valid_timestamp(formed) {
        return Err(err(
            "invalid-time",
            "timestamp must include seconds and timezone",
        ));
    }
    if !domains::is_kebab(&selector) {
        return Err(err("invalid-id", "name must be lowercase kebab-case"));
    }
    let date = format!(
        "{:02}{:02}{:02}",
        parsed.year() % 100,
        u8::from(parsed.month()),
        parsed.day()
    );
    let id = if domains::name_from_id(&selector) != selector {
        if !selector.starts_with(&format!("{date}-")) {
            return Err(err(
                "date-mismatch",
                "ID date must match UTC formation date",
            ));
        }
        selector
    } else {
        format!("{date}-{selector}")
    };
    Ok(id)
}

impl NewOperation {
    /// Captures the default clock once, before any transaction phase.
    pub fn new(
        collection: RelativePath,
        selector: String,
        input: NewInput,
    ) -> Result<Self, TxError> {
        let now = time::OffsetDateTime::now_utc()
            .replace_nanosecond(0)
            .map_err(|e| err("clock", e))?;
        let timestamp = now
            .format(&time::format_description::well_known::Rfc3339)
            .map_err(|e| err("clock", e))?;
        Self::at(collection, selector, input, timestamp)
    }
    pub fn at(
        collection: RelativePath,
        selector: String,
        input: NewInput,
        timestamp: String,
    ) -> Result<Self, TxError> {
        let formed = match &input {
            NewInput::Investigation {
                formed_at: Some(value),
                ..
            } => value,
            _ => &timestamp,
        };
        let id = canonical_id(selector, formed)?;
        Ok(Self {
            collection,
            id,
            input,
            timestamp,
        })
    }
    fn prepare_content(&self, root: &Root) -> Result<CandidateContent, TxError> {
        let mut discovery = discovery::capture(self, root)?;
        let placement = allocate_candidate(self, root, &discovery)?;
        let rendered = render::RenderInput {
            operation: self,
            root,
            ids: &discovery.ids,
            listing: &discovery.listing,
            source_path: &placement.source_path,
        }
        .render(&mut discovery.warnings)?;
        Ok(CandidateContent {
            discovery,
            placement,
            rendered,
        })
    }
    fn prepare_phase(&self, root: &Root) -> Result<Plan<PreparedNew>, TxError> {
        let CandidateContent {
            discovery,
            placement,
            rendered,
        } = self.prepare_content(root)?;
        let discovery::Discovery {
            listing, warnings, ..
        } = discovery;
        let CandidatePlacement {
            source_path,
            path,
            before,
        } = placement;
        let render::Rendered { markdown, ready } = rendered;
        let ParentPreparation { resources } =
            prepare_parents(root, &self.collection, listing.is_some())?;

        Ok(Plan {
            value: PreparedNew {
                id: self.id.clone(),
                source_path,
                scaffold_valid: ready.scaffold_valid,
                body_ready: ready.body_ready,
                resource_ready: ready.resource_ready,
                warnings,
            },
            writes: vec![WriteIntent {
                path: path.clone(),
                before,
                after: Some(markdown.into_bytes()),
            }],
            resources,
            commit_point: CommitPoint::Created(path),
        })
    }
}
struct CandidateContent {
    discovery: discovery::Discovery,
    placement: CandidatePlacement,
    rendered: render::Rendered,
}
struct CandidatePlacement {
    source_path: String,
    path: RelativePath,
    before: ExpectedFile,
}
fn allocate_candidate(
    operation: &NewOperation,
    root: &Root,
    discovery: &discovery::Discovery,
) -> Result<CandidatePlacement, TxError> {
    let allocated = candidate::plan_creation(
        discovery.domain,
        &CandidateIdentity {
            id: operation.id.clone(),
        },
        &discovery.ids,
        &discovery.occupied,
    )
    .map_err(|e| err("identity", format!("{e:?}")))?;
    let path = RelativePath::new(operation.collection.as_path().join(&allocated.source_path))
        .map_err(|e| err("path", e))?;
    let before = source::capture(root, &path).map_err(|e| err("source", e))?;
    if before != ExpectedFile::Missing {
        return Err(err("path-conflict", "candidate already exists"));
    }
    Ok(CandidatePlacement {
        source_path: allocated.source_path,
        path,
        before,
    })
}

fn prepare_parents(
    root: &Root,
    collection: &RelativePath,
    collection_exists: bool,
) -> Result<ParentPreparation, TxError> {
    let mut resources = vec![];
    if !collection_exists {
        let mut prefix = std::path::PathBuf::new();
        let mut missing = false;
        for component in collection.as_path().components() {
            prefix.push(component.as_os_str());
            let path = RelativePath::new(&prefix).map_err(|e| err("path", e))?;
            if !missing {
                match source::enumerate_directory(root, &path) {
                    Ok(_) => continue,
                    Err(source::SourceError::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {
                        missing = true
                    }
                    Err(e) => return Err(err("collection", e)),
                }
            }
            resources.push(ResourceIntent::CreateDirectory { path });
        }
    }
    Ok(ParentPreparation { resources })
}

mod discovery;
mod render;
mod transaction;

pub mod investigation_publish;

pub mod decision;
