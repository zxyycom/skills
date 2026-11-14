use super::*;

#[test]
fn candidate_branches_and_selection_do_not_upgrade() {
    let d = fixture();
    let p = d.path();
    for id in ["candidate-a", "candidate-b"] {
        write(
            p,
            id,
            &format!(
                r#"---
schemaVersion: 1
kind: resource
id: {id}
title: 候选
collection: root
versions:
  - id: v1
    files:
      - id: output
        role: primary
        sha256: null
        locations: []
        gap: 缺少保管
        relations:
          - type: input
            target: {{record: {{resource: base, version: v1, member: original}}}}
            evidence: {{path: call.md, locator: run}}
            scope: 底图
            order: 1
    members: []
---
候选正文
"#
            ),
        );
    }
    assert!(run(p, &["sync-index"]).0.status.success());
    for id in ["candidate-a", "candidate-b"] {
        let r = run(p, &["trace", id, "--version", "v1", "--member", "output"]).1;
        assert_eq!(r["result"]["edges"][0]["to"], "base@v1#original");
    }
    let selected = run(p, &["show", "root"]).1;
    assert_eq!(
        selected["result"]["record"]["selections"][0]["target"]["resource"],
        "pack"
    );
}
#[test]
fn ordered_inputs_alias_terminals_and_downstream() {
    let d = fixture();
    let p = d.path();
    write(
        p,
        "output",
        r#"---
schemaVersion: 1
kind: resource
id: output
title: 换鳞
collection: root
versions:
  - id: v1
    files:
      - id: result
        role: primary
        sha256: null
        locations: []
        gap: 历史输出未保管
        relations:
          - type: input
            target: {record: {resource: base, version: v1, member: original}}
            evidence: {path: calls.md, locator: run-1}
            scope: 编辑底图
            order: 1
          - type: input
            target: {record: {resource: pack, version: v1, member: frame}}
            evidence: {path: calls.md, locator: run-1}
            scope: 裁片参考
            order: 2
          - type: reference
            target: {unknown: 未登记人工对照}
            evidence: {path: calls.md, locator: review}
            scope: 比较
    members: []
---
正文
"#,
    );
    assert!(run(p, &["sync-index"]).0.status.success());
    let trace = run(
        p,
        &[
            "trace",
            "output",
            "--version",
            "v1",
            "--member",
            "result",
            "--depth",
            "2",
        ],
    )
    .1;
    let edges = trace["result"]["edges"].as_array().unwrap();
    assert_eq!(edges[0]["evidence"]["order"], 1);
    assert_eq!(edges[1]["evidence"]["order"], 2);
    assert_eq!(edges[1]["evidence"]["target"]["record"]["resource"], "pack");
    assert_eq!(edges[1]["to"], "base@v1#crop");
    assert!(edges.iter().any(|x| x["to"] == "base@v1#original"));
    let reverse = run(
        p,
        &[
            "trace",
            "base",
            "--version",
            "v1",
            "--member",
            "crop",
            "--direction",
            "downstream",
        ],
    )
    .1;
    assert_eq!(reverse["result"]["edges"][0]["from"], "output@v1#result");
    let unknown = run(
        p,
        &[
            "trace",
            "output",
            "--version",
            "v1",
            "--member",
            "result",
            "--type",
            "reference",
        ],
    )
    .1;
    assert_eq!(unknown["result"]["unexpandedTerminals"], 1);
    assert_eq!(
        unknown["result"]["edges"][0]["terminal"]["unknown"],
        "未登记人工对照"
    );
    let alias = run(
        p,
        &["trace", "pack", "--version", "v1", "--member", "frame"],
    )
    .1;
    assert_eq!(alias["result"]["resolvedAnchor"], "base@v1#crop");
    assert_eq!(alias["result"]["edges"][0]["to"], "base@v1#original");
}
#[test]
fn record_schema_errors_are_rejected_before_writing() {
    let d = fixture();
    let p = d.path();
    let path = p.join("resources/records/base.md");
    let original = fs::read_to_string(&path).unwrap();
    for bad in [
        original.replace("sha256: null\n", ""),
        original.replace("role: primary", "role: bad"),
        original.replace("title: 底图", "title: 底图\ntitle: 另一个"),
        original.replace(
            "target: {record: {resource: base, version: v1, member: original}}",
            "target: {record: {resource: base, version: v1, member: original}, unknown: bad}",
        ),
    ] {
        fs::write(&path, bad).unwrap();
        let (o, v) = run(p, &["sync-index"]);
        assert_eq!(o.status.code(), Some(1), "{v}");
        assert!(!p.join("resources/resource-index.json").exists());
    }
}
#[test]
fn scope_cycles_limits_and_legal_duplicate_target_roles() {
    let d = fixture();
    let p = d.path();
    let path = p.join("resources/records/base.md");
    let t = fs::read_to_string(&path).unwrap();
    let two=t.replace("    members: []", "          - type: reference\n            target: {record: {resource: base, version: v1, member: original}}\n            evidence: {path: evidence.md, locator: review}\n            scope: 人工对照\n    members: []");
    fs::write(&path, &two).unwrap();
    assert!(run(p, &["sync-index"]).0.status.success());
    let limited = run(
        p,
        &[
            "trace",
            "base",
            "--version",
            "v1",
            "--member",
            "crop",
            "--type",
            "preview-of",
            "--type",
            "reference",
            "--max-edges",
            "1",
        ],
    )
    .1;
    assert_eq!(limited["result"]["truncated"], true);
    assert_eq!(limited["result"]["edges"].as_array().unwrap().len(), 1);
    assert_eq!(limited["result"]["nodes"], 2);
    assert_eq!(limited["result"]["limits"]["edges"], 1);
    let nodes = run(
        p,
        &[
            "trace",
            "base",
            "--version",
            "v1",
            "--member",
            "crop",
            "--max-nodes",
            "1",
        ],
    )
    .1;
    assert_eq!(nodes["result"]["truncated"], true);
    assert_eq!(nodes["result"]["nodes"], 1);
    assert_eq!(nodes["result"]["edges"].as_array().unwrap().len(), 0);
    write(
        p,
        "cycle",
        "---\nschemaVersion: 1\nkind: collection\nid: child\ntitle: 子\nparent: child\n---\n",
    );
    assert_eq!(run(p, &["sync-index"]).0.status.code(), Some(1));
}
#[test]
fn newline_normalization_and_index_path_guards() {
    let d = fixture();
    let p = d.path();
    assert!(run(p, &["sync-index"]).0.status.success());
    let file = p.join("resources/records/base.md");
    let contents = fs::read_to_string(&file).unwrap();
    fs::write(&file, contents.replace('\n', "\r\n")).unwrap();
    assert!(run(p, &["check"]).0.status.success());
    let (o, _) = run(p, &["list", "--resources-dir", "../resources"]);
    assert_eq!(o.status.code(), Some(1));
    let (o, _) = run(p, &["show", "base", "--tag", "x"]);
    assert_eq!(o.status.code(), Some(2));
}
