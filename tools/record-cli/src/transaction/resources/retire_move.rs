//! Verify copied trees and retire original resources.
use super::*;

impl Resources<'_> {
    pub fn retire_moves(&self, root: &Root, journal: &mut Journal) -> Result<(), TxError> {
        for (intent, observed) in self.intents.iter().zip(&self.observations) {
            let ResourceIntent::MoveDirectory {
                source: old,
                destination,
            } = intent
            else {
                continue;
            };
            retire_move(root, journal, observed, old, destination)?;
        }
        Ok(())
    }
    pub fn all_moves_exited(&self, journal: &Journal) -> bool {
        self.intents
            .iter()
            .filter_map(|intent| match intent {
                ResourceIntent::MoveDirectory { source, .. } => Some(source),
                _ => None,
            })
            .all(|source| journal.exited_moves.contains(source))
    }
    pub fn has_moves(&self) -> bool {
        self.intents
            .iter()
            .any(|intent| matches!(intent, ResourceIntent::MoveDirectory { .. }))
    }
}

fn retire_move(
    root: &Root,
    journal: &mut Journal,
    observed: &Observation,
    old: &RelativePath,
    destination: &RelativePath,
) -> Result<(), TxError> {
    let before = observed.tree.as_ref().expect("prepared move tree");
    let current = source::capture_tree(root, old).map_err(|e| error("resource-exit", e))?;
    let copy = source::capture_tree(root, destination).map_err(|e| error("resource-exit", e))?;
    if !same_tree(before, &current) || !same_tree(before, &copy) {
        return Err(error(
            "resource-changed",
            format!(
                "source {} or copied tree {} changed before exit",
                old.as_path().display(),
                destination.as_path().display()
            ),
        ));
    }
    for member in current.entries().iter().rev() {
        let path = member.path();
        MoveExit {
            root,
            journal,
            old,
            destination,
        }
        .remove(member)?;
        journal.changed.push(path.clone());
        if path == old {
            journal.exited_moves.push(old.clone());
        }
    }
    Ok(())
}
struct MoveExit<'a> {
    root: &'a Root,
    journal: &'a mut Journal,
    old: &'a RelativePath,
    destination: &'a RelativePath,
}
impl MoveExit<'_> {
    fn remove(self, member: &source::TreeEntry) -> Result<(), TxError> {
        let path = member.path();
        match member {
            source::TreeEntry::File {
                identity, bytes, ..
            } => self.remove_file(path, identity, bytes),
            source::TreeEntry::Directory { .. } => self.remove_directory(path),
        }
    }
    fn remove_file(
        self,
        path: &RelativePath,
        identity: &source::FileIdentity,
        bytes: &[u8],
    ) -> Result<(), TxError> {
        let snapshot = self.verify_file_before_exit(path, identity, bytes)?;
        let Self { root, journal, .. } = self;
        source::remove_if_matches(root, &snapshot).map_err(|e| {
            if e.effect == source::RemoveEffect::RemovedUnverified {
                journal.changed.push(path.clone());
            }
            if e.effect != source::RemoveEffect::NotStarted {
                journal.unknown.push(path.clone());
            }
            error("resource-exit", e.error)
        })?;
        Ok(())
    }
    fn verify_file_before_exit(
        &self,
        path: &RelativePath,
        identity: &source::FileIdentity,
        bytes: &[u8],
    ) -> Result<SourceSnapshot, TxError> {
        let Self {
            root,
            old,
            destination,
            ..
        } = self;
        let ExpectedFile::Present(snapshot) = file(root, path)? else {
            return Err(error("resource-exit", "source file missing"));
        };
        let suffix = path
            .as_path()
            .strip_prefix(old.as_path())
            .expect("tree member");
        let copied_path = RelativePath::new(destination.as_path().join(suffix))
            .map_err(|e| error("resource-exit", e))?;
        let copied = file(root, &copied_path)?;
        if snapshot.bytes != *bytes
            || super::super::exact_mode(snapshot.identity.mode)
                != super::super::exact_mode(identity.mode)
            || !matches!(copied, ExpectedFile::Present(ref current) if current.bytes == *bytes && super::super::exact_mode(current.identity.mode) == super::super::exact_mode(identity.mode))
        {
            return Err(error(
                "resource-changed",
                format!(
                    "source {} or copy {} changed before removal",
                    path.as_path().display(),
                    copied_path.as_path().display()
                ),
            ));
        }
        Ok(snapshot)
    }
    fn remove_directory(self, path: &RelativePath) -> Result<(), TxError> {
        let Self {
            root, journal, old, ..
        } = self;
        let snapshot = directory(root, path)?
            .ok_or_else(|| error("resource-exit", "source directory missing"))?;
        source::remove_empty_directory(root, &snapshot).map_err(|e| {
            if e.effect == source::RemoveEffect::RemovedUnverified {
                journal.changed.push(path.clone());
                if path == old {
                    journal.exited_moves.push(old.clone());
                }
            }
            if e.effect != source::RemoveEffect::NotStarted {
                journal.unknown.push(path.clone());
            }
            error("resource-exit", e.error)
        })?;
        Ok(())
    }
}
