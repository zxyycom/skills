//! Domain command intents. A selector is resolved against the applicable
//! snapshot during preparation, not by the CLI or across transaction phases.

pub use crate::stage::StageScope;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Relation<T> {
    #[serde(rename = "type")]
    pub kind: T,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum DecisionRelationKind {
    #[serde(rename = "修订")]
    Revision,
    #[serde(rename = "替代")]
    Replacement,
    #[serde(rename = "判定无效")]
    Invalidation,
    #[serde(rename = "归并")]
    Merge,
    #[serde(rename = "拆分")]
    Split,
    #[serde(rename = "重划")]
    Reallocation,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum InvestigationRelationKind {
    #[serde(rename = "补充")]
    Supplement,
    #[serde(rename = "复查")]
    Reexamination,
    #[serde(rename = "修正")]
    Correction,
    #[serde(rename = "推翻")]
    Reversal,
    #[serde(rename = "归并")]
    Merge,
    #[serde(rename = "拆分")]
    Split,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Alignment {
    Aligned,
    Unaligned,
}

/// A source group replaces the complete set, including an explicit empty set.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RelationGroup<T> {
    pub source: String,
    pub relations: Vec<Relation<T>>,
}

/// `Preserve` is different from a complete empty replacement.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DecisionRelationOverride {
    Preserve,
    All(Vec<Relation<DecisionRelationKind>>),
    Groups(Vec<RelationGroup<DecisionRelationKind>>),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Successor {
    pub selector: String,
    pub alignment: Alignment,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DecisionCommand {
    Check,
    New {
        selector: String,
        title: String,
        purpose: String,
        background: String,
        decision: String,
        tags: Vec<String>,
        relations: Vec<Relation<DecisionRelationKind>>,
        preflight_alignment: Option<Alignment>,
    },
    Publish {
        selector: String,
        alignment: Alignment,
        keep_unrecorded_history: bool,
        preflight: bool,
    },
    Evolve {
        successors: Vec<Successor>,
        discard: Option<String>,
        relations: DecisionRelationOverride,
        delete_recorded: bool,
        keep_unrecorded_history: bool,
        preflight: bool,
    },
    Archive {
        selectors: Vec<String>,
        keep_unrecorded_history: bool,
    },
    Reactivate {
        selector: String,
        alignment: Alignment,
        preflight: bool,
    },
    MarkAligned {
        selector: String,
    },
    SetRelations {
        groups: Vec<RelationGroup<DecisionRelationKind>>,
        preflight: bool,
    },
    Discard {
        selector: String,
        delete_recorded: bool,
    },
    Rename {
        source: String,
        target: String,
        rename_recorded: bool,
        preflight: bool,
    },
    SyncIndex {
        selectors: Vec<String>,
        preflight: bool,
    },
    Stage {
        selectors: Vec<String>,
        scope: StageScope,
    },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InvestigationCommand {
    Check {
        ids: Vec<String>,
    },
    New {
        selector: String,
        title: String,
        question: String,
        tags: Vec<String>,
        relations: Vec<Relation<InvestigationRelationKind>>,
        formed_at: Option<String>,
    },
    Publish {
        selectors: Vec<String>,
        preflight: bool,
    },
    SetRelations {
        groups: Vec<RelationGroup<InvestigationRelationKind>>,
        preflight: bool,
    },
    Discard {
        selector: String,
        delete_recorded: bool,
        delete_owned_resources: bool,
    },
    Rename {
        source: String,
        target: String,
        rename_recorded_report: bool,
        rename_recorded_candidate: bool,
        preflight: bool,
    },
    SyncIndex {
        selectors: Vec<String>,
        preflight: bool,
    },
    Stage {
        selectors: Vec<String>,
        scope: StageScope,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewPhase {
    Preflight,
    Prepared,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewAction {
    Establish,
    Replace,
    Unchanged,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceReview<T> {
    pub source_id: String,
    pub action: ReviewAction,
    pub before: Vec<Relation<T>>,
    pub after: Vec<Relation<T>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationReview<T> {
    pub phase: ReviewPhase,
    pub sources: Vec<SourceReview<T>>,
}
