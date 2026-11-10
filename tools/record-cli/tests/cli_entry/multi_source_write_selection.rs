use super::*;

fn new_args<'a>(extra: &[&'a str]) -> Vec<&'a str> {
    let mut args = vec![
        "new",
        "261110-keyed",
        "--formed-at",
        "2026-11-10T00:00:00Z",
        "--title",
        "Title",
        "--question",
        "Question",
        "--tag",
        "test",
        "--json",
    ];
    args.extend_from_slice(extra);
    args
}

fn tree_snapshot(root: &Path) -> Vec<(std::path::PathBuf, Option<Vec<u8>>)> {
    fn visit(root: &Path, dir: &Path, entries: &mut Vec<(std::path::PathBuf, Option<Vec<u8>>)>) {
        for entry in fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                entries.push((path.strip_prefix(root).unwrap().to_owned(), None));
                visit(root, &path, entries);
            } else {
                entries.push((
                    path.strip_prefix(root).unwrap().to_owned(),
                    Some(fs::read(&path).unwrap()),
                ));
            }
        }
    }
    let mut entries = Vec::new();
    visit(root, root, &mut entries);
    entries.sort();
    entries
}

#[test]
fn composite_write_and_preflight_rejection_leave_the_whole_fixture_unchanged() {
    let temp = setup();
    let before = tree_snapshot(temp.path());
    for args in [
        new_args(&["--key", "related"]),
        vec!["sync-index", "--key", "related", "--preflight", "--json"],
    ] {
        let output = invoke(temp.path(), &args);
        assert_eq!(output.status.code(), Some(1));
        let value = parse(&output);
        assert_eq!(value["ok"], false);
        assert_eq!(value["error"]["code"], "config-error");
        assert!(
            value["error"]["message"]
                .as_str()
                .unwrap()
                .contains("exactly one source")
        );
        assert_eq!(tree_snapshot(temp.path()), before);
    }
}

#[test]
fn explicit_single_source_key_writes_only_to_its_target() {
    let temp = setup();
    fs::write(
        temp.path().join(".investigation-report.json"),
        json!({"sources":{"one":{"root":"first","investigationsDir":"research/reports"}}})
            .to_string(),
    )
    .unwrap();
    successful(&invoke(temp.path(), &new_args(&["--key", "one"])));
    assert!(
        temp.path()
            .join("first/research/reports/_candidate.261110-keyed")
            .is_file()
    );
    assert!(
        !temp
            .path()
            .join("second/notes/reports/_candidate.261110-keyed")
            .exists()
    );
    assert!(!temp.path().join("docs").exists());
}

#[test]
fn equivalent_root_aliases_deduplicate_before_write_selection() {
    let temp = setup();
    let cwd = temp.path();
    fs::write(cwd.join(".investigation-report.json"), json!({"sources":{"project":{"root":"first","investigationsDir":"research/reports"},"aliases":["project","local"]}}).to_string()).unwrap();
    fs::write(cwd.join(".local/.investigation-report.local.json"), json!({"defaultKey":"aliases","sources":{"local":{"root":"../first","investigationsDir":"research/reports"}}}).to_string()).unwrap();
    successful(&invoke(cwd, &new_args(&["--key", "aliases"])));
    assert!(
        cwd.join("first/research/reports/_candidate.261110-keyed")
            .is_file()
    );
    assert!(
        !cwd.join("second/notes/reports/_candidate.261110-keyed")
            .exists()
    );
}

#[test]
fn same_collection_directory_under_different_roots_remains_two_sources() {
    let temp = setup();
    fs::write(temp.path().join("workspaces.json"), json!({"defaultKey":"distinct","sources":{"distinct":[{"root":".","investigationsDir":"first/research/reports"},{"root":"first","investigationsDir":"research/reports"}]}}).to_string()).unwrap();
    let value = successful(&invoke(
        temp.path(),
        &["list", "--config", "workspaces.json", "--json"],
    ));
    let sources = value["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    assert_ne!(sources[0]["root"], sources[1]["root"]);
    for source in sources {
        assert_eq!(source["result"]["entries"][0]["id"], "260101-a");
    }
}

#[cfg(unix)]
#[test]
fn source_write_preserves_symlink_parent_traversal_semantics() {
    use std::os::unix::fs::symlink;
    let temp = tempfile::tempdir().unwrap();
    let cwd = temp.path();
    fs::create_dir_all(cwd.join("remote/child")).unwrap();
    fs::create_dir_all(cwd.join("remote/reports")).unwrap();
    symlink(cwd.join("remote/child"), cwd.join("link")).unwrap();
    fs::write(cwd.join(".investigation-report.json"), json!({"defaultKey":"linked","sources":{"linked":{"root":"link/..","investigationsDir":"reports"}}}).to_string()).unwrap();
    successful(&invoke(cwd, &new_args(&["--key", "linked"])));
    assert!(cwd.join("remote/reports/_candidate.261110-keyed").is_file());
    assert!(!cwd.join("reports").exists());
}

#[test]
fn writes_without_key_ignore_the_read_default_key() {
    let temp = setup();
    successful(&invoke(temp.path(), &new_args(&[])));
    assert!(
        temp.path()
            .join("docs/investigations/_candidate.261110-keyed")
            .is_file()
    );
    assert!(
        !temp
            .path()
            .join("first/research/reports/_candidate.261110-keyed")
            .exists()
    );
    assert!(
        !temp
            .path()
            .join("second/notes/reports/_candidate.261110-keyed")
            .exists()
    );
}

#[cfg(unix)]
#[test]
fn source_write_preserves_non_utf8_working_directory_identity() {
    use std::{ffi::OsString, os::unix::ffi::OsStringExt};
    let temp = tempfile::tempdir().unwrap();
    let cwd = temp
        .path()
        .join(OsString::from_vec(b"workspace-\xff".to_vec()));
    let confusable = temp.path().join("workspace-\u{fffd}");
    fs::create_dir(&cwd).unwrap();
    fs::create_dir(&confusable).unwrap();
    fs::write(
        cwd.join(".investigation-report.json"),
        json!({"defaultKey":"one","sources":{"one":{"root":".","investigationsDir":"reports"}}})
            .to_string(),
    )
    .unwrap();
    let sibling_before = tree_snapshot(&confusable);
    successful(&invoke(&cwd, &new_args(&["--key", "one"])));
    assert!(cwd.join("reports/_candidate.261110-keyed").is_file());
    assert_eq!(tree_snapshot(&confusable), sibling_before);
}
