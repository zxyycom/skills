use super::*;

#[test]
fn sync_queries_trace_and_idempotence() {
    let d = fixture();
    let p = d.path();
    let (o, v) = run(p, &["sync-index"]);
    assert!(o.status.success(), "{v}");
    assert_eq!(v["version"], 1);
    assert_eq!(v["command"], "sync-index");
    assert_eq!(v["ok"], true);
    assert!(o.stderr.is_empty());
    assert_eq!(v["result"]["changed"], true);
    let before = fs::read(p.join("resources/resource-index.json")).unwrap();
    assert_eq!(run(p, &["sync-index"]).1["result"]["changed"], false);
    assert_eq!(
        before,
        fs::read(p.join("resources/resource-index.json")).unwrap()
    );
    assert_eq!(run(p, &["check"]).1["result"]["valid"], true);
    assert_eq!(
        run(p, &["list", "--kind", "resource"]).1["result"]["total"],
        2
    );
    assert_eq!(
        run(p, &["show", "pack", "--version", "v1", "--member", "frame"]).1["result"]["freshness"],
        "current"
    );
    assert_eq!(run(p, &["search", "底图"]).1["result"]["total"], 1);
    let v = run(p, &["trace", "base", "--version", "v1", "--member", "crop"]).1;
    assert_eq!(v["result"]["edges"][0]["to"], "base@v1#original");
}
#[test]
fn invalid_sources_do_not_replace_index() {
    let d = fixture();
    let p = d.path();
    assert!(run(p, &["sync-index"]).0.status.success());
    let before = fs::read(p.join("resources/resource-index.json")).unwrap();
    write(
        p,
        "broken",
        "---\nschemaVersion: 1\nkind: collection\nid: root\ntitle: duplicate\n---\n",
    );
    let (o, v) = run(p, &["sync-index"]);
    assert_eq!(o.status.code(), Some(1));
    assert_eq!(v["ok"], false);
    assert_eq!(
        before,
        fs::read(p.join("resources/resource-index.json")).unwrap()
    );
}
#[test]
fn missing_and_stale_index_and_argument_errors() {
    let d = fixture();
    let p = d.path();
    assert_eq!(run(p, &["check"]).0.status.code(), Some(1));
    assert!(run(p, &["sync-index"]).0.status.success());
    let path = p.join("resources/records/base.md");
    let t = fs::read_to_string(&path).unwrap();
    fs::write(path, t.replace("底图正文", "变更正文")).unwrap();
    assert_eq!(run(p, &["check"]).0.status.code(), Some(1));
    assert_eq!(run(p, &["show", "base"]).1["result"]["freshness"], "stale");
    let list = run(p, &["list"]).1;
    assert_eq!(list["result"]["freshness"], "unchecked");
    let search = run(p, &["search", "变更正文"]).1;
    assert_eq!(search["result"]["total"], 1);
    assert_eq!(search["result"]["hits"][0]["id"], "base");
    assert_eq!(
        run(p, &["show", "base", "--member", "original"])
            .0
            .status
            .code(),
        Some(2)
    );
}
#[test]
fn cycles_dangling_and_legal_cross_references() {
    let d = fixture();
    let p = d.path();
    let path = p.join("resources/records/base.md");
    let t = fs::read_to_string(&path).unwrap();
    let cyclic = t.replace("member: original", "member: crop");
    fs::write(&path, cyclic).unwrap();
    assert_eq!(run(p, &["sync-index"]).0.status.code(), Some(1));
    let missing = t.replace("member: original", "member: missing");
    fs::write(&path, missing).unwrap();
    assert_eq!(run(p, &["sync-index"]).0.status.code(), Some(1));
    let legal = t
        .replace("type: preview-of", "type: reference")
        .replace("member: original", "member: crop");
    fs::write(&path, legal).unwrap();
    assert!(run(p, &["sync-index"]).0.status.success());
}
