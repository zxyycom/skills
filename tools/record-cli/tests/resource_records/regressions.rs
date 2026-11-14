use super::*;

#[test]
fn deep_specs_never_publish_an_unreadable_index() {
    let d = fixture();
    let p = d.path();
    let index = p.join("resources/resource-index.json");
    let base = p.join("resources/records/base.md");
    let text = fs::read_to_string(&base).unwrap();
    let nested = format!("{}0{}", "[".repeat(132), "]".repeat(132));
    fs::write(
        base,
        text.replacen(
            "role: primary",
            &format!("role: primary\n        specs: {{nested: {nested}}}"),
            1,
        ),
    )
    .unwrap();
    let (out, result) = run(p, &["sync-index"]);
    if out.status.success() {
        let (checked, diagnostic) = run(p, &["check"]);
        assert!(
            checked.status.success(),
            "published index must be readable: {diagnostic}"
        );
    } else {
        assert_eq!(out.status.code(), Some(1), "{result}");
        assert!(!index.exists(), "rejection must precede creation");
    }
}

#[test]
fn index_path_and_external_location_shape_are_enforced() {
    let d = fixture();
    let p = d.path();
    assert!(run(p, &["sync-index"]).0.status.success());
    let path = p.join("resources/resource-index.json");
    let mut index: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    let entry = index["records"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|e| e["record"]["id"] == "base")
        .unwrap();
    entry["sourcePath"] = "resources/records/base.txt".into();
    fs::copy(
        p.join("resources/records/base.md"),
        p.join("resources/records/base.txt"),
    )
    .unwrap();
    fs::write(&path, serde_json::to_vec(&index).unwrap()).unwrap();
    let (out, result) = run(p, &["show", "base"]);
    assert_eq!(
        out.status.code(),
        Some(1),
        "non-Markdown source must be rejected: {result}"
    );
}

#[test]
fn external_location_rejects_nul() {
    let d = fixture();
    let p = d.path();
    let base = p.join("resources/records/base.md");
    let text = fs::read_to_string(&base).unwrap();
    let invalid = text.replacen(
        "locations: []",
        "locations: [{kind: external, storage: archive, path: \"bad\\0path\", custody: notes.md}]",
        1,
    );
    fs::write(base, invalid).unwrap();
    let (out, result) = run(p, &["sync-index"]);
    assert_eq!(
        out.status.code(),
        Some(1),
        "NUL location must be rejected: {result}"
    );
}

#[test]
fn downstream_selection_of_pack_member_keeps_original_anchor() {
    let d = fixture();
    let p = d.path();
    assert!(run(p, &["sync-index"]).0.status.success());
    let (out, v) = run(
        p,
        &[
            "trace",
            "pack",
            "--version",
            "v1",
            "--member",
            "frame",
            "--type",
            "selection",
            "--direction",
            "downstream",
        ],
    );
    assert!(out.status.success(), "{v}");
    assert_eq!(v["result"]["anchor"], "pack@v1#frame");
    assert!(
        v["result"]["edges"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["type"] == "selection" && e["from"] == "root" && e["to"] == "pack@v1#frame"),
        "{v}"
    );
}

#[test]
fn deep_valid_version_chain_has_bounded_trace_without_stack_overflow() {
    let d = fixture();
    let p = d.path();
    let mut record = String::from(
        "---\nschemaVersion: 1\nkind: resource\nid: chain\ntitle: chain\ncollection: root\nversions:\n",
    );
    for i in 0..10_000 {
        record.push_str(&format!("  - id: v{i}\n"));
        if i > 0 {
            record.push_str(&format!(
                "    parents: [{{resource: chain, version: v{}}}]\n",
                i - 1
            ));
        }
        record.push_str("    files: [{id: file, role: primary, sha256: null, locations: [], gap: absent}]\n    members: []\n");
    }
    record.push_str("---\n");
    write(p, "chain", &record);
    let (out, v) = run(p, &["sync-index"]);
    assert!(
        out.status.success(),
        "valid chain must sync without overflow: status {:?}, {v}",
        out.status.code()
    );
    let (out, v) = run(
        p,
        &[
            "trace",
            "chain",
            "--version",
            "v9999",
            "--depth",
            "1",
            "--max-nodes",
            "2",
        ],
    );
    assert!(out.status.success(), "{v}");
    assert_eq!(v["result"]["nodes"], 2);
    assert_eq!(v["result"]["edges"].as_array().unwrap().len(), 1);
    assert_eq!(v["result"]["truncated"], true);
}
