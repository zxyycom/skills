use super::*;

pub(super) struct FirstNamespace {
    pub(super) barrier: Option<(std::sync::Arc<TimedBarrier>, std::sync::Arc<TimedBarrier>)>,
}
impl TransactionOperation<()> for FirstNamespace {
    fn prepare(&mut self, _: &Root) -> Result<Plan<()>, TxError> {
        let directory = RelativePath::new("collection").unwrap();
        let candidate = RelativePath::new("collection/candidate.md").unwrap();
        Ok(Plan {
            value: (),
            writes: vec![WriteIntent {
                path: candidate.clone(),
                before: ExpectedFile::Missing,
                after: Some(b"new candidate".to_vec()),
                mode: Some(WriteMode::Native(0o600)),
            }],
            guards: vec![],
            resources: vec![ResourceIntent::CreateDirectory { path: directory }],
            commit_point: CommitPoint::Created(candidate),
        })
    }
    fn before_postverify(&mut self, _: &Root) -> Result<(), TxError> {
        if let Some((entered, resume)) = &self.barrier {
            entered.wait();
            resume.wait();
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
pub(super) struct SamePathRename {
    pub(super) fail_verify: bool,
    pub(super) corrupt_lock: bool,
    pub(super) fail_before_write: bool,
}
impl TransactionOperation<()> for SamePathRename {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let path = RelativePath::new("candidates/legacy.md").unwrap();
        Ok(Plan {
            value: (),
            writes: vec![WriteIntent {
                before: capture(root, &path).unwrap(),
                path: path.clone(),
                after: Some(b"id: NEW-ID\nbody\n".to_vec()),
                mode: None,
            }],
            guards: vec![],
            resources: vec![],
            commit_point: CommitPoint::Updated(path),
        })
    }
    fn before_write(&mut self, _: &Root, _: usize) -> Result<(), TxError> {
        if self.fail_before_write {
            return Err(TxError::new("injected", "before update"));
        }
        Ok(())
    }
    fn fresh(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if self.corrupt_lock {
            std::fs::write(root.path().join(".lock"), b"rival").unwrap();
        }
        if self.fail_verify {
            return Err(TxError::new("verify-failed", "injected"));
        }
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
}
pub(super) struct ExactResourceModeMove {
    pub(super) drift: bool,
}
impl TransactionOperation<()> for ExactResourceModeMove {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let mut plan = ResourceMove::Success.prepare(root)?;
        plan.resources = vec![
            ResourceIntent::CreateDirectoryFrom {
                source: RelativePath::new("old-assets").unwrap(),
                destination: RelativePath::new("new-assets").unwrap(),
            },
            ResourceIntent::CreateDirectoryFrom {
                source: RelativePath::new("old-assets/nested").unwrap(),
                destination: RelativePath::new("new-assets/nested").unwrap(),
            },
            ResourceIntent::CopyFile {
                source: RelativePath::new("old-assets/nested/item.txt").unwrap(),
                destination: RelativePath::new("new-assets/nested/item.txt").unwrap(),
            },
            ResourceIntent::RemoveFile {
                path: RelativePath::new("old-assets/nested/item.txt").unwrap(),
            },
            ResourceIntent::RemoveDirectory {
                path: RelativePath::new("old-assets/nested").unwrap(),
            },
            ResourceIntent::RemoveDirectory {
                path: RelativePath::new("old-assets").unwrap(),
            },
        ];
        Ok(plan)
    }
    fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if self.drift {
            std::fs::write(root.path().join("old-assets/rival.txt"), b"rival").unwrap();
        }
        Ok(())
    }
    fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
}
pub(super) enum OwnerTreeMove {
    Success,
    FailBeforeIndex,
    FailPostverify,
    TargetWinner,
    RecreateOriginal,
    EditDestination,
}
impl TransactionOperation<()> for OwnerTreeMove {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let record = RelativePath::new("record.md").unwrap();
        let index = RelativePath::new("index.json").unwrap();
        Ok(Plan {
            value: (),
            writes: vec![
                WriteIntent {
                    before: capture(root, &record).unwrap(),
                    path: record,
                    after: Some(b"new record".to_vec()),
                    mode: None,
                },
                WriteIntent {
                    before: capture(root, &index).unwrap(),
                    path: index.clone(),
                    after: Some(b"new index".to_vec()),
                    mode: None,
                },
            ],
            guards: vec![],
            resources: vec![ResourceIntent::MoveDirectory {
                source: RelativePath::new("_resources/old").unwrap(),
                destination: RelativePath::new("_resources/new").unwrap(),
            }],
            commit_point: CommitPoint::PublishedIndex(index),
        })
    }
    fn before_write(&mut self, root: &Root, index: usize) -> Result<(), TxError> {
        if index == 1
            && matches!(
                self,
                Self::FailBeforeIndex | Self::RecreateOriginal | Self::EditDestination
            )
        {
            if matches!(self, Self::RecreateOriginal) {
                std::fs::create_dir(root.path().join("_resources/old")).unwrap();
                std::fs::write(root.path().join("_resources/old/winner"), b"winner").unwrap();
            } else if matches!(self, Self::EditDestination) {
                std::fs::write(
                    root.path().join("_resources/new/nested/item"),
                    b"later edit",
                )
                .unwrap();
            }
            return Err(TxError::new("injected", "before index"));
        }
        Ok(())
    }
    fn fresh(&mut self, root: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if matches!(self, Self::TargetWinner) {
            std::fs::create_dir(root.path().join("_resources/new")).unwrap();
            std::fs::write(root.path().join("_resources/new/winner"), b"winner").unwrap();
        }
        Ok(())
    }
    fn verify(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        if matches!(self, Self::FailPostverify) {
            return Err(TxError::new("verify-failed", "injected"));
        }
        Ok(())
    }
    fn verify_recovered(&mut self, _: &Root, _: &Plan<()>) -> Result<(), TxError> {
        Ok(())
    }
}
pub(super) fn owner_tree_fixture() -> (tempfile::TempDir, Root) {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("record.md"), b"old record").unwrap();
    std::fs::write(dir.path().join("index.json"), b"old index").unwrap();
    std::fs::create_dir_all(dir.path().join("_resources/old/nested")).unwrap();
    std::fs::write(
        dir.path().join("_resources/old/nested/item"),
        b"old resource",
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for (path, mode) in [
            ("_resources/old", 0o775),
            ("_resources/old/nested", 0o751),
            ("_resources/old/nested/item", 0o640),
        ] {
            std::fs::set_permissions(dir.path().join(path), std::fs::Permissions::from_mode(mode))
                .unwrap();
        }
    }
    let root = crate::source::open_root(dir.path()).unwrap();
    (dir, root)
}

pub(super) fn resource_move_fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old record").unwrap();
    std::fs::create_dir(dir.path().join("old-assets")).unwrap();
    std::fs::write(dir.path().join("old-assets/item.txt"), b"asset").unwrap();
    dir
}

/// Delete the selected owner resource before an injected pre-write failure.
pub(super) struct DeleteOnly {
    pub(super) mkdir_barrier: Option<(std::sync::Arc<TimedBarrier>, std::sync::Arc<TimedBarrier>)>,
}
impl TransactionOperation<()> for DeleteOnly {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let mut plan = ResourceMove::Success.prepare(root)?;
        plan.resources = vec![
            ResourceIntent::RemoveFile {
                path: RelativePath::new("old-assets/item.txt").unwrap(),
            },
            ResourceIntent::RemoveDirectory {
                path: RelativePath::new("old-assets").unwrap(),
            },
        ];
        Ok(plan)
    }
    fn before_write(&mut self, _: &Root, _: usize) -> Result<(), TxError> {
        if let Some((entered, resume)) = self.mkdir_barrier.clone() {
            crate::source::set_mkdir_test_hook(move || {
                entered.wait();
                resume.wait();
            });
        }
        Err(TxError::new("injected", "before source"))
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

/// Exercise either an actual index write or a rival occupying a planned candidate name.
pub(super) enum NamespaceProbe {
    PriorWrite,
    Rival,
}
impl TransactionOperation<()> for NamespaceProbe {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let mut plan = FirstNamespace { barrier: None }.prepare(root)?;
        if matches!(self, Self::PriorWrite) {
            let index = RelativePath::new("collection/index.json").unwrap();
            plan.writes.push(WriteIntent {
                path: index.clone(),
                before: ExpectedFile::Missing,
                after: Some(b"index".to_vec()),
                mode: Some(WriteMode::Native(0o600)),
            });
            plan.commit_point = CommitPoint::PublishedIndex(index);
        }
        Ok(plan)
    }
    fn before_write(&mut self, root: &Root, _: usize) -> Result<(), TxError> {
        if matches!(self, Self::Rival) {
            std::fs::write(root.path().join("collection/candidate.md"), b"rival").unwrap();
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
