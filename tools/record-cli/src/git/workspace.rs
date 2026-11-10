use super::*;
use std::collections::BTreeSet;

/// List tracked plus nonignored untracked workspace paths, without opening blobs.
/// Returned paths are relative to `root`, even when it is a worktree subdirectory.
/// Nonempty `scopes` are literal relative files/directories; their union is returned.
pub fn list_workspace_files(
    root: &std::path::Path,
    scopes: &[PathBuf],
) -> Result<Vec<PathBuf>, GitError> {
    let prefix = worktree_prefix(root)?;
    let mut result = BTreeSet::new();
    let mut patterns: Vec<String> = if scopes.is_empty() {
        vec![format!(":(top,literal){prefix}")]
    } else {
        scopes
            .iter()
            .map(|scope| git_path(scope).map(|name| format!(":(top,literal){prefix}{name}")))
            .collect::<Result<_, _>>()?
    };
    patterns.sort();
    patterns.dedup();
    for batch in pattern_batches(&patterns)? {
        let args = [
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "-z",
            "--full-name",
            "--",
        ];
        command_patterns(root, &args, batch, 256 * 1024 * 1024, |bytes| {
            collect_workspace_listing(bytes, &prefix, &mut result)
        })?;
    }
    Ok(result.into_iter().collect())
}

/// Decode Git's NUL-framed paths and bind every path to the requested worktree prefix.
fn collect_workspace_listing(
    bytes: &[u8],
    prefix: &str,
    result: &mut BTreeSet<PathBuf>,
) -> Result<(), GitError> {
    if !bytes.is_empty() && bytes.last() != Some(&0) {
        return Err(GitError::InvalidOutput("unterminated workspace listing"));
    }
    for item in bytes.split(|b| *b == 0).filter(|entry| !entry.is_empty()) {
        let path = std::str::from_utf8(item)
            .map_err(|_| GitError::InvalidOutput("invalid workspace path"))?;
        let relative = path.strip_prefix(prefix).ok_or(GitError::InvalidOutput(
            "workspace path outside requested root",
        ))?;
        let relative = PathBuf::from(relative);
        validate_path(&relative)?;
        result.insert(relative);
    }
    Ok(())
}

/// Validate Git's worktree-relative prefix before using it in literal pathspecs.
fn worktree_prefix(root: &std::path::Path) -> Result<String, GitError> {
    let prefix = command(root, &["rev-parse", "--show-prefix"], None)?;
    let prefix = std::str::from_utf8(&prefix)
        .map_err(|_| GitError::InvalidOutput("invalid worktree prefix"))?;
    let prefix = prefix
        .strip_suffix('\n')
        .ok_or(GitError::InvalidOutput("invalid worktree prefix"))?
        .strip_suffix('\r')
        .unwrap_or_else(|| prefix.strip_suffix('\n').expect("checked suffix"));
    if !prefix.is_empty() {
        let normalized = prefix
            .strip_suffix('/')
            .ok_or(GitError::InvalidOutput("invalid worktree prefix"))?;
        validate_path(std::path::Path::new(normalized))?;
    }
    Ok(prefix.to_owned())
}

/// Discover the Git worktree, distinguishing an ordinary non-repository only
/// when Git says so and no ancestor has a worktree marker.
pub fn discover_worktree(start: &std::path::Path) -> Result<PathBuf, GitError> {
    let start = start.canonicalize().map_err(GitError::Io)?;
    if !start.is_dir() {
        return Err(GitError::InvalidOutput("workspace is not a directory"));
    }
    super::command::check_git_context()?;
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(&start)
        .args(["rev-parse", "--show-toplevel"])
        .env("LC_ALL", "C")
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(GitError::Io)?;
    if !output.status.success() {
        return Err(discovery_failure(&start, &output));
    }
    discovered_root(&start, &output.stdout)
}

/// Validate the absolute Git root and require that it contains the starting workspace.
fn discovered_root(start: &std::path::Path, output: &[u8]) -> Result<PathBuf, GitError> {
    let text = std::str::from_utf8(output)
        .map_err(|_| GitError::InvalidOutput("invalid worktree root"))?;
    let text = text
        .strip_suffix('\n')
        .ok_or(GitError::InvalidOutput("unterminated worktree root"))?;
    let path = std::path::Path::new(text);
    if !path.is_absolute() {
        return Err(GitError::InvalidOutput("invalid worktree root"));
    }
    let root = path.canonicalize().map_err(GitError::Io)?;
    if !start.starts_with(&root) {
        return Err(GitError::InvalidOutput(
            "workspace outside discovered worktree",
        ));
    }
    Ok(root)
}

/// Non-repository is trustworthy only if Git says so and no ancestor has a marker.
fn discovery_failure(start: &std::path::Path, output: &std::process::Output) -> GitError {
    if output.status.code() == Some(128)
        && String::from_utf8_lossy(&output.stderr).contains("not a git repository")
    {
        for ancestor in start.ancestors() {
            match std::fs::symlink_metadata(ancestor.join(".git")) {
                Ok(_) => {
                    return GitError::Failed {
                        operation: "discover worktree",
                        stderr: "Git worktree marker exists but discovery failed".into(),
                    };
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return GitError::Io(error),
            }
        }
        return GitError::NotRepository;
    }
    GitError::Failed {
        operation: "discover worktree",
        stderr: "Git worktree discovery failed".into(),
    }
}

/// `scopes` and results are literal worktree-root-relative paths. `start` may be
/// a nested workspace. Tracked paths remain in the result even if ignored or absent.
pub fn list_repository_workspace_files(
    start: &std::path::Path,
    scopes: &[PathBuf],
) -> Result<Vec<PathBuf>, GitError> {
    let root = discover_worktree(start)?;
    list_workspace_files(&root, scopes)
}
