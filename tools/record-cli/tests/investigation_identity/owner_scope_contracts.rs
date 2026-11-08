use super::*;
use std::fs;

fn discard() -> Action {
    Action::Discard {
        confirm_recorded: true,
        delete_owned_resources: true,
    }
}
fn rename(target: &str) -> Action {
    Action::Rename {
        target: target.into(),
        confirm_recorded_report: false,
        confirm_recorded_candidate: false,
    }
}
fn setup() -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    fs::create_dir_all(c.join("_resources/261106-old/nested")).unwrap();
    fs::write(c.join("_resources/261106-old/nested/file.txt"), b"evidence").unwrap();
    (dir, c)
}
#[test]
fn formal_discard_ignores_unselected_invalid_candidate() {
    let (dir, c) = setup();
    publish_fixture(&c, &[("261106-old", "old.md", report("261106-old", true))]);
    for candidate in [
        "not valid frontmatter".to_owned(),
        report("261106-other", false).replace(
            "relations: []",
            "relations:\n  - type: \"复查\"\n    target: \"261106-old\"\n    summary: \"Reason\"",
        ),
    ] {
        fs::write(c.join("_candidate.other"), &candidate).unwrap();
        let out = run(dir.path(), &mut op(discard()));
        assert!(out.errors.is_empty(), "{:?}", out.errors);
        assert!(out.committed);
        assert!(!c.join("old.md").exists());
        assert!(!c.join("_resources/261106-old").exists());
        assert_eq!(
            fs::read_to_string(c.join("_candidate.other")).unwrap(),
            candidate
        );
        fs::create_dir_all(c.join("_resources/261106-old/nested")).unwrap();
        fs::write(c.join("_resources/261106-old/nested/file.txt"), b"evidence").unwrap();
        publish_fixture(&c, &[("261106-old", "old.md", report("261106-old", true))]);
    }
}
#[test]
fn candidate_discard_ignores_unselected_formal_body_changes() {
    let (dir, c) = setup();
    publish_fixture(
        &c,
        &[("261106-other", "other.md", report("261106-other", false))],
    );
    fs::write(c.join("other.md"), b"invalid body").unwrap();
    fs::write(c.join("_candidate.old"), report("261106-old", true)).unwrap();
    let index = fs::read(c.join("investigation-index.json")).unwrap();
    let out = run(dir.path(), &mut op(discard()));
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert!(!c.join("_candidate.old").exists());
    assert!(!c.join("_resources/261106-old").exists());
    assert_eq!(fs::read(c.join("other.md")).unwrap(), b"invalid body");
    assert_eq!(fs::read(c.join("investigation-index.json")).unwrap(), index);
}
#[cfg(unix)]
#[test]
fn unsafe_owner_members_block_discard_and_rename_without_writes() {
    use std::os::unix::fs::symlink;
    for illegal in [false, true] {
        for action in [discard(), rename("new")] {
            let (dir, c) = setup();
            let text = report("261106-old", true);
            fs::write(c.join("_candidate.old"), &text).unwrap();
            let unsafe_path =
                c.join("_resources/261106-old")
                    .join(if illegal { "bad%name" } else { "link" });
            if illegal {
                fs::write(&unsafe_path, b"unsafe").unwrap();
            } else {
                symlink("nested/file.txt", &unsafe_path).unwrap();
            }
            let out = run(dir.path(), &mut op(action));
            assert!(!out.committed, "{:?}", out.errors);
            assert!(!out.errors.is_empty());
            assert_eq!(fs::read_to_string(c.join("_candidate.old")).unwrap(), text);
            assert!(fs::symlink_metadata(&unsafe_path).is_ok());
            assert_eq!(
                fs::read(c.join("_resources/261106-old/nested/file.txt")).unwrap(),
                b"evidence"
            );
            assert!(!c.join("_candidate.new").exists());
        }
    }
}
#[test]
fn discard_rejects_broken_split_closure() {
    let (dir, c) = setup();
    let relation = |id: &str| {
        report(id, false).replace(
            "relations: []",
            "relations:\n  - type: \"拆分\"\n    target: \"261106-old\"\n    summary: \"Reason\"",
        )
    };
    publish_fixture(
        &c,
        &[
            ("261106-old", "old.md", report("261106-old", false)),
            ("261106-one", "one.md", relation("261106-one")),
            ("261106-two", "two.md", relation("261106-two")),
        ],
    );
    let before = fs::read(c.join("investigation-index.json")).unwrap();
    let mut operation = op(discard());
    operation.selector = "261106-one".into();
    let out = run(dir.path(), &mut operation);
    assert!(!out.committed);
    assert!(!out.errors.is_empty());
    assert!(c.join("one.md").exists());
    assert_eq!(
        fs::read(c.join("investigation-index.json")).unwrap(),
        before
    );
}
#[test]
fn formal_same_id_path_rename_is_noop() {
    let (dir, c) = setup();
    let text = report("261106-old", false);
    publish_fixture(&c, &[("261106-old", "old.md", text.clone())]);
    let git = |args: &[&str]| {
        let out = std::process::Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(args)
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stderr)
        );
    };
    git(&["init", "-q"]);
    git(&["config", "user.name", "Fixture"]);
    git(&["config", "user.email", "fixture@example.invalid"]);
    git(&["add", "."]);
    git(&["commit", "-qm", "fixture"]);
    let index = fs::read(c.join("investigation-index.json")).unwrap();
    let out = run(dir.path(), &mut op(rename("old")));
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(!out.changed);
    assert_eq!(fs::read_to_string(c.join("old.md")).unwrap(), text);
    assert_eq!(fs::read(c.join("investigation-index.json")).unwrap(), index);
}
#[test]
fn candidate_query_uses_published_owner_when_formal_body_moves_or_breaks() {
    use record_cli::queries::investigation as iq;
    let (dir, c) = setup();
    publish_fixture(&c, &[("261106-old", "old.md", report("261106-old", true))]);
    let reader = report("261106-reader", false)
        + "\n## 随附资源\n- [shared](./_resources/261106-old/nested/file.txt)\n";
    fs::write(c.join("_candidate.reader"), reader).unwrap();
    let root = source::open_root(dir.path()).unwrap();
    for state in ["broken", "moved"] {
        if state == "broken" {
            fs::write(c.join("old.md"), b"invalid").unwrap();
        } else {
            fs::rename(c.join("old.md"), c.join("moved.md")).unwrap();
        }
        let (items, _) = iq::candidates(&root, "investigations", Some("reader")).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].readiness.resource_ready, "{:?}", items[0].errors);
        assert!(c.join("_resources/261106-old/nested/file.txt").exists());
    }
    fs::write(c.join("investigation-index.json"), b"invalid").unwrap();
    assert!(iq::candidates(&root, "investigations", Some("reader")).is_err());
    fs::remove_file(c.join("investigation-index.json")).unwrap();
    assert!(iq::candidates(&root, "investigations", Some("reader")).is_err());
}
#[test]
fn discard_rejects_cross_kind_identity_conflicts() {
    for same_id in [true, false] {
        let (dir, c) = setup();
        publish_fixture(&c, &[("261106-old", "old.md", report("261106-old", false))]);
        let candidate_id = if same_id { "261106-old" } else { "261107-old" };
        fs::write(c.join("_candidate.old"), report(candidate_id, false)).unwrap();
        let index = fs::read(c.join("investigation-index.json")).unwrap();
        let mut operation = op(discard());
        if !same_id {
            operation.selector = "old".into();
        }
        let out = run(dir.path(), &mut operation);
        assert!(!out.committed);
        assert!(!out.errors.is_empty());
        assert!(c.join("old.md").exists());
        assert!(c.join("_candidate.old").exists());
        assert_eq!(fs::read(c.join("investigation-index.json")).unwrap(), index);
    }
}
#[test]
fn formal_discard_preserves_git_pending_bytes() {
    use std::process::Command;
    let (dir, c) = setup();
    publish_fixture(&c, &[("261106-old", "old.md", report("261106-old", true))]);
    let git = |args: &[&str]| {
        let out = Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(args)
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stderr)
        );
        out.stdout
    };
    git(&["init", "-q"]);
    git(&["config", "user.name", "Fixture"]);
    git(&["config", "user.email", "fixture@example.invalid"]);
    git(&["add", "."]);
    git(&["commit", "-qm", "fixture"]);
    fs::write(c.join("pending.txt"), b"staged\0content").unwrap();
    git(&["add", "investigations/pending.txt"]);
    let before = git(&["diff", "--cached", "--binary"]);
    let index_before = git(&["ls-files", "--stage", "-z"]);
    assert!(!before.is_empty());
    let out = run(dir.path(), &mut op(discard()));
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert_eq!(git(&["diff", "--cached", "--binary"]), before);
    assert_eq!(git(&["ls-files", "--stage", "-z"]), index_before);
    assert!(!c.join("old.md").exists());
}
