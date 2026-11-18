use super::*;

fn run_literal(root: &Path, command: &str, value: &str) -> Value {
    let out = Command::new(env!("CARGO_BIN_EXE_resource-records"))
        .args([command, "--root"])
        .arg(root)
        .args(["--json", "--", value])
        .output()
        .unwrap();
    let v: Value = serde_json::from_slice(&out.stdout).unwrap_or_else(|_| {
        panic!(
            "stdout: {} stderr: {}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        )
    });
    assert!(out.status.success(), "{v}");
    v
}

fn literal_fixture() -> tempfile::TempDir {
    let d = fixture();
    write(
        d.path(),
        "dash",
        "---\nschemaVersion: 1\nkind: collection\nid: -Base\ntitle: dash\n---\nline one\nline two --help\n",
    );
    assert!(run(d.path(), &["sync-index"]).0.status.success());
    d
}

#[test]
fn dash_prefixed_id_is_a_valid_positional() {
    let d = literal_fixture();
    assert_eq!(
        run_literal(d.path(), "show", "-Base")["result"]["record"]["id"],
        "-Base"
    );
}

#[test]
fn help_text_can_be_a_literal_search_term() {
    let d = literal_fixture();
    assert_eq!(
        run_literal(d.path(), "search", "--help")["result"]["total"],
        1
    );
}

#[test]
fn literal_search_matches_across_lines() {
    let d = literal_fixture();
    assert_eq!(
        run(d.path(), &["search", "line one\nline two"]).1["result"]["total"],
        1
    );
}

#[test]
fn closed_stdout_after_sync_reports_committed_state_without_panic() {
    use std::process::Stdio;
    let d = fixture();
    let p = d.path();
    for replacement in [false, true] {
        if replacement {
            let base = p.join("resources/records/base.md");
            let text = fs::read_to_string(&base).unwrap();
            fs::write(base, text.replace("底图正文", "更新正文")).unwrap();
        }
        let (reader, writer) = std::io::pipe().unwrap();
        drop(reader);
        let child = Command::new(env!("CARGO_BIN_EXE_resource-records"))
            .arg("sync-index")
            .arg("--root")
            .arg(p)
            .arg("--json")
            .stdout(Stdio::from(writer))
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let out = child.wait_with_output().unwrap();
        let err = String::from_utf8_lossy(&out.stderr);
        assert_ne!(out.status.code(), Some(101), "must not panic: {err}");
        assert!(!out.status.success(), "closed output must be reported");
        assert!(
            err.contains("index") && (err.contains("committed") || err.contains("unchanged")),
            "must report committed index state: {err}"
        );
        assert!(
            err.contains("check") || err.contains("sync-index"),
            "must suggest how to confirm or recover index state: {err}"
        );
        assert!(run(p, &["check"]).0.status.success());
    }
}
