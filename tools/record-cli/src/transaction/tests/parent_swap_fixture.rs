//! Shared race fixture for replacing a resource ancestor at a known transaction phase.
use super::*;
use std::sync::{Arc, Barrier};

pub(super) enum SwapPhase {
    BeforeWrite,
    BeforePostverify,
}
struct ResourceParentSwap {
    entered: Arc<Barrier>,
    resume: Arc<Barrier>,
    phase: SwapPhase,
    remove_directory: bool,
}
impl TransactionOperation<()> for ResourceParentSwap {
    fn prepare(&mut self, root: &Root) -> Result<Plan<()>, TxError> {
        let mut plan = ResourceMove::Success.prepare(root)?;
        plan.resources[1] = ResourceIntent::CopyFile {
            source: RelativePath::new("outer/old-assets/item.txt").unwrap(),
            destination: RelativePath::new("new-assets/item.txt").unwrap(),
        };
        plan.resources[2] = ResourceIntent::RemoveFile {
            path: RelativePath::new("outer/old-assets/item.txt").unwrap(),
        };
        if self.remove_directory {
            plan.resources[3] = ResourceIntent::RemoveDirectory {
                path: RelativePath::new("outer/old-assets").unwrap(),
            };
        } else {
            plan.resources.pop();
        }
        Ok(plan)
    }
    fn before_write(&mut self, _: &Root, index: usize) -> Result<(), TxError> {
        if matches!(self.phase, SwapPhase::BeforeWrite) && index == 0 {
            self.entered.wait();
            self.resume.wait();
            return Err(TxError::new("injected", "before source write"));
        }
        Ok(())
    }
    fn before_postverify(&mut self, _: &Root) -> Result<(), TxError> {
        if matches!(self.phase, SwapPhase::BeforePostverify) {
            self.entered.wait();
            self.resume.wait();
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
pub(super) fn start_resource_parent_swap(
    path: &std::path::Path,
    phase: SwapPhase,
    remove_directory: bool,
) -> (
    std::thread::JoinHandle<TransactionOutcome<()>>,
    Arc<Barrier>,
    Arc<Barrier>,
) {
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let mut operation = ResourceParentSwap {
        entered: entered.clone(),
        resume: resume.clone(),
        phase,
        remove_directory,
    };
    let path = path.to_path_buf();
    let worker = std::thread::spawn(move || {
        let root = crate::source::open_root(&path).unwrap();
        run_transaction(&root, &RelativePath::new(".lock").unwrap(), &mut operation)
    });
    (worker, entered, resume)
}

pub(super) fn resource_ancestor_fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("old.md"), b"old record").unwrap();
    std::fs::create_dir_all(dir.path().join("outer/old-assets")).unwrap();
    std::fs::write(dir.path().join("outer/old-assets/item.txt"), b"asset").unwrap();
    dir
}
