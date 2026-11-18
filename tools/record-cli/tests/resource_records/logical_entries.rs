use super::*;
use serde_json::json;

const GUIDE: &str = "[{kind: document, path: missing/guide}]";

fn logical(entries: &str) -> String {
    format!(
        "---\nschemaVersion: 1\nkind: resource\nid: logical\ntitle: 实验批次\ncollection: root\nversions:\n  - id: v1\n    files: []\n    members: []\n    entries: {entries}\n---\n实验说明\n"
    )
}

fn logical_fixture(entries: &str) -> tempfile::TempDir {
    let d = empty_fixture();
    write(
        d.path(),
        "root",
        "---\nschemaVersion: 1\nkind: collection\nid: root\ntitle: 根\n---\n",
    );
    write(d.path(), "logical", &logical(entries));
    d
}

#[test]
fn logical_entries_round_trip_alongside_exact_versions() {
    let d = fixture();
    let p = d.path();
    write(
        p,
        "logical",
        &logical(
            "[{kind: directory, path: missing/assets}, {kind: document, path: missing/readme.md}]",
        ),
    );

    // Both entry paths start absent; the old file, pack and selection are valid in the same index.
    assert_eq!(successful_result(p, &["sync-index"])["changed"], true);
    let list = successful_result(p, &["list", "--kind", "resource"]);
    let records = list["records"].as_array().unwrap();
    let version = |id: &str| {
        &records
            .iter()
            .find(|entry| entry["record"]["id"] == id)
            .unwrap_or_else(|| panic!("missing {id}: {records:?}"))["record"]["versions"][0]
    };
    assert_eq!(
        version("logical")["entries"],
        json!([
            {"kind": "directory", "path": "missing/assets"},
            {"kind": "document", "path": "missing/readme.md"}
        ])
    );
    assert!(version("base").get("entries").is_none());

    fs::create_dir_all(p.join("missing/assets")).unwrap();
    fs::write(p.join("missing/assets/process.txt"), "process note").unwrap();
    fs::write(p.join("missing/readme.md"), "updated description").unwrap();
    assert_eq!(successful_result(p, &["sync-index"])["changed"], false);
}

#[test]
fn show_exposes_logical_entries_only_at_version_scope() {
    let d = logical_fixture(GUIDE);
    let p = d.path();
    successful_result(p, &["sync-index"]);
    write(
        p,
        "logical",
        &logical("[{kind: directory, path: current/guide}]"),
    );

    let show = successful_result(p, &["show", "logical", "--version", "v1"]);
    assert_eq!(
        show["selected"]["version"]["entries"],
        json!([{"kind": "directory", "path": "current/guide"}])
    );
    assert_eq!(show["freshness"], "stale");
    assert_error(
        p,
        &["show", "logical", "--version", "v1", "--member", "guide"],
        1,
        &["member not found"],
    );
}

#[test]
fn metadata_search_finds_a_logical_entry_path() {
    let d = logical_fixture(GUIDE);
    let p = d.path();
    successful_result(p, &["sync-index"]);

    let search = successful_result(p, &["search", "missing/guide", "--metadata"]);
    assert_eq!(search["total"], 1);
    assert_eq!(search["hits"][0]["id"], "logical");
    assert!(
        search["hits"][0]["fields"]
            .as_array()
            .unwrap()
            .iter()
            .any(|field| field == "record.versions[0].entries[0].path"),
        "{search}"
    );
}

#[test]
fn logical_entries_are_nonempty_and_exclude_exact_contents() {
    let d = logical_fixture("[]");
    let p = d.path();
    let expected = ["logical.md", "versions.v1", "nonempty and exclusive"];
    assert_error(p, &["sync-index"], 1, &expected);
    for (empty, populated) in [
        (
            "files: []",
            "files: [{id: f, role: primary, sha256: null, locations: [], gap: missing}]",
        ),
        (
            "members: []",
            "members: [{id: f, role: x, target: {resource: base, version: v1, member: original}}]",
        ),
    ] {
        write(p, "logical", &logical(GUIDE).replace(empty, populated));
        assert_error(p, &["sync-index"], 1, &expected);
    }
}

#[test]
fn logical_entry_deserialization_rejects_invalid_shapes() {
    let d = empty_fixture();
    let p = d.path();
    for (entries, cause) in [
        ("null", "null"),
        ("[{kind: file, path: assets/a}]", "`file`"),
        ("[{kind: document, path: a, extra: x}]", "`extra`"),
    ] {
        write(p, "logical", &logical(entries));
        assert_error(p, &["sync-index"], 1, &["logical.md", cause]);
    }
}

#[test]
fn every_logical_entry_requires_a_safe_relative_path() {
    let d = logical_fixture("[{kind: directory, path: assets}, {kind: document, path: ../secret}]");
    assert_error(
        d.path(),
        &["sync-index"],
        1,
        &["logical.md", "entries[1].path", "relative path"],
    );
}

#[test]
fn a_pack_cannot_target_a_logical_entry_as_an_owned_file() {
    let d = logical_fixture(GUIDE);
    let p = d.path();
    write(
        p,
        "pack",
        r#"---
schemaVersion: 1
kind: resource
id: pack
title: 图包
collection: root
versions:
  - id: v1
    files: []
    members:
      - {id: frame, role: first, target: {resource: logical, version: v1, member: guide}}
---
"#,
    );
    assert_error(
        p,
        &["sync-index"],
        1,
        &["pack.md", "member frame", "owned file"],
    );
}

#[test]
fn a_file_relation_cannot_target_a_logical_entry_as_a_file() {
    let d = logical_fixture(GUIDE);
    let p = d.path();
    write(
        p,
        "preview",
        r#"---
schemaVersion: 1
kind: resource
id: preview
title: 预览图
collection: root
versions:
  - id: v1
    members: []
    files:
      - id: crop
        role: derivative
        sha256: null
        locations: []
        gap: 未保存
        relations:
          - type: preview-of
            target: {record: {resource: logical, version: v1, member: guide}}
            evidence: {path: note.md}
            scope: 预览
---
"#,
    );
    assert_error(
        p,
        &["sync-index"],
        1,
        &["preview.md", "files.crop.relations", "target missing"],
    );
}

#[test]
fn selection_can_target_a_logical_version_but_not_an_entry() {
    let d = fixture();
    let p = d.path();
    write(p, "logical", &logical(GUIDE));
    let root = fs::read_to_string(p.join("resources/records/collection.md")).unwrap();
    let root = root.replace(
        "---\n集合正文",
        "  - slot: reference\n    target: {resource: logical, version: v1}\n    basis: agent-provisional\n    scope: 实验入口\n    evidence: {path: note.md}\n---\n集合正文",
    );
    write(p, "collection", &root);
    successful_result(p, &["sync-index"]);
    let show = successful_result(p, &["show", "root"]);
    let selections = show["record"]["selections"].as_array().unwrap();
    for (slot, target) in [
        (
            "use",
            json!({"resource": "pack", "version": "v1", "member": "frame"}),
        ),
        ("reference", json!({"resource": "logical", "version": "v1"})),
    ] {
        let selection = selections.iter().find(|s| s["slot"] == slot).unwrap();
        assert_eq!(selection["target"], target);
    }

    write(
        p,
        "collection",
        &root.replace(
            "resource: logical, version: v1",
            "resource: logical, version: v1, member: guide",
        ),
    );
    assert_error(
        p,
        &["sync-index"],
        1,
        &["collection.md", "selections.reference", "target missing"],
    );
}
