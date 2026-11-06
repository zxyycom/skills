//! Inputs and results for record mutations. Domain operations consume only
//! argument-validated commands; the CLI owns syntax and output channels.

pub mod contract;

pub mod authoring;
pub mod candidate;
pub mod check;
pub mod decision_history;
pub mod decision_lifecycle;
pub mod decision_operation;
pub mod decision_relations;
pub mod decision_selected_sync;
pub mod decision_sync;
pub mod discard;
pub mod evolution;
pub mod full_sync;
pub mod identity;
pub mod investigation_operation;
pub mod investigation_relations;
pub mod investigation_selected_sync;
pub mod investigation_sync;
pub mod lifecycle;
pub mod publication;
pub mod relations;
pub mod rename;
pub mod selected_sync;

#[cfg(test)]
mod tests;
