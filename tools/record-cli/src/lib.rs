//! Native record tool candidate. Domain boundaries are validated at runtime.
pub mod cli;
pub mod domains;
pub mod git;
pub mod index;
pub mod mutations;
pub mod protocol;
pub mod queries;
pub(crate) mod resource_review;
pub mod resources;
pub mod source;
pub mod source_revision;
pub mod stage;
pub mod transaction;
