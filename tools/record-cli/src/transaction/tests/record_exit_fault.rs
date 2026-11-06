//! Faults after deleting an original record but before publishing the index.
use super::*;
use std::sync::{Arc, Barrier};

pub(super) enum RecordExitFault {
    CopyThenDelete {
        rival: bool,
    },
    DeleteUnderReplacedParent {
        entered: Arc<Barrier>,
        resume: Arc<Barrier>,
    },
}
impl TransactionOperation<()> for RecordExitFault {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let old = RelativePath::new(match self {
            Self::CopyThenDelete { .. } => "old.md",
            Self::DeleteUnderReplacedParent { .. } => "records/old.md",
        })
        .unwrap();
        let index = RelativePath::new("index.json").unwrap();
        let before = capture(root, &old).unwrap();
        let mut writes = Vec::new();
        if matches!(self, Self::CopyThenDelete { .. }) {
            let ExpectedFile::Present(snapshot) = &before else {
                panic!("missing")
            };
            writes.push(WriteIntent {
                path: RelativePath::new("new.md").unwrap(),
                before: ExpectedFile::Missing,
                after: Some(b"new".to_vec()),
                mode: Some(WriteMode::Exact(exact_mode(snapshot.identity.mode))),
            });
        }
        writes.push(WriteIntent {
            path: old,
            before,
            after: None,
            mode: None,
        });
        writes.push(WriteIntent {
            before: capture(root, &index).unwrap(),
            path: index.clone(),
            after: Some(b"new index".to_vec()),
            mode: None,
        });
        Ok(Plan {
            value: (),
            writes,
            guards: vec![],
            resources: vec![],
            commit_point: CommitPoint::PublishedIndex(index),
        })
    }
    fn before_write(&mut self, root: &Root, index: usize) -> Result<(), TxError> {
        match self {
            Self::CopyThenDelete { rival } if index == 2 => {
                if *rival {
                    std::fs::write(root.path().join("old.md"), b"winner").unwrap();
                }
            }
            Self::DeleteUnderReplacedParent { entered, resume } if index == 1 => {
                entered.wait();
                resume.wait();
            }
            _ => return Ok(()),
        }
        Err(TxError::new("injected", "before index"))
    }
    fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
}
