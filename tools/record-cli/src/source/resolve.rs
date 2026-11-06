//! Resolve directory links within the retained root capability.
use super::*;

#[cfg(unix)]
fn absolute_inside(root: &Path, target: &Path) -> Result<Option<PathBuf>, SourceError> {
    Ok(target.strip_prefix(root).ok().map(Path::to_path_buf))
}

/// Resolve directory links lexically under the retained root capability. An
/// absolute link is accepted only when its target is lexically inside that
/// root. The final source file itself is never followed.
pub(super) fn resolve_directory_links(
    root: &Root,
    path: &RelativePath,
    final_is_file: bool,
) -> Result<RelativePath, SourceError> {
    let capability = cap_std::fs::Dir::from_std_file(root.directory.try_clone()?);
    let mut state = LinkTraversal::new(path);
    while let Some(name) = state.pending.pop_front() {
        let mut candidate = state.resolved.clone();
        candidate.push(&name);
        if final_is_file && state.pending.is_empty() {
            state.resolved = candidate;
            break;
        }
        match classify_component(&capability, &candidate)? {
            ComponentFact::Missing => return state.finish_missing(candidate),
            ComponentFact::Existing => {
                state.resolved = candidate;
                continue;
            }
            ComponentFact::Link => state.follow(root, path, &capability, &candidate)?,
        }
    }
    RelativePath::new(state.resolved)
}

// Pending and resolved components plus the hop bound form one traversal state.
struct LinkTraversal {
    pending: std::collections::VecDeque<std::ffi::OsString>,
    resolved: PathBuf,
    links: usize,
}
impl LinkTraversal {
    fn new(path: &RelativePath) -> Self {
        Self {
            pending: path
                .as_path()
                .components()
                .map(|c| c.as_os_str().to_os_string())
                .collect(),
            resolved: PathBuf::new(),
            links: 0,
        }
    }
    fn finish_missing(mut self, candidate: PathBuf) -> Result<RelativePath, SourceError> {
        self.resolved = candidate;
        for rest in self.pending {
            self.resolved.push(rest);
        }
        RelativePath::new(self.resolved)
    }
    fn follow(
        &mut self,
        root: &Root,
        path: &RelativePath,
        capability: &cap_std::fs::Dir,
        candidate: &Path,
    ) -> Result<(), SourceError> {
        self.links += 1;
        if self.links > 40 {
            return Err(SourceError::Unsafe(path.0.clone()));
        }
        let target = capability.read_link_contents(candidate)?;
        apply_link_target(root, path, &mut self.resolved, target)?;
        let mut restart: std::collections::VecDeque<_> = self
            .resolved
            .components()
            .map(|c| c.as_os_str().to_os_string())
            .collect();
        restart.append(&mut self.pending);
        self.pending = restart;
        self.resolved.clear();
        Ok(())
    }
}
// A missing component ends observation without inventing later namespace facts.
enum ComponentFact {
    Missing,
    Existing,
    Link,
}
fn classify_component(
    capability: &cap_std::fs::Dir,
    candidate: &Path,
) -> Result<ComponentFact, SourceError> {
    match capability.symlink_metadata(candidate) {
        Ok(metadata) if metadata.file_type().is_symlink() => Ok(ComponentFact::Link),
        Ok(_) => Ok(ComponentFact::Existing),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(ComponentFact::Missing),
        Err(error) => Err(error.into()),
    }
}
// Resolve one link lexically without allowing an absolute or parent escape.
fn apply_link_target(
    root: &Root,
    path: &RelativePath,
    resolved: &mut PathBuf,
    target: PathBuf,
) -> Result<(), SourceError> {
    let target = if target.is_absolute() {
        resolved.clear();
        absolute_inside(&root.path, &target)?.ok_or_else(|| SourceError::Unsafe(path.0.clone()))?
    } else {
        target
    };
    for component in target.components() {
        match component {
            Component::Normal(part) => resolved.push(part),
            Component::CurDir => {}
            Component::ParentDir => {
                if !resolved.pop() {
                    return Err(SourceError::Unsafe(path.0.clone()));
                }
            }
            _ => return Err(SourceError::Unsafe(path.0.clone())),
        }
    }
    Ok(())
}
