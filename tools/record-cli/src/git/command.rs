use super::*;

pub(super) fn command(
    root: &std::path::Path,
    args: &[&str],
    input: Option<&[u8]>,
) -> Result<Vec<u8>, GitError> {
    use std::process::{Command, Stdio};
    check_git_context()?;
    let mut process = Command::new("git");
    process
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = process.spawn().map_err(GitError::Io)?;
    collect_output(child, input)
}

/// Drain both pipes while sending input, then classify the completed Git process.
fn collect_output(
    mut child: std::process::Child,
    input: Option<&[u8]>,
) -> Result<Vec<u8>, GitError> {
    use std::io::Write;

    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    // Drain both streams while feeding stdin: otherwise a full pipe can deadlock Git.
    let out_thread = std::thread::spawn(move || bounded_output(stdout, 256 * 1024 * 1024));
    let err_thread = std::thread::spawn(move || bounded_output(stderr, 64 * 1024));
    let write_result = input.map(|data| child.stdin.take().expect("piped stdin").write_all(data));
    if matches!(write_result, Some(Err(_))) {
        // Termination is a request; wait below is the evidence of process exit.
        let _ = child.kill();
    }
    let status = child.wait().map_err(GitError::Io);
    let output = out_thread
        .join()
        .map_err(|_| GitError::InvalidOutput("Git stdout reader failed"))?;
    let _diagnostics = err_thread
        .join()
        .map_err(|_| GitError::InvalidOutput("Git stderr reader failed"))??;
    if let Some(Err(error)) = write_result {
        return Err(GitError::Io(error));
    }
    if !status?.success() {
        return Err(GitError::Failed {
            operation: "git command",
            stderr: "Git command failed".to_owned(),
        });
    }
    output
}

fn bounded_output(mut stream: impl std::io::Read, budget: usize) -> Result<Vec<u8>, GitError> {
    let mut output = Vec::new();
    let mut chunk = [0_u8; 8192];
    let mut overflow = false;
    loop {
        let count = stream.read(&mut chunk).map_err(GitError::Io)?;
        if count == 0 {
            break;
        }
        if output.len().saturating_add(count) > budget {
            overflow = true;
        }
        if !overflow {
            output.extend_from_slice(&chunk[..count]);
        }
    }
    if overflow {
        return Err(GitError::InvalidOutput("Git output budget exceeded"));
    }
    Ok(output)
}

/// Refuse environment variables that redirect Git away from the captured worktree.
pub(super) fn check_git_context() -> Result<(), GitError> {
    if [
        "GIT_INDEX_FILE",
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_NAMESPACE",
        "GIT_SHALLOW_FILE",
        "GIT_REPLACE_REF_BASE",
    ]
    .iter()
    .any(|key| std::env::var_os(key).is_some())
    {
        return Err(GitError::InvalidOutput(
            "custom Git context is not supported",
        ));
    }
    Ok(())
}
