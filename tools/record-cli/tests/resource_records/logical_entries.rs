use super::*;
use serde_json::json;

fn logical(entries: &str) -> String {
    format!(
        "---\nschemaVersion: 1\nkind: resource\nid: logical\ntitle: 实验批次\ncollection: root\nversions:\n  - id: v1\n    files: []\n    members: []\n    entries: {entries}\n---\n实验说明\n"
    )
}

#[test]
fn logical_entries_round_trip_without_inspecting_paths_and_old_records_survive() {
    let d = fixture();
    let p = d.path();
    write(
        p,
        "logical",
        &logical(
            "[{kind: directory, path: missing/assets}, {kind: document, path: missing/readme.md}]",
        ),
    );
    let entries = json!([
        {"kind": "directory", "path": "missing/assets"},
        {"kind": "document", "path": "missing/readme.md"}
    ]);
    assert!(!p.join("missing").exists());
    let (output, sync) = run(p, &["sync-index"]);
    assert!(output.status.success(), "{sync}");
    let list = run(p, &["list", "--kind", "resource"]).1;
    let records = list["result"]["records"].as_array().unwrap();
    assert_eq!(records.len(), 3);
    assert_eq!(records[1]["record"]["id"], "logical");
    assert_eq!(records[1]["record"]["versions"][0]["entries"], entries);
    assert!(records[0]["record"]["versions"][0].get("entries").is_none());

    let search = run(p, &["search", "missing/readme.md", "--metadata"]).1;
    assert_eq!(search["result"]["total"], 1);
    assert_eq!(search["result"]["hits"][0]["id"], "logical");
    let show = run(p, &["show", "logical", "--version", "v1"]).1;
    assert_eq!(show["result"]["selected"]["version"]["entries"], entries);
    assert_eq!(show["result"]["freshness"], "current");

    fs::create_dir_all(p.join("missing/assets")).unwrap();
    fs::write(p.join("missing/assets/process.txt"), "process note").unwrap();
    fs::write(p.join("missing/readme.md"), "updated description").unwrap();
    assert_eq!(run(p, &["check"]).1["result"]["valid"], true);
    assert_eq!(run(p, &["sync-index"]).1["result"]["changed"], false);
    assert_eq!(run(p, &["show", "logical", "--version", "v1"]).1, show);
    assert_old_exact_references(p);
}

fn assert_old_exact_references(p: &Path) {
    let show = run(p, &["show", "base", "--version", "v1", "--member", "crop"]).1;
    assert_eq!(show["result"]["selected"]["file"]["id"], "crop");
    let trace = run(
        p,
        &["trace", "pack", "--version", "v1", "--member", "frame"],
    )
    .1;
    assert_eq!(trace["result"]["resolvedAnchor"], "base@v1#crop");
    assert_eq!(trace["result"]["edges"][0]["to"], "base@v1#original");

    let selection = run(p, &["show", "root"]).1;
    assert_eq!(
        selection["result"]["record"]["selections"][0]["target"],
        json!({"resource": "pack", "version": "v1", "member": "frame"})
    );
}

#[test]
fn logical_entries_reject_unsafe_or_ambiguous_inputs() {
    let d = fixture();
    let p = d.path();
    let exclusivity = "versions.v1 entries must be nonempty and exclusive";
    let unsafe_path = "versions.v1.entries[0].path must be a relative path";
    for (entries, expected) in [
        ("[]", exclusivity),
        ("null", "invalid type: null"),
        ("[{kind: file, path: assets/a}]", "unknown variant `file`"),
        ("[{kind: document, path: ../secret}]", unsafe_path),
        ("[{kind: directory, path: /absolute}]", unsafe_path),
        ("[{kind: directory, path: 'C:/secret'}]", unsafe_path),
        (r"[{kind: document, path: 'a\b'}]", unsafe_path),
        ("[{kind: document, path: a//b}]", unsafe_path),
        (
            "[{kind: document, path: a, extra: x}]",
            "unknown field `extra`",
        ),
    ] {
        write(p, "logical", &logical(entries));
        assert_error(p, &["sync-index"], 1, &["logical.md", expected]);
    }
    let mixed = logical("[{kind: document, path: a}]").replace(
        "files: []",
        "files: [{id: f, role: primary, sha256: null, locations: [], gap: missing}]",
    );
    write(p, "logical", &mixed);
    assert_error(p, &["sync-index"], 1, &["logical.md", exclusivity]);
    let mixed = logical("[{kind: document, path: a}]").replace(
        "members: []",
        "members: [{id: f, role: x, target: {resource: base, version: v1, member: original}}]",
    );
    write(p, "logical", &mixed);
    assert_error(p, &["sync-index"], 1, &["logical.md", exclusivity]);
}

#[test]
fn logical_versions_are_not_exact_file_or_pack_members() {
    let d = fixture();
    let p = d.path();
    write(p, "logical", &logical("[{kind: document, path: assets/a}]"));
    let (output, sync) = run(p, &["sync-index"]);
    assert!(output.status.success(), "{sync}");
    assert_error(
        p,
        &["show", "logical", "--version", "v1", "--member", "a"],
        1,
        &["member not found"],
    );
    let pack = p.join("resources/records/pack.md");
    let original = fs::read_to_string(&pack).unwrap();
    fs::write(
        &pack,
        original.replace(
            "resource: base, version: v1, member: crop",
            "resource: logical, version: v1, member: a",
        ),
    )
    .unwrap();
    assert_error(
        p,
        &["sync-index"],
        1,
        &["pack.md", "member frame must target an owned file"],
    );
    fs::write(&pack, original).unwrap();
    let base = p.join("resources/records/base.md");
    let original = fs::read_to_string(&base).unwrap();
    fs::write(
        &base,
        original.replace(
            "resource: base, version: v1, member: original",
            "resource: logical, version: v1, member: a",
        ),
    )
    .unwrap();
    assert_error(
        p,
        &["sync-index"],
        1,
        &["base.md", "versions.v1.files.crop.relations target missing"],
    );
}
