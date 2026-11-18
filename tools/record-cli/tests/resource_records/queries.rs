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

fn list_view_fixture() -> tempfile::TempDir {
    let d = empty_fixture();
    let p = d.path();
    write_collection(p, "root", "根", None);
    write_collection(p, "child", "子集合", Some("root"));
    write_collection(p, "other", "无关集合", None);
    for (name, id, title, collection) in [
        ("01-pack", "pack", "图包", "root"),
        ("02-base", "base", r#""底图\n第二行""#, "child"),
        ("03-outside", "a-outside", "不匹配", "other"),
    ] {
        write(
            p,
            name,
            &format!(
                "---\nschemaVersion: 1\nkind: resource\nid: {id}\ntitle: {title}\ncollection: {collection}\nversions:\n  - id: v1\n    files: []\n    members: []\n    entries: [{{kind: directory, path: assets/{id}}}]\n---\n"
            ),
        );
    }
    successful_result(p, &["sync-index"]);
    d
}

fn write_collection(p: &Path, id: &str, title: &str, parent: Option<&str>) {
    let parent = parent.map_or_else(String::new, |id| format!("parent: '{id}'\n"));
    write(
        p,
        id,
        &format!(
            "---\nschemaVersion: 1\nkind: collection\nid: '{id}'\ntitle: {title}\n{parent}---\n"
        ),
    );
}

fn plain(p: &Path, args: &[&str]) -> String {
    let output = command(p).args(args).output().unwrap();
    assert!(
        output.status.success(),
        "{args:?}: {:?}, {}",
        output.status.code(),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty(), "{args:?}: {output:?}");
    String::from_utf8(output.stdout).unwrap()
}

fn list_page(offset: &str) -> [&str; 10] {
    [
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
    ]
}

#[test]
fn list_views_preserve_window_and_mark_tree_context() {
    let d = list_view_fixture();
    let p = d.path();
    for (offset, details, tree_context) in [
        (
            "0",
            Some(r#"resource base title="底图\n第二行" collection=child"#),
            &[
                "[context depth=0] collection root",
                "[context depth=1] collection child",
            ][..],
        ),
        (
            "1",
            Some(r#"resource pack title="图包" collection=root"#),
            &["[context depth=0] collection root"][..],
        ),
        ("2", None, &[][..]),
    ] {
        for view in ["--brief", "--tree"] {
            let mut args = list_page(offset).to_vec();
            args.push(view);
            let text = plain(p, &args);
            let mut lines = text.lines().map(str::trim_start);
            let header: Vec<_> = lines.next().unwrap().split_whitespace().collect();
            for field in [
                "total=2",
                "limit=1",
                "freshness=unchecked",
                &format!("offset={offset}"),
            ] {
                assert!(header.contains(&field), "{args:?}: {text}");
            }

            if let Some(details) = details {
                let marker = if view == "--tree" {
                    for row in tree_context {
                        assert_row_prefix(lines.next(), row, &text);
                    }
                    format!("[match depth={}]", tree_context.len())
                } else {
                    "[match]".to_string()
                };
                assert_row_prefix(lines.next(), &format!("{marker} {details}"), &text);
            }
            assert_eq!(lines.next(), None, "{args:?}: {text}");
        }
    }
}

fn assert_row_prefix(row: Option<&str>, expected: &str, text: &str) {
    assert!(
        row.and_then(|row| row.strip_prefix(expected))
            .is_some_and(|suffix| suffix.is_empty() || suffix.starts_with(' ')),
        "expected row {expected:?}, got {row:?}:\n{text}"
    );
}

#[test]
fn list_views_do_not_replace_the_complete_json_result() {
    let d = empty_fixture();
    let p = d.path();
    write_collection(p, "root", "根", None);
    write_collection(p, "child", "子集合", Some("root"));
    successful_result(p, &["sync-index"]);
    let query = ["list", "--limit", "1"];
    let plain: Value = serde_json::from_str(&plain(p, &query)).unwrap();
    assert_eq!(plain["total"], 2);
    assert_eq!(plain["offset"], 0);
    assert_eq!(plain["limit"], 1);
    assert_eq!(plain["freshness"], "unchecked");
    let records = plain["records"].as_array().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["record"]["id"], "child");
    assert_eq!(records[0]["record"]["parent"], "root");
    assert_eq!(records[0]["sourcePath"], "resources/records/child.md");
    assert!(records[0]["sourceRevision"].is_string());

    for view in ["--brief", "--tree"] {
        let mut args = query.to_vec();
        args.push(view);
        let (output, json) = run(p, &args);
        assert!(output.status.success(), "{args:?}: {json}");
        assert!(output.stderr.is_empty(), "{args:?}: {:?}", output.stderr);
        assert_eq!(
            json,
            serde_json::json!({
                "version": 1,
                "command": "list",
                "ok": true,
                "result": plain,
                "diagnostics": []
            }),
            "{args:?}"
        );
    }
}

#[test]
fn list_view_flags_are_exclusive_and_list_only() {
    let d = empty_fixture();
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
    let d = empty_fixture();
    let p = d.path();
    write_collection(p, "-", "Dash", None);
    write_collection(p, "child", "Child", Some("-"));
    successful_result(p, &["sync-index"]);

    let text = plain(p, &["list", "--brief"]);
    let rows: Vec<_> = text.lines().skip(1).collect();
    assert_eq!(rows.len(), 2, "{text}");
    assert_row_prefix(Some(rows[0]), "[match] collection -", &text);
    assert!(
        !rows[0]
            .split_whitespace()
            .any(|field| field.starts_with("parent=")),
        "{text}"
    );
    assert_row_prefix(Some(rows[1]), "[match] collection child", &text);
    assert!(
        rows[1].split_whitespace().any(|field| field == "parent=-"),
        "{text}"
    );
}

#[test]
fn tree_keeps_a_collection_match_even_when_it_is_also_context() {
    let d = empty_fixture();
    let p = d.path();
    // The child's ID sorts first, so the parent appears as context before its own hit.
    write_collection(p, "z-parent", "Parent", None);
    write_collection(p, "a-child", "Child", Some("z-parent"));
    successful_result(p, &["sync-index"]);

    let text = plain(p, &["list", "--tree"]);
    let mut lines = text.lines().skip(1).map(str::trim_start);
    for row in [
        "[context depth=0] collection z-parent",
        "[match depth=1] collection a-child",
        "[match depth=0] collection z-parent",
    ] {
        assert_row_prefix(lines.next(), row, &text);
    }
    assert_eq!(lines.next(), None, "{text}");
}

#[test]
fn tree_reports_depth_beyond_the_indentation_cap() {
    let d = empty_fixture();
    let p = d.path();
    // Reach depth 41 without asserting how many spaces the renderer uses.
    write_collection(p, "root", "根", None);
    let mut parent = "root".to_string();
    for n in (0..41).rev() {
        let id = format!("deep{n:02}");
        write_collection(p, &id, "深层", Some(&parent));
        parent = id;
    }
    successful_result(p, &["sync-index"]);

    let text = plain(p, &["list", "--limit", "1", "--tree"]);
    let mut rows = text.lines().skip(1).map(str::trim_start);
    assert_row_prefix(rows.next(), "[context depth=0] collection root", &text);
    for (depth, n) in (1..=40).zip((1..41).rev()) {
        let row = format!("[context depth={depth}] collection deep{n:02}");
        assert_row_prefix(rows.next(), &row, &text);
    }
    assert_row_prefix(rows.next(), "[match depth=41] collection deep00", &text);
    assert_eq!(rows.next(), None, "{text}");
}
