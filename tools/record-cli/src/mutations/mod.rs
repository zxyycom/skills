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

// Freshness compares observable facts, not incidental inode or parent-chain identity.
fn same_directory(
    a: &crate::source::DirectorySnapshot,
    b: &crate::source::DirectorySnapshot,
) -> bool {
    a.path == b.path
        && a.members.len() == b.members.len()
        && a.members
            .iter()
            .zip(&b.members)
            .all(|(a, b)| a.name == b.name && a.kind == b.kind)
}
fn same_header(a: &crate::source::HeaderSnapshot, b: &crate::source::HeaderSnapshot) -> bool {
    a.path == b.path && a.bytes == b.bytes && a.identity.mode == b.identity.mode
}
fn same_headers(a: &[crate::source::HeaderSnapshot], b: &[crate::source::HeaderSnapshot]) -> bool {
    a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same_header(a, b))
}
fn same_named_headers(
    a: &[(String, crate::source::HeaderSnapshot)],
    b: &[(String, crate::source::HeaderSnapshot)],
) -> bool {
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|((an, a), (bn, b))| an == bn && same_header(a, b))
}
fn same_optional_directory(
    a: &Option<crate::source::DirectorySnapshot>,
    b: &Option<crate::source::DirectorySnapshot>,
) -> bool {
    match (a, b) {
        (Some(a), Some(b)) => same_directory(a, b),
        (None, None) => true,
        _ => false,
    }
}
