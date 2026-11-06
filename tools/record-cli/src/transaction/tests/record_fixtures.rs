use super::*;

pub(super) struct Operation {
    pub(super) path: RelativePath,
    pub(super) change: bool,
    pub(super) drift: bool,
    pub(super) events: Vec<&'static str>,
}
impl TransactionOperation<()> for Operation {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        self.events.push("prepare");
        let before = capture(root, &self.path).map_err(|e| TxError::new("read", e.to_string()))?;
        Ok(Plan {
            value: (),
            writes: vec![WriteIntent {
                path: self.path.clone(),
                before,
                after: Some(if self.change {
                    b"changed".to_vec()
                } else {
                    b"original".to_vec()
                }),
                mode: None,
            }],
            guards: vec![],
            resources: vec![],
            commit_point: CommitPoint::NoCommit,
        })
    }
    fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        self.events.push("fresh");
        if self.drift {
            std::fs::write(root.path().join(self.path.as_path()), b"rival").unwrap();
        }
        Ok(())
    }
    fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        self.events.push("verify");
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        self.events.push("recovered");
        Ok(())
    }
}
pub(super) struct Publication {
    pub(super) fail_verify: bool,
    pub(super) drift_after_first: bool,
    pub(super) fail_second: bool,
}
impl TransactionOperation<()> for Publication {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let mut writes = Vec::new();
        for (name, after) in [
            ("record.md", b"new record".as_slice()),
            ("index.json", b"new index".as_slice()),
        ] {
            let path = RelativePath::new(name).unwrap();
            writes.push(WriteIntent {
                before: capture(root, &path).unwrap(),
                path,
                after: Some(after.to_vec()),
                mode: None,
            });
        }
        Ok(Plan {
            value: (),
            writes,
            guards: vec![],
            resources: vec![],
            commit_point: CommitPoint::PublishedIndex(RelativePath::new("index.json").unwrap()),
        })
    }
    fn before_write(&mut self, root: &Root, index: usize) -> Result<(), TxError> {
        if self.fail_second && index == 1 {
            if self.drift_after_first {
                std::fs::write(root.path().join("record.md"), b"rival").unwrap();
            }
            return Err(TxError::new("injected", "before index"));
        }
        Ok(())
    }
    fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if self.drift_after_first {
            std::fs::write(root.path().join("record.md"), b"rival").unwrap();
        }
        if self.fail_verify {
            Err(TxError::new("verify-failed", "injected"))
        } else {
            Ok(())
        }
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
}
pub(super) struct Creation;
impl TransactionOperation<()> for Creation {
    fn prepare(&mut self, _: &Root) -> Result<Plan<()>, TxError> {
        let path = RelativePath::new("candidate.md").unwrap();
        Ok(Plan {
            value: (),
            writes: vec![WriteIntent {
                path: path.clone(),
                before: ExpectedFile::Missing,
                after: Some(b"candidate".to_vec()),
                mode: Some(WriteMode::Native(0o600)),
            }],
            guards: vec![],
            resources: vec![],
            commit_point: CommitPoint::Created(path),
        })
    }
    fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        assert_eq!(
            std::fs::read(root.path().join("candidate.md")).unwrap(),
            b"candidate"
        );
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
}
pub(super) struct Rename {
    pub(super) fail_delete: bool,
}
impl TransactionOperation<()> for Rename {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let old = RelativePath::new("old.md").unwrap();
        let new = RelativePath::new("new.md").unwrap();
        let before = capture(root, &old).unwrap();
        let ExpectedFile::Present(snapshot) = &before else {
            panic!("old file missing")
        };
        Ok(Plan {
            value: (),
            writes: vec![
                WriteIntent {
                    path: new.clone(),
                    before: ExpectedFile::Missing,
                    after: Some(b"renamed".to_vec()),
                    mode: Some(WriteMode::Exact(exact_mode(snapshot.identity.mode))),
                },
                WriteIntent {
                    path: old.clone(),
                    before,
                    after: None,
                    mode: None,
                },
            ],
            guards: vec![],
            resources: vec![],
            commit_point: CommitPoint::Renamed { old, new },
        })
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if self.fail_delete && index == 1 {
            return Err(TxError::new("injected", "before removal"));
        }
        Ok(())
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
pub(super) enum ResourceMove {
    Success,
    FailAfterResources,
    RivalAfterResources,
    TamperBackup,
}
impl TransactionOperation<()> for ResourceMove {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let old = RelativePath::new("old.md").unwrap();
        let new = RelativePath::new("new.md").unwrap();
        let before = capture(root, &old).unwrap();
        let ExpectedFile::Present(snapshot) = &before else {
            panic!("missing source")
        };
        Ok(Plan {
            value: (),
            writes: vec![
                WriteIntent {
                    path: new.clone(),
                    before: ExpectedFile::Missing,
                    after: Some(b"new record".to_vec()),
                    mode: Some(WriteMode::Exact(exact_mode(snapshot.identity.mode))),
                },
                WriteIntent {
                    path: old.clone(),
                    before,
                    after: None,
                    mode: None,
                },
            ],
            guards: vec![],
            resources: vec![
                ResourceIntent::CreateDirectory {
                    path: RelativePath::new("new-assets").unwrap(),
                },
                ResourceIntent::CopyFile {
                    source: RelativePath::new("old-assets/item.txt").unwrap(),
                    destination: RelativePath::new("new-assets/item.txt").unwrap(),
                },
                ResourceIntent::RemoveFile {
                    path: RelativePath::new("old-assets/item.txt").unwrap(),
                },
                ResourceIntent::RemoveDirectory {
                    path: RelativePath::new("old-assets").unwrap(),
                },
            ],
            commit_point: CommitPoint::Renamed { old, new },
        })
    }
    fn before_write(&mut self, root: &Root, index: usize) -> Result<(), TxError> {
        if matches!(self, Self::FailAfterResources | Self::RivalAfterResources) && index == 0 {
            if matches!(self, Self::RivalAfterResources) {
                std::fs::write(root.path().join("new-assets/item.txt"), b"rival").unwrap();
            }
            return Err(TxError::new("injected", "after resources"));
        }
        Ok(())
    }
    fn before_postverify(&mut self, root: &Root) -> Result<(), TxError> {
        if matches!(self, Self::TamperBackup) {
            let path = std::fs::read_dir(root.path())
                .unwrap()
                .map(|entry| entry.unwrap().path())
                .find(|path| {
                    path.file_name()
                        .unwrap()
                        .to_string_lossy()
                        .starts_with(".record-cli-recovery-")
                })
                .unwrap();
            std::fs::write(path, b"later editor").unwrap();
        }
        Ok(())
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
