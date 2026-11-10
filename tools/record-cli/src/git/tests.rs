use super::*;

/// Create a private fixed Git baseline from the tool-owned raw fixture tree.
fn baseline(object_format: &str) -> tempfile::TempDir {
    fn copy_tree(from: &std::path::Path, to: &std::path::Path) {
        for entry in std::fs::read_dir(from).unwrap() {
            let entry = entry.unwrap();
            let target = to.join(entry.file_name());
            if entry.file_type().unwrap().is_dir() {
                std::fs::create_dir(&target).unwrap();
                copy_tree(&entry.path(), &target);
            } else {
                std::fs::copy(entry.path(), target).unwrap();
            }
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let raw = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/git/fixtures/baseline");
    copy_tree(&raw, dir.path());
    git_fixture(
        dir.path(),
        &["init", "-q", &format!("--object-format={object_format}")],
    );
    git_fixture(
        dir.path(),
        &["config", "user.email", "fixture@example.invalid"],
    );
    git_fixture(dir.path(), &["config", "user.name", "Fixture"]);
    git_fixture(dir.path(), &["add", "--all"]);
    git_fixture(dir.path(), &["commit", "-qm", "fixture"]);
    dir
}

fn git_fixture(root: &std::path::Path, args: &[&str]) -> Vec<u8> {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}

#[test]
fn pending_record_parses_representation_and_rejects_invalid_identity_or_path() {
    assert!(valid_oid(&"a".repeat(40)));
    assert!(valid_oid(&"0".repeat(64)));
    assert!(!valid_oid(&"a".repeat(39)));
    assert!(!valid_oid(&"A".repeat(40)));
    assert!(!valid_oid(&"g".repeat(40)));
    let oid = "a".repeat(40);
    let record = format!("100755 {oid} 0\tdocs/record.md");
    let parsed = parse_pending_entry(record.as_bytes()).unwrap();
    assert_eq!(parsed.path, PathBuf::from("docs/record.md"));
    assert_eq!(parsed.mode, 0o100755);
    assert_eq!(parsed.oid, oid);
    assert_eq!(parsed.stage, 0);

    for malformed in [
        format!("100644 {} 0\tdocs/x", "A".repeat(40)),
        format!("100644 {} 4\tdocs/x", "a".repeat(40)),
        format!("100644 {} 0\t../x", "a".repeat(40)),
        format!("100644 {} 0 extra\tdocs/x", "a".repeat(40)),
    ] {
        assert!(
            parse_pending_entry(malformed.as_bytes()).is_err(),
            "{malformed}"
        );
    }
}

#[test]
fn local_paths_convert_to_git_spelling_without_weakening_raw_output_validation() {
    let local = PathBuf::from("docs").join("nested").join("record.md");
    assert_eq!(git_path(&local).unwrap(), "docs/nested/record.md");
    for invalid in [
        "",
        "../record.md",
        "docs/../record.md",
        "/absolute",
        "docs//record.md",
    ] {
        assert!(
            git_path(std::path::Path::new(invalid)).is_err(),
            "{invalid}"
        );
    }
    assert_raw_git_paths();
    #[cfg(windows)]
    assert_eq!(
        git_path(std::path::Path::new(r"docs\record.md")).unwrap(),
        "docs/record.md"
    );
    #[cfg(not(windows))]
    {
        assert!(git_path(std::path::Path::new(r"docs\record.md")).is_err());
        for valid in [
            "docs/file:stream",
            "docs/NUL",
            "docs/con.txt",
            "docs/Lpt1.log",
        ] {
            assert_eq!(git_path(std::path::Path::new(valid)).unwrap(), valid);
        }
    }
}

/// Raw Git records retain their own POSIX path validation, independent of local paths.
fn assert_raw_git_paths() {
    let oid = "a".repeat(40);
    for name in [r"docs\record.md", r"docs\..\record.md"] {
        let record = format!("100644 {oid} 0\t{name}");
        assert!(parse_pending_entry(record.as_bytes()).is_err(), "{name}");
    }
    for name in ["docs/file:stream", "docs/NUL", "docs/con.txt"] {
        let record = format!("100644 {oid} 0\t{name}");
        assert!(parse_pending_entry(record.as_bytes()).is_ok(), "{name}");
    }
}

#[test]
fn batch_reads_only_selected_objects_and_literal_scopes() {
    use std::fs;
    let dir = baseline("sha1");
    let root = dir.path();
    let revision = head(root).unwrap();
    let paths: Vec<_> = (0..3)
        .map(|i| PathBuf::from(format!("space 中文/{i:03} [x].md")))
        .collect();
    let selected = read_selected(root, &paths).unwrap();
    assert_eq!(selected.blobs().len(), 3);
    assert!(
        selected
            .blobs()
            .iter()
            .all(|(_, bytes)| bytes == b"same content")
    );
    let historical = read_revision_files(root, &revision, &paths).unwrap();
    assert_eq!(historical.len(), 3);
    assert_eq!(
        list_revision_files(root, &revision, &[paths[0].clone(), paths[0].clone()])
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        list_workspace_files(root, &[paths[0].clone(), paths[0].clone()]).unwrap(),
        vec![paths[0].clone()]
    );
    let oid = String::from_utf8(git_fixture(root, &["rev-parse", "HEAD:unselected"])).unwrap();
    let oid = oid.trim();
    let object = root.join(".git/objects").join(&oid[..2]).join(&oid[2..]);
    fs::remove_file(object).unwrap();
    assert_eq!(
        read_revision_files(root, &revision, &paths).unwrap().len(),
        3
    );
    assert!(read_revision_files(root, &revision, &[PathBuf::from("unselected")]).is_err());
    assert!(read_selected(root, &[PathBuf::from("unselected")]).is_err());
    assert!(read_revision_files(root, &revision, &[PathBuf::from("space 中文")]).is_err());
}

#[test]
fn batch_parser_rejects_bad_protocol_and_forged_payload() {
    let sha1 = "ce013625030ba8dba906f756967f9e9ca394464a".to_owned();
    let sha256 = "2cf8d83d9ee29543b34a87727421fdecb7e3f3a183d337639025de576db9ebb4".to_owned();
    for oid in [&sha1, &sha256] {
        let valid = format!("{oid} blob 6\nhello\n\n");
        assert_eq!(
            parse_batch(&[oid], valid.as_bytes()).unwrap()[oid],
            b"hello\n"
        );
        for invalid in [
            format!("{oid} blob 6"),
            format!("{oid} tree 6\nhello\n\n"),
            format!("{} blob 6\nhello\n\n", "0".repeat(oid.len())),
            format!("{oid} blob -1\nhello\n\n"),
            format!("{oid} blob 999999999999999999999999999999\nhello\n\n"),
            format!("{oid} blob 7\nhello\n\n"),
            format!("{oid} blob 6\nhello\n"),
            format!("{oid} blob 6\nhello!\n"),
            format!("{oid} blob 6\nhello\n\nextra"),
            format!("{oid} blob 6 extra\nhello\n\n"),
        ] {
            assert!(
                parse_batch(&[oid], invalid.as_bytes()).is_err(),
                "{invalid:?}"
            );
        }
        assert!(parse_batch(&[oid, oid], valid.as_bytes()).is_err());
    }
}

#[test]
fn sha256_batch_and_budget_fallback_preserve_selected_content() {
    let dir = baseline("sha256");
    let root = dir.path();
    let expected = "2cf8d83d9ee29543b34a87727421fdecb7e3f3a183d337639025de576db9ebb4";
    let pending = read_pending(root).unwrap();
    assert_eq!(
        pending
            .entries
            .iter()
            .find(|e| e.path == std::path::Path::new("first"))
            .unwrap()
            .oid,
        expected
    );
    let paths = vec![PathBuf::from("first"), PathBuf::from("second")];
    let selected = read_selected(root, &paths).unwrap();
    assert_eq!(selected.blobs().len(), 2);
    let revision = head(root).unwrap();
    assert_eq!(
        read_revision_files(root, &revision, &paths).unwrap()[&paths[0]].1,
        b"hello\n"
    );
    let oids: Vec<_> = paths
        .iter()
        .map(|path| {
            pending
                .entries
                .iter()
                .find(|entry| &entry.path == path)
                .unwrap()
                .oid
                .clone()
        })
        .collect();
    let input = format!("{}\n{}\n", oids[0], oids[1]);
    assert!(matches!(
        command::command_with_budget(root, &["cat-file", "--batch"], Some(input.as_bytes()), 32),
        Err(GitError::OutputBudgetExceeded)
    ));
    let recovered = read_blobs_with_budget(root, &oids, 32).unwrap();
    assert_eq!(recovered.len(), 2);
    assert_eq!(recovered[expected], b"hello\n");
}

#[test]
fn scope_batch_budget_falls_back_to_each_literal_pattern() {
    let dir = baseline("sha1");
    let root = dir.path();
    let head = head(root).unwrap();
    let patterns = vec![
        ":(top,literal)first [x]".to_owned(),
        ":(top,literal)second 中文".to_owned(),
    ];
    let tree = ["ls-tree", "-r", "-z", "--full-tree", head.as_str(), "--"];
    let workspace = [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--full-name",
        "--",
    ];
    for prefix in [&tree[..], &workspace[..]] {
        let single: Vec<_> = patterns
            .iter()
            .map(|pattern| {
                let mut args = prefix.to_vec();
                args.push(pattern);
                command(root, &args, None).unwrap()
            })
            .collect();
        let budget = single.iter().map(Vec::len).max().unwrap();
        let mut args = prefix.to_vec();
        args.extend(patterns.iter().map(String::as_str));
        assert!(matches!(
            command::command_with_budget(root, &args, None, budget),
            Err(GitError::OutputBudgetExceeded)
        ));
        let mut recovered = Vec::new();
        command_patterns(root, prefix, &patterns, budget, |bytes| {
            recovered.push(bytes.to_vec());
            Ok(())
        })
        .unwrap();
        assert_eq!(recovered, single);
    }
    let scopes = vec![PathBuf::from("first [x]"), PathBuf::from("second 中文")];
    assert_eq!(list_workspace_files(root, &scopes).unwrap().len(), 2);
    assert_eq!(list_revision_files(root, &head, &scopes).unwrap().len(), 2);
    assert_eq!(read_revision_files(root, &head, &scopes).unwrap().len(), 2);
}

#[test]
fn selected_pending_preserves_first_failure_before_later_conflict() {
    use std::{
        fs,
        io::Write,
        process::{Command, Stdio},
    };
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    let git = |args: &[&str]| {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        output.stdout
    };
    git(&["init", "-q"]);
    fs::write(root.join("a"), b"earlier object").unwrap();
    fs::write(root.join("b"), b"later conflict").unwrap();
    git(&["add", "--all"]);
    let first = String::from_utf8(git(&["rev-parse", ":a"])).unwrap();
    let later = String::from_utf8(git(&["rev-parse", ":b"])).unwrap();
    git(&["update-index", "--force-remove", "b"]);
    let mut child = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["update-index", "--index-info"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    write!(
        child.stdin.take().unwrap(),
        "100644 {} 1\tb\n100644 {} 2\tb\n",
        later.trim(),
        later.trim()
    )
    .unwrap();
    assert!(child.wait().unwrap().success());
    let oid = first.trim();
    let object = root.join(".git/objects").join(&oid[..2]).join(&oid[2..]);
    let bytes = fs::read(&object).unwrap();
    fs::remove_file(&object).unwrap();
    let paths = vec![PathBuf::from("a"), PathBuf::from("b")];
    assert!(matches!(
        read_selected(root, &paths),
        Err(GitError::Failed { .. })
    ));
    fs::write(object, bytes).unwrap();
    assert!(matches!(
        read_selected(root, &paths),
        Err(GitError::InvalidOutput(
            "selected pending entry is not a unique file"
        ))
    ));
}

#[test]
fn sha1_collision_detection_is_enabled_and_rejected() {
    let sample = include_bytes!("fixtures/sha-mbles-1.bin");
    assert!(matches!(
        batch::checked_sha1(b"", sample),
        Err(GitError::InvalidOutput("SHA-1 collision detected"))
    ));
    assert_eq!(
        batch::checked_sha1(b"blob 6\0", b"hello\n").unwrap(),
        "ce013625030ba8dba906f756967f9e9ca394464a"
    );
}
