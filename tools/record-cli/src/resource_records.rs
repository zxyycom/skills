//! Resource-records domain and standalone command entry point.
mod cli;
mod graph;
mod model;
mod parsing;
mod validation;
pub fn main_entry() -> i32 {
    cli::main_entry()
}
