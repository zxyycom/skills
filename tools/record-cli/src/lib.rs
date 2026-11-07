//! Native record tool candidate. The target is restricted at compile time; domain boundaries are validated at runtime.
pub mod cli;
pub mod cli_mutation;
pub mod domains;
pub mod git;
pub mod index;
pub mod mutations;
pub mod protocol;
pub mod queries;
pub mod resources;
pub mod source;
pub mod source_revision;
pub mod stage;
pub mod transaction;
