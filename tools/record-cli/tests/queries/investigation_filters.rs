use super::*;
use std::{fs, process::Command};

#[test]
fn investigation_list_and_search_filter_directions_before_paging_and_keep_evidence_separate() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let state = |name: &str, formed: &str, relations: Value| json!({"name":name,"sourcePath":format!("{name}.md"),"title":"Shared marker","formedAt":formed,"question":"Question","tags":["test"],"relations":relations,"resourceIds":[]});
    let entries = json!({"260101-a":state("a","2026-01-01T00:00:00Z",json!([])),"260201-b":state("b","2026-02-01T00:00:00Z",json!([{"type":"补充","target":"260101-a","summary":"edge detail"}])),"260301-c":state("c","2026-03-01T00:00:00Z",json!([{"type":"复查","target":"260201-b"}]))});
    fs::write(
        dir.join("investigation-index.json"),
        fixture("investigations", entries),
    )
    .unwrap();
    let run = |args: &[&str]| {
        let result = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
            .args(args)
            .args(["--root", root.path().to_str().unwrap(), "--json"])
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stdout)
        );
        serde_json::from_slice::<Value>(&result.stdout).unwrap()["result"].clone()
    };
    for (direction, id) in [("predecessors", "260101-a"), ("successors", "260301-c")] {
        let result = run(&["list", "--related-to", "b", "--direction", direction]);
        assert_eq!(result["total"], 1);
        assert_eq!(result["entries"][0]["id"], id);
        assert_eq!(
            result["entries"][0]["filterRelations"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    let page = run(&[
        "list",
        "--related-to",
        "b",
        "--direction",
        "both",
        "--limit",
        "1",
        "--offset",
        "1",
    ]);
    assert_eq!(page["total"], 2);
    assert_eq!(page["entries"].as_array().unwrap().len(), 1);
    assert_eq!(page["facets"]["recordCount"], 3);
    let search = run(&[
        "search",
        "Shared",
        "--in",
        "metadata",
        "--related-to",
        "b",
        "--relation-type",
        "补充",
    ]);
    let records = search["entries"].as_array().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["id"], "260101-a");
    assert!(
        records[0]["matchedFields"]
            .as_array()
            .unwrap()
            .iter()
            .any(|field| field == "title")
    );
    assert!(
        records[0]["matchedRelations"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(records[0]["filterRelations"].as_array().unwrap().len(), 1);
}
