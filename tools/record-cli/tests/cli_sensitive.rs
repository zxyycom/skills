#[cfg(unix)]
#[test]
fn investigation_stage_cli_hides_git_stderr_on_failure() {
    use std::{fs, os::unix::fs::PermissionsExt, process::Command};
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    let git = |args: &[&str]| {
        let output = Command::new("git")
            .current_dir(root)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    };
    git(&["init", "-q"]);
    git(&["config", "user.name", "Fixture"]);
    git(&["config", "user.email", "fixture@example.invalid"]);
    fs::write(root.join("baseline"), b"baseline\n").unwrap();
    git(&["add", "baseline"]);
    git(&["commit", "-qm", "baseline"]);
    let fake = tempfile::tempdir().unwrap();
    let executable = fake.path().join("git");
    const SENTINEL: &str = "harmless_fake_token_8b4e91";
    fs::write(
        &executable,
        format!(
            "#!/bin/sh\necho called > '{}'\necho {SENTINEL} >&2\nexit 1\n",
            fake.path().join("called").display()
        ),
    )
    .unwrap();
    fs::set_permissions(&executable, fs::Permissions::from_mode(0o755)).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args([
            "stage",
            "240229-alpha",
            "--scope",
            "index",
            "--root",
            root.to_str().unwrap(),
            "--json",
        ])
        .env("PATH", fake.path())
        .output()
        .unwrap();
    assert!(!output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(!stdout.contains(SENTINEL), "{stdout}");
    assert!(!stderr.contains(SENTINEL), "{stderr}");
    let result: serde_json::Value = serde_json::from_str(&stdout).unwrap();
    assert_eq!(result["ok"], false);
    assert!(fake.path().join("called").is_file());
    assert!(stdout.contains("Git worktree discovery failed"), "{stdout}");
}
