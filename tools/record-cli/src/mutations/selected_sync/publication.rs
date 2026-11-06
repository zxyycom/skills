use super::observation::{Observation, observe, observed_expected};
use crate::{
    index::{self, DomainDefinition},
    mutations::check::FileProof,
    source::{self, ExpectedFile, Root},
    transaction::{CommitPoint, Guard, Plan, TxError, WriteIntent},
};

fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}

pub(in crate::mutations) struct WriteSet {
    pub writes: Vec<WriteIntent>,
    pub guards: Vec<Guard>,
    pub commit_point: CommitPoint,
}

impl WriteSet {
    /// Selected sync publishes only an index and guarded sources, never resource intents.
    pub fn into_plan<T>(self, value: T) -> Plan<T> {
        Plan {
            value,
            writes: self.writes,
            guards: self.guards,
            resources: vec![],
            commit_point: self.commit_point,
        }
    }
}

pub(in crate::mutations) fn prepare(
    root: &Root,
    index: &FileProof,
    sources: &[Observation],
    target: &[u8],
    needs_write: bool,
) -> Result<WriteSet, TxError> {
    let index_before = observed_expected(root, &Observation::Present(index.clone()))?;
    let mut guards = Vec::new();
    for source in sources {
        guards.push(Guard {
            path: source.path().clone(),
            before: observed_expected(root, source)?,
        });
    }
    let index_path = index.path.clone();
    let mut writes = Vec::new();
    let commit_point = if needs_write {
        writes.push(WriteIntent {
            path: index_path.clone(),
            before: index_before,
            after: Some(target.to_vec()),
            mode: None,
        });
        CommitPoint::PublishedIndex(index_path)
    } else {
        guards.push(Guard {
            path: index_path,
            before: index_before,
        });
        CommitPoint::NoCommit
    };
    Ok(WriteSet {
        writes,
        guards,
        commit_point,
    })
}

pub(in crate::mutations) fn verify_sources(
    root: &Root,
    sources: &[Observation],
) -> Result<(), TxError> {
    for expected in sources {
        if observe(root, expected.path())? != *expected {
            return Err(fail("postverify", "selected source changed"));
        }
    }
    Ok(())
}

pub(in crate::mutations) fn verify_index<D: DomainDefinition>(
    root: &Root,
    index: &FileProof,
    target: &[u8],
    domain: &D,
) -> Result<(), TxError> {
    let index_path = &index.path;
    let ExpectedFile::Present(file) =
        source::capture(root, index_path).map_err(|e| fail("postverify", e.to_string()))?
    else {
        return Err(fail("postverify", "index is missing"));
    };
    if file.bytes != target {
        return Err(fail("postverify", "index bytes differ from proposal"));
    }
    let index =
        index::parse_index(&file.bytes, domain).map_err(|e| fail("postverify", e.to_string()))?;
    index::QuerySnapshot::new(index)
        .graph(domain)
        .map_err(|e| fail("postverify", e.to_string()))?;
    Ok(())
}
