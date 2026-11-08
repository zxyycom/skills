use super::*;
use std::{fs, process::Command};

fn state(name: &str, relations: Value) -> Value {
    json!({"name":name,"sourcePath":format!("{name}.md"),"title":"Shared marker","formedAt":"2026-01-01T00:00:00Z","question":"Question","tags":["test"],"relations":relations,"resourceIds":[]})
}

#[test]
fn investigation_admitted_merge_targets_remain_in_budget_frontier() {
    use record_cli::queries::{options::TraceOptions, trace::RequestedDirection};
    let entries = json!({
        "260101-z":state("z",json!([{"type":"归并","target":"260101-b"},{"type":"归并","target":"260101-p"},{"type":"归并","target":"260101-q"}])),
        "260101-b":state("b",json!([])), "260101-p":state("p",json!([])), "260101-q":state("q",json!([])),
        "260101-a":state("a",json!([{"type":"补充","target":"260101-p"}]))
    });
    let bytes = fixture("investigations", entries);
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let result = serde_json::to_value(
        iq::project_trace(
            &snapshot,
            &TraceOptions {
                selector: "z".into(),
                direction: RequestedDirection::Both,
                depth: None,
                max_records: 4,
            },
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(
        result["traceIds"],
        json!(["260101-b", "260101-p", "260101-q", "260101-z"])
    );
    assert_eq!(result["contextIds"], json!([]));
    assert!(result.get("blockedEvent").is_none());
    assert_eq!(
        result["frontier"],
        json!([
            {"fromId":"260101-p","direction":"successors","nextIds":["260101-a","260101-z"],"reason":"max-records"},
            {"fromId":"260101-q","direction":"successors","nextIds":["260101-z"],"reason":"max-records"}
        ])
    );
}

#[test]
fn investigation_relation_evidence_is_stable_under_reversed_entries() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let edges = [
        json!({"type":"归并","target":"260101-b","summary":"B summary"}),
        json!({"type":"归并","target":"260101-c","summary":"C summary"}),
    ];
    let run = |reverse: bool| {
        let rel = edges.to_vec();
        let mut entries = serde_json::Map::new();
        let ids = if reverse {
            vec!["c", "b", "a"]
        } else {
            vec!["a", "b", "c"]
        };
        for id in ids {
            entries.insert(
                format!("260101-{id}"),
                state(id, if id == "a" { json!(rel) } else { json!([]) }),
            );
        }
        fs::write(
            dir.join("investigation-index.json"),
            fixture("investigations", Value::Object(entries)),
        )
        .unwrap();
        let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
            .args([
                "list",
                "--relation-type",
                "归并",
                "--json",
                "--root",
                root.path().to_str().unwrap(),
            ])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stdout)
        );
        let value: Value = serde_json::from_slice(&output.stdout).unwrap();
        value["result"]["entries"].clone()
    };
    let forward = run(false);
    assert_eq!(forward, run(true));
    let entries = forward.as_array().unwrap();
    assert_eq!(entries.len(), 1);
    let evidence: Vec<_> = entries[0]["filterRelations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|edge| (&edge["target"], &edge["summary"]))
        .collect();
    assert_eq!(
        evidence,
        vec![
            (&json!("260101-b"), &json!("B summary")),
            (&json!("260101-c"), &json!("C summary"))
        ]
    );
}

#[test]
fn investigation_cli_global_positions_cwd_and_output_shapes() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("custom");
    fs::create_dir_all(&dir).unwrap();
    fs::write(
        dir.join("investigation-index.json"),
        fixture("investigations", json!({"260101-a":state("a",json!([]))})),
    )
    .unwrap();
    let root_arg = root.path().to_str().unwrap();
    let run = |args: &[&str]| {
        let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
            .current_dir(root.path())
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{args:?}: {}",
            String::from_utf8_lossy(&output.stdout)
        );
        String::from_utf8(output.stdout).unwrap()
    };
    let before = run(&[
        "--root",
        root_arg,
        "--investigations-dir",
        "custom",
        "list",
        "--json",
    ]);
    let after = run(&[
        "list",
        "--root",
        root_arg,
        "--investigations-dir",
        "custom",
        "--json",
    ]);
    let cwd = run(&["--investigations-dir", "custom", "list", "--json"]);
    let envelope: Value = serde_json::from_str(&before).unwrap();
    assert_eq!(envelope["version"], 2);
    assert_eq!(envelope["ok"], true);
    assert_eq!(envelope, serde_json::from_str::<Value>(&after).unwrap());
    assert_eq!(envelope, serde_json::from_str::<Value>(&cwd).unwrap());
    let pretty = run(&["list", "--investigations-dir", "custom"]);
    assert!(pretty.contains("\n  "));
    assert_eq!(
        serde_json::from_str::<Value>(&pretty).unwrap(),
        envelope["result"]
    );
    let trace: Value = serde_json::from_str(&run(&[
        "trace",
        "a",
        "--investigations-dir",
        "custom",
        "--json",
    ]))
    .unwrap();
    assert_eq!(trace["anchorId"], "260101-a");
    assert!(trace.get("result").is_none());
}

#[test]
fn investigation_content_search_keeps_filter_evidence() {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("investigation-index.json"), fixture("investigations", json!({
        "260101-a":state("a",json!([])),
        "260101-b":state("b",json!([{"type":"补充","target":"260101-a","summary":"edge detail"}]))
    }))).unwrap();
    fs::write(
        dir.join("a.md"),
        "---\ntitle: \"Shared marker\"\nid: \"260101-a\"\n---\nneedle in body\n",
    )
    .unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args([
            "search",
            "needle",
            "--in",
            "content",
            "--related-to",
            "b",
            "--json",
            "--root",
            root.path().to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    let entry = &value["result"]["entries"][0];
    assert_eq!(entry["id"], "260101-a");
    assert_eq!(entry["filterRelations"][0]["summary"], "edge detail");
    assert!(
        entry["previews"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["preview"] == "needle in body")
    );
}
