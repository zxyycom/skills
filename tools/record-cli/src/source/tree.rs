//! Complete resource tree capture and identity facts.
use super::*;

#[derive(Debug)]
pub struct TreeSnapshot {
    workspace: PathBuf,
    workspace_identity: FileIdentity,
    pub(super) root: RelativePath,
    pub(super) entries: Vec<TreeEntry>,
}
#[derive(Debug)]
pub enum TreeEntry {
    Directory {
        path: RelativePath,
        identity: FileIdentity,
    },
    File {
        path: RelativePath,
        identity: FileIdentity,
        bytes: Vec<u8>,
    },
}
impl TreeEntry {
    pub(crate) fn path(&self) -> &RelativePath {
        match self {
            Self::Directory { path, .. } | Self::File { path, .. } => path,
        }
    }
}
impl TreeSnapshot {
    pub fn root(&self) -> &RelativePath {
        &self.root
    }
    pub fn entries(&self) -> &[TreeEntry] {
        &self.entries
    }
    pub fn belongs_to(&self, root: &Root, path: &RelativePath) -> bool {
        self.workspace == root.path
            && self.workspace_identity == root.identity
            && self.root == *path
    }
}
/// Enumerate only the selected owner tree; never follow a tree member symlink.
/// Each file is bound to the identity found during enumeration, and every
/// directory is re-enumerated after its subtree is captured.
pub fn capture_tree(root: &Root, path: &RelativePath) -> Result<TreeSnapshot, SourceError> {
    let mut entries = Vec::new();
    walk(root, path, &mut entries)?;
    Ok(TreeSnapshot {
        workspace: root.path.clone(),
        workspace_identity: root.identity.clone(),
        root: path.clone(),
        entries,
    })
}

fn walk(root: &Root, path: &RelativePath, result: &mut Vec<TreeEntry>) -> Result<(), SourceError> {
    reject_final_link(root, path)?;
    let before = enumerate_directory(root, path)?;
    result.push(TreeEntry::Directory {
        path: path.clone(),
        identity: before.identity.clone(),
    });
    for member in &before.members {
        walk_member(root, path, member, result)?;
    }
    if enumerate_directory(root, path)? != before {
        return Err(SourceError::Changed(path.0.clone()));
    }
    Ok(())
}

// Bind each enumerated member to the independently opened child before recursing.
fn walk_member(
    root: &Root,
    path: &RelativePath,
    member: &DirectoryMember,
    result: &mut Vec<TreeEntry>,
) -> Result<(), SourceError> {
    let child = RelativePath::new(path.as_path().join(&member.name))?;
    match member.kind {
        MemberKind::Directory => {
            let observed = enumerate_directory(root, &child)?;
            if !observed.identity.same_identity_and_mode(&member.identity) {
                return Err(SourceError::Changed(child.0));
            }
            walk(root, &child, result)?;
        }
        MemberKind::File => {
            let ExpectedFile::Present(file) = capture(root, &child)? else {
                return Err(SourceError::Changed(child.0));
            };
            if file.identity != member.identity {
                return Err(SourceError::Changed(child.0));
            }
            result.push(TreeEntry::File {
                path: child,
                identity: file.identity,
                bytes: file.bytes,
            });
        }
        MemberKind::Symlink | MemberKind::Other => {
            return Err(SourceError::Unsafe(child.0));
        }
    }

    Ok(())
}
