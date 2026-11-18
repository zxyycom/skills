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

fn setup_list_views(p: &Path) {
    write(
        p,
        "child",
        "---\nschemaVersion: 1\nkind: collection\nid: child\ntitle: 子集合\nparent: root\n---\n",
    );
    write(
        p,
        "other",
        "---\nschemaVersion: 1\nkind: collection\nid: other\ntitle: 无关集合\n---\n",
    );
    write(
        p,
        "outside",
        "---\nschemaVersion: 1\nkind: resource\nid: a-outside\ntitle: 不匹配\ncollection: other\nversions:\n  - id: v1\n    files: []\n    members: []\n    entries: [{kind: directory, path: scratch}]\n---\n",
    );
    let base = fs::read_to_string(p.join("resources/records/base.md")).unwrap();
    write(
        p,
        "base",
        &base
            .replace("title: 底图", "title: \"底图\\n第二行\"")
            .replace("collection: root", "collection: child"),
    );
    let (output, sync) = run(p, &["sync-index"]);
    assert!(output.status.success(), "{sync}");
}

fn plain(p: &Path, args: &[&str]) -> String {
    let output = command(p).args(args).output().unwrap();
    assert!(
        output.status.success(),
        "{args:?}: {:?}, {}",
        output.status.code(),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

#[test]
fn list_views_preserve_window_and_mark_tree_context() {
    let d = fixture();
    let p = d.path();
    setup_list_views(p);
    for (offset, id, details, parents) in [
        (
            "0",
            "base",
            r#"resource base title="底图\n第二行" collection=child"#,
            &["root", "child"][..],
        ),
        (
            "1",
            "pack",
            r#"resource pack title="图包" collection=root"#,
            &["root"][..],
        ),
        ("9", "", "", &[][..]),
    ] {
        let query = [
            "list",
            "--collection",
            "root",
            "--descendants",
            "--kind",
            "resource",
            "--limit",
            "1",
            "--offset",
            offset,
        ];
        let (output, json) = run(p, &query);
        assert!(output.status.success(), "{json}");
        let result = &json["result"];
        let ids: Vec<_> = result["records"]
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| entry["record"]["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, if id.is_empty() { vec![] } else { vec![id] });
        assert_eq!(result["total"], 2);
        assert_eq!(result["offset"], offset.parse::<usize>().unwrap());
        assert_eq!(result["limit"], 1);
        assert_eq!(result["freshness"], "unchecked");
        if offset == "0" {
            assert_eq!(
                &serde_json::from_str::<Value>(&plain(p, &query)).unwrap(),
                result
            );
        }
        for view in ["--brief", "--tree"] {
            let mut args = query.to_vec();
            args.push(view);
            assert_eq!(run(p, &args).1, json);
            assert_view_rows(&plain(p, &args), offset, view, details, parents);
        }
    }

    let show = run(p, &["show", "base"]).1;
    assert_eq!(show["result"]["record"]["title"], "底图\n第二行");
    assert_eq!(show["result"]["freshness"], "current");
}

fn assert_view_rows(text: &str, offset: &str, view: &str, details: &str, parents: &[&str]) {
    let mut lines = text.lines().map(str::trim_start);
    let header = format!("total=2 offset={offset} limit=1 freshness=unchecked");
    assert_eq!(lines.next(), Some(header.as_str()));
    if !details.is_empty() {
        let marker = if view == "--tree" {
            for (depth, parent) in parents.iter().enumerate() {
                let prefix = format!("[context depth={depth}] collection {parent} ");
                assert!(lines.next().unwrap().starts_with(&prefix), "{text}");
            }
            format!("[match depth={}] ", parents.len())
        } else {
            "[match] ".to_string()
        };
        let row = lines.next().unwrap();
        assert!(row.starts_with(&format!("{marker}{details} ")), "{text}");
    }
    assert_eq!(lines.next(), None, "{text}");
}

#[test]
fn list_view_flags_are_exclusive_and_list_only() {
    let d = fixture();
    let p = d.path();
    assert_error(
        p,
        &["list", "--brief", "--tree"],
        2,
        &["mutually exclusive"],
    );
    for view in ["--brief", "--tree"] {
        assert_error(p, &["show", "base", view], 2, &["not applicable"]);
    }
}

#[test]
fn brief_distinguishes_dash_parent_from_no_parent() {
    let d = fixture();
    let p = d.path();
    write(
        p,
        "dash",
        "---\nschemaVersion: 1\nkind: collection\nid: '-'\ntitle: Dash\n---\n",
    );
    write(
        p,
        "child",
        "---\nschemaVersion: 1\nkind: collection\nid: child\ntitle: Child\nparent: '-'\n---\n",
    );
    let (output, sync) = run(p, &["sync-index"]);
    assert!(output.status.success(), "{sync}");
    let text = plain(
        p,
        &["list", "--brief", "--collection", "-", "--descendants"],
    );
    let rows: Vec<_> = text.lines().skip(1).collect();
    assert_eq!(rows.len(), 2, "{text}");
    assert!(rows[0].starts_with("[match] collection - "), "{text}");
    assert!(
        !rows[0]
            .split_whitespace()
            .any(|field| field.starts_with("parent=")),
        "{text}"
    );
    assert!(rows[1].starts_with("[match] collection child "), "{text}");
    assert!(
        rows[1].split_whitespace().any(|field| field == "parent=-"),
        "{text}"
    );
}

#[test]
fn tree_reports_depth_beyond_the_indentation_cap() {
    let d = fixture();
    let p = d.path();
    let mut parent = "root".to_string();
    for n in 0..40 {
        let id = format!("deep{n:03}");
        write(
            p,
            &id,
            &format!(
                "---\nschemaVersion: 1\nkind: collection\nid: {id}\ntitle: 深层\nparent: {parent}\n---\n"
            ),
        );
        parent = id;
    }
    let text = fs::read_to_string(p.join("resources/records/base.md")).unwrap();
    write(
        p,
        "base",
        &text.replace("collection: root", &format!("collection: {parent}")),
    );
    let (output, sync) = run(p, &["sync-index"]);
    assert!(output.status.success(), "{sync}");
    let text = plain(p, &["list", "--kind", "resource", "--limit", "1", "--tree"]);
    let rows: Vec<_> = text.lines().skip(1).map(str::trim_start).collect();
    assert_eq!(rows.len(), 42);
    assert!(
        rows[..41]
            .iter()
            .enumerate()
            .all(|(depth, row)| row.starts_with(&format!("[context depth={depth}] collection "))),
        "{text}"
    );
    assert!(
        rows[41].starts_with("[match depth=41] resource base "),
        "{text}"
    );
}
