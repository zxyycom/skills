//! Git identity, selected-content reads and conditional pending publication.
use std::path::PathBuf;
mod command;
mod revision;
mod selected;
mod workspace;
use command::{command, command_index};
pub use revision::{list_revision_files, read_revision_file};
use selected::read_selected_index;
pub use selected::{ContentSnapshot, read_selected};
pub use workspace::{discover_worktree, list_repository_workspace_files, list_workspace_files};
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingEntry {
    pub path: PathBuf,
    pub mode: u32,
    pub oid: String,
    pub stage: u8,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingSnapshot {
    pub entries: Vec<PendingEntry>,
}
#[derive(Clone, Debug)]
pub struct SelectedBlob {
    pub entry: PendingEntry,
    pub bytes: Vec<u8>,
}

#[derive(Debug)]
pub enum GitError {
    NotRepository,
    Io(std::io::Error),
    Failed {
        operation: &'static str,
        stderr: String,
    },
    InvalidOutput(&'static str),
}
impl std::fmt::Display for GitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}
impl std::error::Error for GitError {}

/// Captures membership and file representation without opening unselected blobs.
/// Publication still needs an independently captured snapshot and index.lock CAS.
pub fn read_pending(root: &std::path::Path) -> Result<PendingSnapshot, GitError> {
    read_pending_index(root, None)
}

fn read_pending_index(
    root: &std::path::Path,
    index: Option<&std::path::Path>,
) -> Result<PendingSnapshot, GitError> {
    let stdout = command_index(
        root,
        &["ls-files", "--stage", "-z", "--full-name"],
        None,
        index,
    )?;
    if !stdout.is_empty() && stdout.last() != Some(&0) {
        return Err(GitError::InvalidOutput("unterminated pending output"));
    }
    let entries = stdout
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(parse_pending_entry)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(PendingSnapshot { entries })
}

fn parse_pending_entry(entry: &[u8]) -> Result<PendingEntry, GitError> {
    let split = entry
        .iter()
        .position(|byte| *byte == b'\t')
        .ok_or(GitError::InvalidOutput("missing index path"))?;
    let (mode, oid, stage) = parse_pending_header(&entry[..split])?;
    let name = std::str::from_utf8(&entry[split + 1..])
        .map_err(|_| GitError::InvalidOutput("non-UTF8 index path"))?;
    if name.is_empty() {
        return Err(GitError::InvalidOutput("empty index path"));
    }
    validate_path(std::path::Path::new(name))?;
    Ok(PendingEntry {
        path: PathBuf::from(name),
        mode,
        oid: oid.to_owned(),
        stage,
    })
}

/// Parse the metadata prefix of one `git ls-files --stage` record.
fn parse_pending_header(header_bytes: &[u8]) -> Result<(u32, &str, u8), GitError> {
    let header = std::str::from_utf8(header_bytes)
        .map_err(|_| GitError::InvalidOutput("invalid index header"))?;
    let mut fields = header.split(' ');
    let mode = u32::from_str_radix(
        fields
            .next()
            .ok_or(GitError::InvalidOutput("missing mode"))?,
        8,
    )
    .map_err(|_| GitError::InvalidOutput("invalid mode"))?;
    let oid = fields
        .next()
        .ok_or(GitError::InvalidOutput("missing oid"))?;
    if !valid_oid(oid) {
        return Err(GitError::InvalidOutput("invalid oid"));
    }
    let stage = fields
        .next()
        .ok_or(GitError::InvalidOutput("missing stage"))?
        .parse::<u8>()
        .map_err(|_| GitError::InvalidOutput("invalid stage"))?;
    if stage > 3 || fields.next().is_some() {
        return Err(GitError::InvalidOutput("invalid stage header"));
    }
    Ok((mode, oid, stage))
}

/// Reject subdirectory roots: pending paths are always relative to the worktree root.
pub fn verify_worktree_root(root: &std::path::Path) -> Result<(), GitError> {
    let discovered = discover_worktree(root)?;
    if discovered != root.canonicalize().map_err(GitError::Io)? {
        return Err(GitError::InvalidOutput("root is not Git worktree root"));
    }
    Ok(())
}

/// A fixed commit identity, not a moving ref.
pub fn head(root: &std::path::Path) -> Result<String, GitError> {
    let output = command(root, &["rev-parse", "--verify", "HEAD^{commit}"], None)?;
    let oid = std::str::from_utf8(&output)
        .map_err(|_| GitError::InvalidOutput("invalid HEAD"))?
        .trim();
    if !valid_oid(oid) {
        return Err(GitError::InvalidOutput("invalid HEAD"));
    }
    Ok(oid.to_owned())
}

/// Git object identities are lowercase hexadecimal SHA-1 or SHA-256 values.
fn valid_oid(oid: &str) -> bool {
    matches!(oid.len(), 40 | 64)
        && oid
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

/// Read a Git object payload and bind it to its advertised object ID.
fn read_blob(root: &std::path::Path, oid: &str) -> Result<Vec<u8>, GitError> {
    let bytes = command(root, &["cat-file", "blob", oid], None)?;
    let actual = command(root, &["hash-object", "--stdin"], Some(&bytes))?;
    if actual != format!("{oid}\n").as_bytes() {
        return Err(GitError::InvalidOutput("blob identity mismatch"));
    }
    Ok(bytes)
}

fn validate_path(path: &std::path::Path) -> Result<(), GitError> {
    use std::path::Component;
    let text = path
        .to_str()
        .ok_or(GitError::InvalidOutput("non-UTF8 path"))?;
    if text.is_empty()
        || text.contains('\\')
        || text.contains('\0')
        || text
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(GitError::InvalidOutput("invalid relative path"));
    }
    Ok(())
}

/// Convert a validated local relative path to Git's slash-separated spelling.
fn git_path(path: &std::path::Path) -> Result<String, GitError> {
    let text = path
        .to_str()
        .ok_or(GitError::InvalidOutput("non-UTF8 path"))?;
    let text = text.to_owned();
    validate_path(std::path::Path::new(&text))?;
    Ok(text)
}

pub mod publish;

/// HEAD is unborn only when HEAD is a valid symbolic branch whose ref is
/// confirmed absent. Broken metadata, inaccessible objects and tool errors fail.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HeadState {
    Commit(String),
    Unborn,
}
pub fn probe_head(root: &std::path::Path) -> Result<HeadState, GitError> {
    let discovered = discover_worktree(root)?;
    match head(&discovered) {
        Ok(oid) => return Ok(HeadState::Commit(oid)),
        Err(GitError::Failed { .. }) => {}
        Err(error) => return Err(error),
    }
    confirm_unborn(&discovered)
}

/// Confirm the missing branch and re-read both identities before reporting unborn.
fn confirm_unborn(root: &std::path::Path) -> Result<HeadState, GitError> {
    let symbolic = symbolic_head_branch(root)?;
    let branch = symbolic
        .strip_suffix('\n')
        .expect("validated symbolic HEAD");
    if branch_ref_absent(root, branch)? {
        if command(root, &["symbolic-ref", "--quiet", "HEAD"], None)? != symbolic.as_bytes()
            || !branch_ref_absent(root, branch)?
        {
            return Err(GitError::InvalidOutput("HEAD changed during probe"));
        }
        Ok(HeadState::Unborn)
    } else {
        Err(GitError::Failed {
            operation: "probe HEAD",
            stderr: "HEAD cannot be resolved as an unborn branch".into(),
        })
    }
}

/// Read and validate the symbolic branch name before probing its ref.
fn symbolic_head_branch(root: &std::path::Path) -> Result<String, GitError> {
    let symbolic = command(root, &["symbolic-ref", "--quiet", "HEAD"], None)?;
    let symbolic = std::str::from_utf8(&symbolic)
        .map_err(|_| GitError::InvalidOutput("invalid symbolic HEAD"))?;
    let branch = symbolic
        .strip_suffix('\n')
        .ok_or(GitError::InvalidOutput("unterminated symbolic HEAD"))?;
    if !branch.starts_with("refs/heads/") || branch.contains(['\r', '\n']) {
        return Err(GitError::InvalidOutput("HEAD does not name a branch"));
    }
    command(root, &["check-ref-format", branch], None)?;
    Ok(symbolic.to_owned())
}

/// Distinguish an absent branch from an existing ref or a Git failure.
fn branch_ref_absent(root: &std::path::Path, branch: &str) -> Result<bool, GitError> {
    let status = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["show-ref", "--verify", "--quiet", branch])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(GitError::Io)?;
    match status.code() {
        Some(1) => Ok(true),
        Some(0) => Ok(false),
        _ => Err(GitError::Failed {
            operation: "probe HEAD",
            stderr: "branch reference check failed".into(),
        }),
    }
}

/// Read the effective file-mode policy once per acquisition phase.
pub fn core_file_mode(root: &std::path::Path) -> Result<bool, GitError> {
    match command(
        root,
        &[
            "config",
            "--type=bool",
            "--default=true",
            "--get",
            "core.filemode",
        ],
        None,
    )?
    .as_slice()
    {
        b"true\n" => Ok(true),
        b"false\n" => Ok(false),
        _ => Err(GitError::InvalidOutput("invalid core.fileMode")),
    }
}
/// Derive the regular-file representation from a fresh safe source capture and
/// the same phase's pending identities. This does not read the source again.
pub fn workspace_file_mode(
    source: &crate::source::SourceSnapshot,
    pending: &PendingSnapshot,
    file_mode: bool,
) -> Result<u32, GitError> {
    if file_mode {
        #[cfg(unix)]
        {
            return Ok(if source.identity.mode & 0o100 != 0 {
                0o100755
            } else {
                0o100644
            });
        }
    }
    let mut matches = pending
        .entries
        .iter()
        .filter(|entry| entry.path == source.path.as_path());
    match (matches.next(), matches.next()) {
        (None, None) => Ok(0o100644),
        (Some(entry), None) if entry.stage == 0 && matches!(entry.mode, 0o100644 | 0o100755) => {
            Ok(entry.mode)
        }
        _ => Err(GitError::InvalidOutput(
            "pending mode basis is not a unique regular file",
        )),
    }
}

#[cfg(test)]
mod tests;
