use record_cli::{
    domains::decision::{self, Definition},
    index::{self, IndexV4, Revision},
    source_revision::{self, Domain},
};
use std::{collections::BTreeMap, fs, path::Path, process::Command};

fn fixture() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().join("decisions");
    fs::create_dir(&base).unwrap();
    let text = include_str!("fixtures/identity/decisions/original.md");
    let id = "261106-original";
    let path = "original.md";
    let state = decision::parse_established(text.as_bytes(), id, path)
        .unwrap()
        .state;
    let index = index::build_index(
        IndexV4 {
            schema_version: 4,
            namespace: "decisions".into(),
            definition_version: 11,
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(Domain::Decision),
                entries: BTreeMap::from([(
                    id.into(),
                    source_revision::fingerprint(Domain::Decision, id, path, text),
                )]),
            },
            entries: BTreeMap::from([(id.into(), state)]),
        },
        &Definition,
    )
    .unwrap();
    fs::write(base.join(path), text).unwrap();
    fs::write(
        base.join("decision-index.json"),
        index::serialize_index(&index, &Definition).unwrap(),
    )
    .unwrap();
    dir
}
fn cli(root: &Path, args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .arg("--root")
        .arg(root)
        .args(["--decisions-dir", "decisions"])
        .args(args)
        .arg("--json")
        .output()
        .unwrap()
}
fn value(output: &std::process::Output) -> serde_json::Value {
    serde_json::from_slice(&output.stdout).unwrap()
}

#[cfg(unix)]
#[test]
fn selected_source_symlink_is_rejected_at_show_sync_and_check_boundaries() {
    use std::os::unix::fs::symlink;
    let dir = fixture();
    let outside = tempfile::tempdir().unwrap();
    let base = dir.path().join("decisions");
    let source = base.join("original.md");
    let index_path = base.join("decision-index.json");
    let text = fs::read(&source).unwrap();
    let before = fs::read(&index_path).unwrap();
    for args in [
        &["show", "original"][..],
        &["sync-index", "--select", "original"][..],
        &["check"][..],
        &["sync-index"][..],
    ] {
        let out = cli(dir.path(), args);
        assert!(
            out.status.success(),
            "{:?}: {}",
            args,
            String::from_utf8_lossy(&out.stdout)
        );
    }
    let target = outside.path().join("target.md");
    fs::write(&target, &text).unwrap();
    fs::remove_file(&source).unwrap();
    symlink(&target, &source).unwrap();
    for args in [
        &["show", "original"][..],
        &["sync-index", "--select", "original"][..],
        &["check"][..],
        &["sync-index"][..],
    ] {
        let out = cli(dir.path(), args);
        let body = value(&out);
        assert!(!out.status.success(), "{args:?}: {body}");
        assert!(
            body.to_string().to_lowercase().contains("symlink")
                || body.to_string().contains("member-invalid"),
            "{args:?}: {body}"
        );
        assert_eq!(fs::read(&index_path).unwrap(), before);
        assert_eq!(fs::read(&target).unwrap(), text);
        assert!(
            fs::symlink_metadata(&source)
                .unwrap()
                .file_type()
                .is_symlink()
        );
    }
}

#[test]
fn selected_invalid_utf8_is_rejected_at_show_sync_and_check_boundaries() {
    let dir = fixture();
    let base = dir.path().join("decisions");
    let source = base.join("original.md");
    let index_path = base.join("decision-index.json");
    let before = fs::read(&index_path).unwrap();
    for args in [
        &["show", "original"][..],
        &["sync-index", "--select", "original"][..],
        &["check"][..],
        &["sync-index"][..],
    ] {
        let out = cli(dir.path(), args);
        assert!(
            out.status.success(),
            "{:?}: {}",
            args,
            String::from_utf8_lossy(&out.stdout)
        );
    }
    fs::write(&source, [0xff, 0xfe]).unwrap();
    for args in [
        &["show", "original"][..],
        &["sync-index", "--select", "original"][..],
        &["check"][..],
        &["sync-index"][..],
    ] {
        let out = cli(dir.path(), args);
        let body = value(&out);
        assert!(!out.status.success(), "{args:?}: {body}");
        let text = body.to_string().to_lowercase();
        assert!(
            text.contains("utf8") || text.contains("utf-8") || text.contains("source-encoding"),
            "{args:?}: {body}"
        );
        assert_eq!(fs::read(&index_path).unwrap(), before);
        assert_eq!(fs::read(&source).unwrap(), [0xff, 0xfe]);
    }
}

#[test]
fn invalid_candidate_identity_still_conflicts_with_formal_membership() {
    let dir = fixture();
    let base = dir.path().join("decisions");
    let index = fs::read(base.join("decision-index.json")).unwrap();
    let original = fs::read(base.join("original.md")).unwrap();
    let candidate = "---\nid: 261106-original\nstatus: candidate\ntags: []\n---\ninvalid body\n";
    fs::write(base.join("candidate.md"), candidate).unwrap();
    for args in [&["check"][..], &["sync-index"][..]] {
        let out = cli(dir.path(), args);
        let body = value(&out);
        assert!(!out.status.success(), "{args:?}: {body}");
        if args[0] == "check" {
            assert!(
                body.to_string().contains("duplicate-id"),
                "{args:?}: {body}"
            );
        } else {
            assert_eq!(body["error"]["code"], "candidate-invalid");
            assert!(
                body["error"]["message"]
                    .as_str()
                    .unwrap()
                    .contains("2 check errors")
            );
            assert!(
                body["error"]["message"]
                    .as_str()
                    .unwrap()
                    .contains("run decision-records check")
            );
        }
        assert_eq!(fs::read(base.join("decision-index.json")).unwrap(), index);
        assert_eq!(fs::read(base.join("original.md")).unwrap(), original);
        assert_eq!(
            fs::read_to_string(base.join("candidate.md")).unwrap(),
            candidate
        );
    }
}

#[test]
fn decision_list_uses_published_title_until_explicit_full_sync() {
    let dir = fixture();
    let base = dir.path().join("decisions");
    let source = base.join("original.md");
    let index_path = base.join("decision-index.json");
    let original = fs::read_to_string(&source).unwrap();
    let before = fs::read(&index_path).unwrap();
    let old_index = index::parse_index(&before, &Definition).unwrap();
    let old_state = old_index.index().entries["261106-original"].clone();
    let list = || {
        let output = cli(dir.path(), &["list"]);
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stdout)
        );
        value(&output)
    };
    let initial = list();
    assert_eq!(
        initial["result"]["records"][0]["projection"]["title"],
        "Example"
    );
    fs::write(
        &source,
        original.replace("title: Example #", "title: Updated #"),
    )
    .unwrap();
    assert_eq!(
        list()["result"]["records"][0]["projection"]["title"],
        "Example"
    );
    assert_eq!(fs::read(&index_path).unwrap(), before);
    let synced = cli(dir.path(), &["sync-index"]);
    assert!(
        synced.status.success(),
        "{}",
        String::from_utf8_lossy(&synced.stdout)
    );
    assert_eq!(
        list()["result"]["records"][0]["projection"]["title"],
        "Updated"
    );
    let after = fs::read(&index_path).unwrap();
    let current = index::parse_index(&after, &Definition).unwrap();
    let state = &current.index().entries["261106-original"];
    assert_eq!(state.status, old_state.status);
    assert_eq!(state.alignment, old_state.alignment);
    assert_eq!(state.created_at, old_state.created_at);
    assert_eq!(state.source_path, old_state.source_path);
}
