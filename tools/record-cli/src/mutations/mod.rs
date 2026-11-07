//! Inputs and results for record mutations. Domain operations consume only
//! argument-validated commands; the CLI owns syntax and output channels.

pub mod contract;

pub mod authoring;
pub mod candidate;
pub mod check;
pub mod decision;
pub mod decision_relations;
pub mod discard;
pub mod evolution;
pub mod identity;
pub mod investigation_operation;
pub mod investigation_relations;
pub mod publication;
pub mod relations;
pub mod rename;
pub mod sync;

#[cfg(test)]
mod tests;
