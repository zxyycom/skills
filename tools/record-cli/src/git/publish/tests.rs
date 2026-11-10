use super::*;
use std::{
    fs,
    io::Write,
    process::{Command, Stdio},
    sync::Mutex,
};

fn git(root: &Path, args: &[&str], input: Option<&[u8]>) -> Vec<u8> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    if let Some(bytes) = input {
        child.stdin.take().unwrap().write_all(bytes).unwrap();
    }
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}

fn fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-q"], None);
    fs::write(dir.path().join("keep"), b"unselected pending").unwrap();
    git(dir.path(), &["add", "keep"], None);
    dir
}

fn updates(count: usize) -> Vec<PendingUpdate> {
    (0..count)
        .map(|i| PendingUpdate {
            path: PathBuf::from(format!("selected-{i:03}")),
            file: Some(PendingFile {
                mode: 0o100644,
                bytes: format!("content-{}", i % 10).into_bytes(),
            }),
        })
        .collect()
}

#[test]
fn concurrent_preparation_preserves_pending_and_deduplicates_content() {
    for count in [2, 20] {
        let dir = fixture();
        let root = dir.path();
        let updates = updates(count);
        let paths = updates
            .iter()
            .map(|update| update.path.clone())
            .collect::<Vec<_>>();
        let snapshot = super::super::read_selected(root, &paths).unwrap();
        let targets = validate_updates(&snapshot, &updates).unwrap();
        let changed = targets.into_iter().collect::<Vec<_>>();
        assert_eq!(unique_content(&changed).len(), count.min(10));
        let prior_keep = snapshot
            .membership()
            .entries
            .iter()
            .find(|entry| entry.path == Path::new("keep"))
            .unwrap()
            .clone();
        let result = replace_selected(root, &snapshot, &updates).unwrap();
        assert_eq!(result.changed_paths.len(), count);
        assert_eq!(
            result
                .pending_after
                .entries
                .iter()
                .find(|entry| entry.path == Path::new("keep")),
            Some(&prior_keep)
        );
        let selected = super::super::read_selected(root, &paths).unwrap();
        for update in &updates {
            let blob = selected
                .blobs()
                .iter()
                .find(|(path, _)| path == &update.path)
                .unwrap();
            assert_eq!(blob.1, update.file.as_ref().unwrap().bytes);
            let expected_oid =
                String::from_utf8(git(root, &["hash-object", "--stdin"], Some(&blob.1))).unwrap();
            let entry = result
                .pending_after
                .entries
                .iter()
                .find(|entry| entry.path == update.path)
                .unwrap();
            assert_eq!(entry.oid, expected_oid.trim());
            assert_eq!(entry.mode, update.file.as_ref().unwrap().mode);
        }
        if count == 20 {
            let entries = &result.pending_after.entries;
            assert_eq!(
                entries.iter().find(|e| e.path == paths[0]).unwrap().oid,
                entries.iter().find(|e| e.path == paths[10]).unwrap().oid
            );
        }
    }
}

#[test]
fn workers_finish_and_report_first_input_error() {
    let values: Vec<Vec<u8>> = (0..12).map(|i| vec![i]).collect();
    let refs = values.iter().map(Vec::as_slice).collect::<Vec<_>>();
    let completed = Mutex::new(Vec::new());
    let result = prepare_objects(&refs, |bytes| {
        completed.lock().unwrap().push(bytes[0]);
        match bytes[0] {
            2 | 5 => Err(failed(FailureKind::Failed, format!("failure {}", bytes[0]))),
            _ => Ok(bytes[0].to_string()),
        }
    })
    .unwrap_err();
    assert_eq!(result.detail, "failure 2");
    assert_eq!(completed.lock().unwrap().len(), 12);
    let panic_result = prepare_objects(&refs, |bytes| {
        assert_ne!(bytes[0], 3, "fixture panic");
        Ok("ok".into())
    })
    .unwrap_err();
    assert_eq!(panic_result.kind, FailureKind::Failed);
    assert!(panic_result.detail.contains("panicked"));
}

#[test]
fn object_write_failure_does_not_change_index() {
    let dir = fixture();
    let root = dir.path();
    let updates = updates(20);
    let paths = updates
        .iter()
        .map(|update| update.path.clone())
        .collect::<Vec<_>>();
    let snapshot = super::super::read_selected(root, &paths).unwrap();
    let index = root.join(".git/index");
    let before = fs::read(&index).unwrap();
    let bytes = &updates[0].file.as_ref().unwrap().bytes;
    let oid = String::from_utf8(git(root, &["hash-object", "--stdin"], Some(bytes))).unwrap();
    let dir = root.join(".git/objects").join(&oid[..2]);
    assert!(!dir.exists());
    fs::write(&dir, b"block object directory").unwrap();
    let error = replace_selected(root, &snapshot, &updates).unwrap_err();
    assert_eq!(error.kind, FailureKind::Failed);
    assert_eq!(fs::read(index).unwrap(), before);
}
