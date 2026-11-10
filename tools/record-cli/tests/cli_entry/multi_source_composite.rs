use super::*;

// These graph regressions must also terminate when invoked directly with cargo.
// Files avoid blocking on help's large key listing before the child exits.
fn graph_help(cwd: &Path, key: &str) -> String {
    use std::{
        io::{Read, Seek},
        process::Stdio,
        time::{Duration, Instant},
    };
    let mut stdout = tempfile::tempfile().unwrap();
    let mut stderr = tempfile::tempfile().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .current_dir(cwd)
        .args(["help", "--key", key])
        .stdout(Stdio::from(stdout.try_clone().unwrap()))
        .stderr(Stdio::from(stderr.try_clone().unwrap()))
        .spawn()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(30);
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break status;
        }
        if Instant::now() >= deadline {
            child.kill().unwrap();
            child.wait().unwrap();
            panic!("source graph help did not terminate within 30 seconds");
        }
        std::thread::sleep(Duration::from_millis(10));
    };
    stdout.rewind().unwrap();
    stderr.rewind().unwrap();
    let mut text = String::new();
    let mut errors = String::new();
    stdout.read_to_string(&mut text).unwrap();
    stderr.read_to_string(&mut errors).unwrap();
    assert_eq!(status.code(), Some(0), "{text}\n{errors}");
    assert!(text.contains(&format!("Selected: {key}")), "{text}");
    assert_eq!(
        text.lines()
            .filter(|line| line.starts_with("  Source: "))
            .count(),
        1
    );
    text
}

#[test]
fn shared_reference_dag_does_not_expand_exponentially() {
    let temp = tempfile::tempdir().unwrap();
    let mut graph = serde_json::Map::new();
    graph.insert(
        "n0".into(),
        json!({"root":".", "investigationsDir":"reports"}),
    );
    // A tree traversal would visit 2^35 leaves; the declared graph has only 36 keys.
    for i in 1..36 {
        graph.insert(
            format!("n{i}"),
            json!([format!("n{}", i - 1), format!("n{}", i - 1)]),
        );
    }
    fs::write(
        temp.path().join(".investigation-report.json"),
        json!({"defaultKey":"n35", "sources":graph}).to_string(),
    )
    .unwrap();
    graph_help(temp.path(), "n35");
}

#[test]
fn deep_reference_chain_does_not_overflow_the_process_stack() {
    let temp = tempfile::tempdir().unwrap();
    let mut chain = serde_json::Map::new();
    chain.insert(
        "k0".into(),
        json!({"root":".", "investigationsDir":"reports"}),
    );
    // This legal sub-1 MiB config reproduced a stack overflow in recursive expansion.
    for i in 1..20_000 {
        chain.insert(format!("k{i}"), json!([format!("k{}", i - 1)]));
    }
    fs::write(
        temp.path().join(".investigation-report.json"),
        json!({"defaultKey":"k19999", "sources":chain}).to_string(),
    )
    .unwrap();
    graph_help(temp.path(), "k19999");
}
