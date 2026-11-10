use super::*;

#[test]
fn grouped_show_preserves_same_id_bodies_and_continues_after_failure() {
    let temp = setup();
    let cwd = temp.path();
    source(&cwd.join("second"), "notes/reports", "a");
    fs::write(
        cwd.join("second/notes/reports/a.md"),
        "---\ntitle: \"Shared marker\"\nid: \"260101-a\"\n---\nsecond body\n",
    )
    .unwrap();
    let shown = successful(&invoke(cwd, &["show", "260101-a", "--json"]));
    let sources = shown["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    for (i, marker) in ["needle in body", "second body"].iter().enumerate() {
        assert_eq!(sources[i]["ok"], true);
        assert_eq!(sources[i]["result"]["id"], "260101-a");
        assert!(
            sources[i]["result"]["markdown"]
                .as_str()
                .unwrap()
                .contains(marker)
        );
    }
    fs::remove_file(cwd.join("first/research/reports/investigation-index.json")).unwrap();
    let output = invoke(cwd, &["show", "260101-a", "--json"]);
    assert_eq!(output.status.code(), Some(1));
    let value = parse(&output);
    assert_eq!(value["ok"], false);
    assert_eq!(value["error"]["code"], "source-query-failed");
    let sources = value["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    assert_eq!(sources[0]["error"]["code"], "index-not-found");
    assert_eq!(sources[0]["ok"], false);
    assert_eq!(sources[1]["ok"], true);
    assert!(
        sources[1]["result"]["markdown"]
            .as_str()
            .unwrap()
            .contains("second body")
    );
}

#[test]
fn grouped_trace_keeps_each_sources_own_graph() {
    let temp = setup();
    let cwd = temp.path();
    source(&cwd.join("second"), "notes/reports", "a");
    let index_path = cwd.join("second/notes/reports/investigation-index.json");
    let mut index: Value = serde_json::from_slice(&fs::read(&index_path).unwrap()).unwrap();
    index["entries"]["260101-a"]["relations"] = json!([{"type":"补充", "target":"260101-b"}]);
    fs::write(index_path, serde_json::to_vec(&index).unwrap()).unwrap();
    let output = successful(&invoke(cwd, &["trace", "260101-a", "--json"]));
    let sources = output["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    for source in sources {
        assert_eq!(source["ok"], true);
        assert_eq!(source["result"]["anchorId"], "260101-a");
    }
    assert_eq!(sources[0]["result"]["traceIds"], json!(["260101-a"]));
    assert_eq!(
        sources[1]["result"]["traceIds"],
        json!(["260101-a", "260101-b"])
    );
}

fn complete_report(id: &str, marker: &str) -> String {
    format!(
        "---\ntitle: \"Title\"\nid: \"{id}\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"test\"\nrelations: []\n---\n\n## 形成时背景\nBackground\n\n## 调查目的\nPurpose\n\n## 调查范围与依据\nEvidence\n\n## 调查结果与边界\n{marker}\n"
    )
}

fn candidate_sources() -> tempfile::TempDir {
    let temp = setup();
    for (dir, marker) in [
        ("first/research/reports", "first candidate"),
        ("second/notes/reports", "second candidate"),
    ] {
        fs::write(
            temp.path().join(dir).join("_candidate.260101-draft"),
            complete_report("260101-draft", marker),
        )
        .unwrap();
    }
    temp
}

#[test]
fn grouped_candidates_returns_each_sources_candidates() {
    let temp = candidate_sources();
    let value = successful(&invoke(temp.path(), &["candidates", "--json"]));
    let sources = value["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    for (i, marker) in ["first candidate", "second candidate"].iter().enumerate() {
        assert_eq!(sources[i]["ok"], true);
        let candidates = sources[i]["result"]["candidates"].as_array().unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0]["id"], "260101-draft");
        assert!(candidates[0]["markdown"].as_str().unwrap().contains(marker));
    }
}

#[test]
fn grouped_show_candidate_reads_same_id_independently() {
    let temp = candidate_sources();
    let value = successful(&invoke(
        temp.path(),
        &["show-candidate", "260101-draft", "--json"],
    ));
    let sources = value["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    for (i, marker) in ["first candidate", "second candidate"].iter().enumerate() {
        assert_eq!(sources[i]["ok"], true);
        let candidate = &sources[i]["result"]["candidate"];
        assert_eq!(candidate["id"], "260101-draft");
        assert_eq!(candidate["readiness"]["scaffoldValid"], true);
        assert!(candidate["markdown"].as_str().unwrap().contains(marker));
    }
}

#[test]
fn grouped_check_reports_current_sources_and_preserves_partial_failure() {
    let temp = setup();
    let cwd = temp.path();
    for (root, dir, name) in [
        ("first", "research/reports", "a"),
        ("second", "notes/reports", "b"),
    ] {
        fs::write(
            cwd.join(root).join(dir).join(format!("{name}.md")),
            complete_report(&format!("260101-{name}"), "Result"),
        )
        .unwrap();
        successful(&invoke(
            cwd,
            &[
                "sync-index",
                "--root",
                root,
                "--investigations-dir",
                dir,
                "--json",
            ],
        ));
    }
    let checked = successful(&invoke(cwd, &["check", "--json"]));
    let sources = checked["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    for source in sources {
        assert_eq!(source["ok"], true);
        assert_eq!(source["result"]["formalCount"], 1);
        assert_eq!(source["result"]["indexState"], "current");
    }
    fs::write(cwd.join("first/research/reports/a.md"), "broken").unwrap();
    let failed = invoke(cwd, &["check", "--json"]);
    assert_eq!(failed.status.code(), Some(1));
    let value = parse(&failed);
    assert_eq!(value["ok"], false);
    assert_eq!(value["error"]["code"], "source-query-failed");
    let sources = value["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    assert_eq!(sources[0]["ok"], false);
    assert!(
        sources[0]["diagnostics"]
            .as_array()
            .is_some_and(|items| !items.is_empty())
    );
    assert_eq!(sources[1]["ok"], true);
    assert_eq!(sources[1]["result"]["indexState"], "current");
}
