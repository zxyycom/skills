//! Resolve directory links within the retained root capability.
use super::*;

#[cfg(unix)]
fn absolute_inside(root: &Path, target: &Path) -> Result<Option<PathBuf>, SourceError> {
    Ok(target.strip_prefix(root).ok().map(Path::to_path_buf))
}
#[cfg(windows)]
fn normalize_windows_path(path: &Path) -> Option<PathBuf> {
    let text = path.to_str()?;
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        Some(PathBuf::from(format!(r"\\{rest}")))
    } else if let Some(rest) = text.strip_prefix(r"\\?\") {
        Some(PathBuf::from(rest))
    } else {
        Some(path.to_path_buf())
    }
}
#[cfg(windows)]
fn absolute_inside(root: &Path, target: &Path) -> Result<Option<PathBuf>, SourceError> {
    let root =
        normalize_windows_path(root).ok_or_else(|| SourceError::InvalidPath(root.to_path_buf()))?;
    let target = normalize_windows_path(target)
        .ok_or_else(|| SourceError::InvalidPath(target.to_path_buf()))?;
    if let Ok(relative) = target.strip_prefix(&root) {
        return Ok(Some(relative.to_path_buf()));
    }
    // A Windows absolute link may use an 8.3 spelling for an ancestor of
    // the canonical workspace. Expand names, then apply the same strict
    // component boundary; subsequent traversal still uses the root handle.
    let long = windows_long_path(&target)?;
    Ok(normalize_windows_path(&long)
        .ok_or_else(|| SourceError::InvalidPath(long.clone()))?
        .strip_prefix(root)
        .ok()
        .map(Path::to_path_buf))
}
// Expand 8.3 spellings without trusting the result as a workspace-relative path.
#[cfg(windows)]
fn windows_long_path(target: &Path) -> Result<PathBuf, SourceError> {
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use windows_sys::Win32::Storage::FileSystem::GetLongPathNameW;
    let input: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    // SAFETY: input is NUL-terminated; a null output with length zero queries size.
    let needed = unsafe { GetLongPathNameW(input.as_ptr(), std::ptr::null_mut(), 0) };
    if needed == 0 {
        return Err(io::Error::last_os_error().into());
    }
    let mut output = vec![0u16; needed as usize];
    // SAFETY: output has exactly the reported number of writable UTF-16 units.
    let written = unsafe { GetLongPathNameW(input.as_ptr(), output.as_mut_ptr(), needed) };
    if written == 0 {
        return Err(io::Error::last_os_error().into());
    }
    if written >= needed {
        return Err(SourceError::Changed(target.to_path_buf()));
    }
    output.truncate(written as usize);
    Ok(PathBuf::from(std::ffi::OsString::from_wide(&output)))
}

/// Resolve directory links lexically under the retained root capability. An
/// absolute link is accepted only when its target is lexically inside that
/// root. The final source file itself is never followed.
#[cfg(any(unix, windows))]
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
#[cfg(any(unix, windows))]
struct LinkTraversal {
    pending: std::collections::VecDeque<std::ffi::OsString>,
    resolved: PathBuf,
    links: usize,
}
#[cfg(any(unix, windows))]
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
#[cfg(any(unix, windows))]
enum ComponentFact {
    Missing,
    Existing,
    Link,
}
#[cfg(any(unix, windows))]
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
#[cfg(any(unix, windows))]
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
