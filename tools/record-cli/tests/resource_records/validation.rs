use super::*;

#[test]
fn membership_must_reference_a_file_and_selection_stays_in_scope() {
    let d = fixture();
    let p = d.path();
    let pack = p.join("resources/records/pack.md");
    let t = fs::read_to_string(&pack).unwrap();
    fs::write(
        &pack,
        t.replace(
            "resource: base, version: v1, member: crop",
            "resource: pack, version: v1, member: frame",
        ),
    )
    .unwrap();
    assert_eq!(run(p, &["sync-index"]).0.status.code(), Some(1));
    fs::write(&pack, t).unwrap();
    write(
        p,
        "other",
        "---\nschemaVersion: 1\nkind: collection\nid: other\ntitle: 其他\nselections:\n  - slot: bad\n    target: {resource: base, version: v1}\n    basis: agent-provisional\n    scope: other\n    evidence: {path: note.md}\n---\n",
    );
    assert_eq!(run(p, &["sync-index"]).0.status.code(), Some(1));
}
#[test]
fn three_frame_pack_preserves_order_and_exact_versions() {
    let d = fixture();
    let p = d.path();
    for (id, version) in [("residual", "v05"), ("charge", "v04"), ("breath", "v07")] {
        write(
            p,
            id,
            &format!(
                "---\nschemaVersion: 1\nkind: resource\nid: {id}\ntitle: 状态\ncollection: root\nversions:\n  - id: {version}\n    files:\n      - id: frame\n        role: primary\n        sha256: null\n        locations: []\n        gap: 未保管\n    members: []\n---\n"
            ),
        );
    }
    write(
        p,
        "states",
        r#"---
schemaVersion: 1
kind: resource
id: states
title: 三态
collection: root
versions:
  - id: v3
    files:
      - id: preview
        role: derivative
        sha256: null
        locations: []
        gap: 未保管
    members:
      - {id: residual, target: {resource: residual, version: v05, member: frame}, role: first}
      - {id: charge, target: {resource: charge, version: v04, member: frame}, role: second}
      - {id: breath, target: {resource: breath, version: v07, member: frame}, role: third}
---
"#,
    );
    assert!(run(p, &["sync-index"]).0.status.success());
    let show = run(p, &["show", "states", "--version", "v3"]).1;
    let members = show["result"]["selected"]["version"]["members"]
        .as_array()
        .unwrap();
    assert_eq!(
        members
            .iter()
            .map(|m| m["target"]["version"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec!["v05", "v04", "v07"]
    );
    assert_eq!(
        show["result"]["selected"]["version"]["files"][0]["id"],
        "preview"
    );
    let member = run(
        p,
        &["show", "states", "--version", "v3", "--member", "charge"],
    )
    .1;
    assert_eq!(
        member["result"]["selected"]["member"]["target"]["resource"],
        "charge"
    );
}
#[test]
fn multiple_locations_preserve_content_identity_without_media_access() {
    let d = fixture();
    let p = d.path();
    let file = p.join("resources/records/base.md");
    let t = fs::read_to_string(&file).unwrap();
    let replacement = "sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n        locations:\n          - {kind: workspace, path: missing/source.png}\n          - {kind: workspace, path: missing/archive.png}";
    fs::write(
        &file,
        t.replacen("sha256: null\n        locations: []", replacement, 1),
    )
    .unwrap();
    assert!(run(p, &["sync-index"]).0.status.success());
    let v = run(
        p,
        &["show", "base", "--version", "v1", "--member", "original"],
    )
    .1;
    let f = &v["result"]["selected"]["file"];
    assert_eq!(f["locations"].as_array().unwrap().len(), 2);
    assert_eq!(f["sha256"], "a".repeat(64));
    assert!(!p.join("missing/source.png").exists());
}
#[test]
fn invalid_graph_and_identity_matrix() {
    let d = fixture();
    let p = d.path();
    let base = p.join("resources/records/base.md");
    let original = fs::read_to_string(&base).unwrap();
    for (from, to, expected) in [
        (
            "role: primary",
            "role: wrong",
            "versions.v1.files.original.role must be primary or derivative",
        ),
        (
            "sha256: null",
            "sha256: bad",
            "versions.v1.files.original.sha256 must be 64 lowercase hexadecimal characters",
        ),
        (
            "gap: 不可取用",
            "gap: ''",
            "versions.v1.files.original.gap must not be empty",
        ),
        (
            "        gap: 不可取用\n",
            "",
            "versions.v1.files.original.gap is required when sha256 is null or locations is empty",
        ),
        (
            "locations: []",
            "locations: [{kind: workspace, path: ../bad}]",
            "versions.v1.files.original.locations[0].path must be a relative path without dot segments",
        ),
        (
            "path: evidence.md",
            "path: ../bad",
            "relations[0].evidence.path must be a workspace-relative path without dot segments",
        ),
        (
            "member: original",
            "member: 'bad space'",
            "relations[0].target.record.member must be a nonempty ASCII identifier",
        ),
    ] {
        fs::write(&base, original.replacen(from, to, 1)).unwrap();
        let (output, result) = run(p, &["sync-index"]);
        assert_eq!(output.status.code(), Some(1), "{result}");
        let message = result["error"]["message"].as_str().unwrap();
        assert!(
            message.contains("base.md") && message.contains(expected),
            "{message}"
        );
    }
    let collection = p.join("resources/records/collection.md");
    let collection_original = fs::read_to_string(&collection).unwrap();
    fs::write(&base, &original).unwrap();
    for (from, to, expected) in [
        (
            "slot: use",
            "slot: 'bad space'",
            "selections[0].slot must be a nonempty ASCII identifier",
        ),
        (
            "basis: user-confirmed",
            "basis: wrong",
            "selections[0].basis must be agent-provisional, user-preference or user-confirmed",
        ),
        (
            "scope: 测试",
            "scope: ''",
            "selections[0].scope must not be empty",
        ),
        (
            "resource: pack",
            "resource: 'bad space'",
            "selections[0].target.resource must be a nonempty ASCII identifier",
        ),
        (
            "locator: choice",
            "locator: ''",
            "selections[0].evidence.locator must not be empty",
        ),
    ] {
        fs::write(&collection, collection_original.replacen(from, to, 1)).unwrap();
        let (output, result) = run(p, &["sync-index"]);
        assert_eq!(output.status.code(), Some(1), "{result}");
        let message = result["error"]["message"].as_str().unwrap();
        assert!(
            message.contains("collection.md") && message.contains(expected),
            "{message}"
        );
    }
    fs::write(&collection, collection_original).unwrap();
    for invalid in [
        original.replace("  - id: v1", "  - id: v1\n    files: [{id: x, role: primary, sha256: null, locations: [], gap: x}]\n    members: []\n  - id: v1"),
        original.replace("      - id: crop", "      - id: original"),
        original.replace("    files:\n", "    parents: [{resource: base, version: v1}]\n    files:\n"),
        original.replace("member: original", "member: absent"),
    ] {
        fs::write(&base,invalid).unwrap();let (out,result)=run(p,&["sync-index"]);assert_eq!(out.status.code(),Some(1),"{result}");
    }
    fs::write(&base, original).unwrap();
    let text = fs::read_to_string(&collection).unwrap();
    let second = "  - slot: use\n    target: {resource: base, version: v1}\n    basis: user-confirmed\n    scope: 重复\n    evidence: {path: note.md}\n";
    fs::write(
        &collection,
        text.replace("---\n集合正文", &format!("{second}---\n集合正文")),
    )
    .unwrap();
    assert_eq!(run(p, &["sync-index"]).0.status.code(), Some(1));
}
#[test]
fn empty_collection_and_create_conflict() {
    let d = tempfile::tempdir().unwrap();
    let p = d.path();
    fs::create_dir_all(p.join("resources/records")).unwrap();
    fs::create_dir(p.join("resources/resource-index.json")).unwrap();
    let (out, v) = run(p, &["sync-index"]);
    assert_eq!(out.status.code(), Some(1), "{v}");
    fs::remove_dir(p.join("resources/resource-index.json")).unwrap();
    assert!(run(p, &["sync-index"]).0.status.success());
    assert_eq!(run(p, &["list"]).1["result"]["total"], 0);
    assert!(run(p, &["check"]).0.status.success());
}
#[test]
fn cli_help_text_channels_and_parameter_failures() {
    let d = fixture();
    let p = d.path();
    let help = Command::new(env!("CARGO_BIN_EXE_resource-records"))
        .args(["help", "trace"])
        .output()
        .unwrap();
    assert!(help.status.success());
    assert!(String::from_utf8_lossy(&help.stdout).contains("--max-nodes"));
    assert!(help.stderr.is_empty());
    let err = Command::new(env!("CARGO_BIN_EXE_resource-records"))
        .args(["show", "--root"])
        .arg(p)
        .output()
        .unwrap();
    assert_eq!(err.status.code(), Some(2));
    assert!(err.stdout.is_empty());
    assert!(!err.stderr.is_empty());
    for args in [
        vec!["trace", "base", "--type", "wrong"],
        vec!["check", "--offset", "0"],
        vec!["list", "--kind", "resource", "--kind", "collection"],
        vec!["list", "--descendants"],
    ] {
        let (output, error) = run(p, &args);
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stderr.is_empty());
        assert_eq!(error["version"], 1);
        assert_eq!(error["ok"], false);
        assert!(error["error"]["code"].is_string());
        assert!(error["error"]["message"].is_string());
    }
}
#[cfg(windows)]
#[test]
fn replace_failure_preserves_previous_index() {
    let d = fixture();
    let p = d.path();
    assert!(run(p, &["sync-index"]).0.status.success());
    let index = p.join("resources/resource-index.json");
    let before = fs::read(&index).unwrap();
    let source = p.join("resources/records/base.md");
    let t = fs::read_to_string(&source).unwrap();
    fs::write(source, t.replace("底图正文", "更新正文")).unwrap();
    let original_permissions = fs::metadata(&index).unwrap().permissions();
    let mut read_only = original_permissions.clone();
    read_only.set_readonly(true);
    fs::set_permissions(&index, read_only).unwrap();
    let (output, result) = run(p, &["sync-index"]);
    fs::set_permissions(&index, original_permissions).unwrap();
    assert_eq!(output.status.code(), Some(1), "{result}");
    assert_eq!(before, fs::read(index).unwrap());
}
