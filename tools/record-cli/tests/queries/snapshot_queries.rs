use super::*;

#[test]
fn investigation_list_filters_pages_and_keeps_full_snapshot_facets() {
    let bytes = fixture(
        "investigations",
        json!({
            "260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"First question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["blue"],"title":"First report"},
            "260202-two":{"formedAt":"2026-02-02T00:00:00Z","name":"two","question":"Second question","relations":[],"resourceIds":[],"sourcePath":"260202-two.md","tags":["red"],"title":"Second report"}
        }),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let result = iq::project_list(
        &snapshot,
        &options(),
        None,
        None,
        "fixture/index.json".into(),
    )
    .unwrap();
    assert_eq!(result.total, 2);
    assert_eq!(result.entries[0].id, "260202-two");
    assert_eq!(result.facets.record_count, 2);
    let mut filtered = options();
    filtered.tags.push("blue".into());
    let result = iq::project_list(
        &snapshot,
        &filtered,
        None,
        None,
        "fixture/index.json".into(),
    )
    .unwrap();
    assert_eq!(result.total, 1);
    assert_eq!(result.entries[0].id, "260101-one");
    assert_eq!(result.facets.record_count, 2);
    filtered.relation.related_to = Some("missing".into());
    assert!(
        iq::project_list(
            &snapshot,
            &filtered,
            None,
            None,
            "fixture/index.json".into()
        )
        .is_err()
    );
}
#[test]
fn decision_list_default_filter_and_facets_include_archived_records() {
    let state = |name: &str, path: &str, status: &str, created: &str| json!({"name":name,"sourcePath":path,"title":"A clear title","status":status,"alignment":"aligned","createdAt":created,"purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":[]});
    let bytes = fixture(
        "decisions",
        json!({"260101-one":state("one","260101-one.md","active","2026-01-01T00:00:00Z"),"260202-two":state("two","archive/260202-two.md","archived","2026-02-02T00:00:00Z")}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let opts = options();
    let result = dq::project_list(
        &snapshot,
        dq::ListProjection {
            options: &opts,
            status: StatusFilter::Active,
            alignment: AlignmentFilter::All,
            created_from: None,
            created_to: None,
        },
    )
    .unwrap();
    assert_eq!(result.total, 1);
    assert_eq!(result.records[0].decision_id, "260101-one");
    assert_eq!(result.facets.record_count, 2);
    assert_eq!(result.facets.statuses.archived, 1);
}

#[test]
fn investigation_trace_blocks_a_split_as_a_whole() {
    use record_cli::queries::{options::TraceOptions, trace::RequestedDirection};
    let state = |name: &str, id: &str, date: &str, relations: Value| json!({"formedAt":date,"name":name,"question":"A clear question","relations":relations,"resourceIds":[],"sourcePath":format!("{id}.md"),"tags":["topic"],"title":"A clear title"});
    let bytes = fixture(
        "investigations",
        json!({"260101-one":state("one","260101-one","2026-01-01T00:00:00Z",json!([])),"260201-two":state("two","260201-two","2026-02-01T00:00:00Z",json!([{"type":"拆分","target":"260101-one"}])),"260202-three":state("three","260202-three","2026-02-02T00:00:00Z",json!([{"type":"拆分","target":"260101-one"}]))}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let result = iq::project_trace(
        &snapshot,
        &TraceOptions {
            selector: "one".into(),
            direction: RequestedDirection::Successors,
            depth: Some(5),
            max_records: 2,
        },
    )
    .unwrap();
    let value = serde_json::to_value(result).unwrap();
    assert_eq!(value["traceIds"], json!(["260101-one"]));
    assert_eq!(
        value["blockedEvent"],
        json!({"kind":"split","recordIds":["260101-one","260201-two","260202-three"],"requiredMaxRecords":3})
    );
    assert_eq!(
        value["coverage"],
        json!({"complete":false,"stoppedBy":["max-records"]})
    );
    assert_eq!(value["warnings"], json!([]));
    assert_eq!(
        value,
        json!({
            "status":"ok", "anchorId":"260101-one", "direction":"successors",
            "limits":{"depth":5,"maxRecords":2},
            "coverage":{"complete":false,"stoppedBy":["max-records"]},
            "traceIds":["260101-one"], "contextIds":[],
            "frontier":[{"fromId":"260101-one","direction":"successors","reason":"max-records","nextIds":["260201-two","260202-three"]}],
            "blockedEvent":{"kind":"split","recordIds":["260101-one","260201-two","260202-three"],"requiredMaxRecords":3},
            "entries":{"260101-one":{"title":"A clear title","formedAt":"2026-01-01T00:00:00Z","question":"A clear question","tags":["topic"],"relations":[]}},
            "warnings":[]
        })
    );
}

#[test]
fn decision_trace_preserves_original_success_shape() {
    use record_cli::queries::{options::TraceOptions, trace::RequestedDirection};
    let state = |name: &str, path: &str, status: &str, created: &str, relations: Value| json!({"name":name,"sourcePath":path,"title":"A clear title","status":status,"alignment":"aligned","createdAt":created,"purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":relations});
    let bytes = fixture(
        "decisions",
        json!({"260101-one":state("one","archive/260101-one.md","archived","2026-01-01T00:00:00Z",json!([])),"260201-two":state("two","260201-two.md","active","2026-02-01T00:00:00Z",json!([{"type":"修订","target":"260101-one"}]))}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let result = dq::project_trace(
        &snapshot,
        &TraceOptions {
            selector: "two".into(),
            direction: RequestedDirection::Predecessors,
            depth: Some(1),
            max_records: 5,
        },
    )
    .unwrap();
    let value = serde_json::to_value(result).unwrap();
    assert_eq!(value["traceIds"], json!(["260101-one", "260201-two"]));
    assert_eq!(value["coverage"], json!({"complete":true,"stoppedBy":[]}));
    assert_eq!(
        value["source"],
        json!({"kind":"published-index","currentness":"unchecked","fallback":false})
    );
    assert!(value.get("warnings").is_none());
    assert_eq!(
        value["entries"]["260201-two"]["relations"],
        json!([{"type":"修订","target":"260101-one"}])
    );
}

#[test]
fn investigation_cli_json_list_and_missing_index_are_separate_outcomes() {
    use std::{fs, process::Command};
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join("docs/investigations");
    fs::create_dir_all(&directory).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"First question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"First report"}}),
    );
    fs::write(directory.join("investigation-index.json"), bytes).unwrap();
    let invoke = |dir: &str| {
        Command::new(env!("CARGO_BIN_EXE_investigation-report"))
            .args([
                "list",
                "--json",
                "--root",
                temp.path().to_str().unwrap(),
                "--investigations-dir",
                dir,
            ])
            .output()
            .unwrap()
    };
    let ok = invoke("docs/investigations");
    assert!(ok.status.success());
    let body: Value = serde_json::from_slice(&ok.stdout).unwrap();
    assert_eq!(body["version"], 2);
    assert_eq!(body["ok"], true);
    assert_eq!(body["result"]["entries"][0]["id"], "260101-one");
    let failure = invoke("missing");
    assert!(!failure.status.success());
    let body: Value = serde_json::from_slice(&failure.stdout).unwrap();
    assert_eq!(body["ok"], false);
    assert_eq!(body["error"]["code"], "index-not-found");
}

#[test]
fn show_reads_selected_utf8_checks_identity_and_reports_stale_revision() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let directory = root.path().join("docs/investigations");
    fs::create_dir_all(&directory).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"First question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"First report"}}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let path = directory.join("260101-one.md");
    let text = "\u{feff}---\ntitle: \"First report\"\nid: \"260101-one\"\n---\nCurrent body\n";
    fs::write(&path, text).unwrap();
    let root = record_cli::source::open_root(root.path()).unwrap();
    let result = iq::show(&root, "docs/investigations", &snapshot, "one").unwrap();
    assert_eq!(result.markdown, text);
    assert_eq!(result.warnings.len(), 1);
    let mut current: Value = serde_json::from_slice(&bytes).unwrap();
    current["sourceRevision"]["entries"]["260101-one"] =
        json!("sha256:df83172e686dfbbc6f90fdf6a1bc70f210f7405c9dad10e8ba8023417c974949");
    let current_snapshot = QuerySnapshot::new(
        parse_index(
            &serde_json::to_vec(&current).unwrap(),
            &investigation::Definition,
        )
        .unwrap(),
    );
    assert!(
        iq::show(&root, "docs/investigations", &current_snapshot, "one")
            .unwrap()
            .warnings
            .is_empty()
    );
    fs::write(&path, "---\ntitle: \"Wrong\"\nid: \"260101-other\"\n---\n").unwrap();
    assert!(iq::show(&root, "docs/investigations", &snapshot, "one").is_err());
    fs::write(&path, [0xff]).unwrap();
    assert!(iq::show(&root, "docs/investigations", &snapshot, "one").is_err());
}

#[test]
fn decision_show_rejects_mismatched_identity_and_keeps_current_body() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let directory = root.path().join("docs/decisions");
    fs::create_dir_all(&directory).unwrap();
    let bytes = fixture(
        "decisions",
        json!({"260101-one":{"name":"one","sourcePath":"260101-one.md","title":"A clear title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":[]}}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let root_handle = record_cli::source::open_root(root.path()).unwrap();
    let path = directory.join("260101-one.md");
    let body = "---\nid: 260101-one\n---\nNot a valid full decision, but readable.\n";
    fs::write(&path, body).unwrap();
    let result = dq::show(&root_handle, "docs/decisions", &snapshot, "one").unwrap();
    assert_eq!(result.body, body);
    assert_eq!(result.warnings.len(), 1);
    fs::write(&path, "---\nid: 260101-other\n---\nBody\n").unwrap();
    assert!(dq::show(&root_handle, "docs/decisions", &snapshot, "one").is_err());
}

#[test]
fn decision_trace_blocks_full_reallocation_event() {
    use record_cli::queries::{options::TraceOptions, trace::RequestedDirection};
    let state = |name: &str, path: &str, status: &str, relations: Value| json!({"name":name,"sourcePath":path,"title":"A clear title","status":status,"alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":relations});
    let bytes = fixture(
        "decisions",
        json!({
          "260101-old-a":state("old-a","archive/260101-old-a.md","archived",json!([])),
          "260101-old-b":state("old-b","archive/260101-old-b.md","archived",json!([])),
          "260201-new-a":state("new-a","260201-new-a.md","active",json!([{"type":"重划","target":"260101-old-a"},{"type":"重划","target":"260101-old-b"}])),
          "260201-new-b":state("new-b","260201-new-b.md","active",json!([{"type":"重划","target":"260101-old-b"}]))
        }),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let result = dq::project_trace(
        &snapshot,
        &TraceOptions {
            selector: "260201-new-a".into(),
            direction: RequestedDirection::Predecessors,
            depth: Some(5),
            max_records: 3,
        },
    )
    .unwrap();
    let json = serde_json::to_value(result).unwrap();
    assert_eq!(json["traceIds"], json!(["260201-new-a"]));
    assert_eq!(
        json["blockedEvent"],
        json!({"kind":"reallocation","recordIds":["260101-old-a","260101-old-b","260201-new-a","260201-new-b"],"requiredMaxRecords":4})
    );
}
