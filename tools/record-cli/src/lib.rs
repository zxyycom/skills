//! Native record tool candidate. The target is restricted at compile time; domain boundaries are validated at runtime.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("record-cli candidate supports only x86_64-unknown-linux-gnu");

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
