use crate::{
    source::{ExpectedFile, SourceSnapshot},
    transaction::{CommitPoint, Plan, WriteIntent},
};

pub(in crate::mutations) fn prepare<T>(
    index: SourceSnapshot,
    target: &[u8],
    needs_write: bool,
    value: T,
) -> Plan<T> {
    let path = index.path.clone();
    let (writes, commit_point) = if needs_write {
        (
            vec![WriteIntent {
                path: path.clone(),
                before: ExpectedFile::Present(index),
                after: Some(target.to_vec()),
            }],
            CommitPoint::PublishedIndex(path),
        )
    } else {
        (vec![], CommitPoint::NoCommit)
    };
    Plan {
        value,
        writes,
        resources: vec![],
        commit_point,
    }
}
