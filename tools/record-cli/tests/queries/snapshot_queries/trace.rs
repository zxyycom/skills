use super::*;

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
    let state = |name: &str, path: &str, status: &str, created: &str, relations: Value| json!({"name":name,"sourcePath":path,"title":"A clear title","status":status,"alignment":if status == "archived" {"unaligned"} else {"aligned"},"createdAt":created,"purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":relations});
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
    assert_eq!(value["entries"]["260101-one"]["status"], "archived");
    assert_eq!(value["entries"]["260101-one"]["alignment"], "unaligned");
    assert_eq!(value["entries"]["260201-two"]["status"], "active");
    assert_eq!(value["entries"]["260201-two"]["alignment"], "aligned");
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

#[test]
fn decision_trace_events_are_atomic_and_context_promotes_only_when_reached() {
    use record_cli::queries::{options::TraceOptions, trace::RequestedDirection};
    let state = |name: &str, archived: bool, relations: Value| json!({"name":name,"sourcePath":format!("{}260101-{name}.md", if archived { "archive/" } else { "" }),"title":"A clear title","status":if archived { "archived" } else { "active" },"alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":relations});
    let graphs = [
        (
            "split",
            json!({"260101-old":state("old",true,json!([])),"260101-new-a":state("new-a",false,json!([{"type":"拆分","target":"260101-old"}])),"260101-new-b":state("new-b",false,json!([{"type":"拆分","target":"260101-old"}]))}),
            "260101-new-a",
            RequestedDirection::Predecessors,
            vec!["260101-new-a", "260101-old"],
            vec!["260101-new-b"],
        ),
        (
            "merge",
            json!({"260101-old-a":state("old-a",true,json!([])),"260101-old-b":state("old-b",true,json!([])),"260101-new":state("new",false,json!([{"type":"归并","target":"260101-old-a"},{"type":"归并","target":"260101-old-b"}]))}),
            "260101-old-a",
            RequestedDirection::Successors,
            vec!["260101-new", "260101-old-a"],
            vec!["260101-old-b"],
        ),
        (
            "reallocation",
            json!({"260101-old-a":state("old-a",true,json!([])),"260101-old-b":state("old-b",true,json!([])),"260101-old-c":state("old-c",true,json!([])),"260101-new-a":state("new-a",false,json!([{"type":"重划","target":"260101-old-a"},{"type":"重划","target":"260101-old-b"}])),"260101-new-b":state("new-b",false,json!([{"type":"重划","target":"260101-old-b"},{"type":"重划","target":"260101-old-c"}]))}),
            "260101-new-a",
            RequestedDirection::Predecessors,
            vec!["260101-new-a", "260101-old-a", "260101-old-b"],
            vec!["260101-new-b", "260101-old-c"],
        ),
    ];
    for (kind, entries, anchor, direction, trace, context) in graphs {
        let bytes = fixture("decisions", entries);
        let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
        let mut event_members = trace.clone();
        event_members.extend(context.iter().copied());
        event_members.sort_unstable();
        let total = u64::try_from(event_members.len()).unwrap();
        let query = |direction, depth, max_records| {
            serde_json::to_value(
                dq::project_trace(
                    &snapshot,
                    &TraceOptions {
                        selector: anchor.into(),
                        direction,
                        depth,
                        max_records,
                    },
                )
                .unwrap(),
            )
            .unwrap()
        };
        let blocked = query(direction, Some(1), total - 1);
        assert_eq!(blocked["traceIds"], json!([anchor]), "{kind}");
        assert_eq!(blocked["contextIds"], json!([]), "{kind}");
        assert_eq!(blocked["blockedEvent"]["kind"], kind);
        assert_eq!(blocked["blockedEvent"]["recordIds"], json!(event_members));
        assert_eq!(blocked["blockedEvent"]["requiredMaxRecords"], total);
        assert_eq!(blocked["coverage"]["complete"], false);
        let admitted = query(direction, Some(1), total);
        assert_eq!(admitted["traceIds"], json!(trace), "{kind}");
        assert_eq!(admitted["contextIds"], json!(context), "{kind}");
        assert!(admitted.get("blockedEvent").is_none(), "{kind}");
        if kind == "reallocation" {
            let expanded = query(RequestedDirection::Both, None, total);
            assert_eq!(
                expanded["traceIds"],
                json!([
                    "260101-new-a",
                    "260101-new-b",
                    "260101-old-a",
                    "260101-old-b",
                    "260101-old-c"
                ])
            );
            assert_eq!(expanded["contextIds"], json!([]));
            assert_eq!(expanded["coverage"]["complete"], true);
        }
    }
}

#[test]
fn decision_trace_cli_validates_depth_and_single_value_options() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = json!({"name":"one","sourcePath":"260101-one.md","title":"Title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    fs::write(
        dir.join("decision-index.json"),
        fixture("decisions", json!({"260101-one":state})),
    )
    .unwrap();
    let run = |extra: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args([
                "trace",
                "one",
                "--json",
                "--root",
                root.path().to_str().unwrap(),
            ])
            .args(extra)
            .output()
            .unwrap()
    };
    for args in [&["--depth", "0"][..], &["--depth", "all"][..]] {
        let out = run(args);
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stdout)
        );
    }
    for args in [
        &["--depth", "-1"][..],
        &["--depth", "bogus"][..],
        &["--depth", "1", "--depth", "2"][..],
        &["--max-records", "0"][..],
    ] {
        let out = run(args);
        assert_eq!(out.status.code(), Some(2));
        let value: Value = serde_json::from_slice(&out.stdout).unwrap();
        assert_eq!(value["error"]["code"], "invalid-arguments");
    }
}

#[test]
fn decision_merge_event_includes_ordinary_direct_neighbor_as_trace() {
    use record_cli::queries::{options::TraceOptions, trace::RequestedDirection};
    let state = |name: &str, archived: bool, relations: Value| json!({"name":name,"sourcePath":format!("{}260101-{name}.md", if archived { "archive/" } else { "" }),"title":"Title","status":if archived { "archived" } else { "active" },"alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":relations});
    let bytes = fixture(
        "decisions",
        json!({
            "260101-p2":state("p2",true,json!([])),
            "260101-p1":state("p1",true,json!([{"type":"修订","target":"260101-p2"}])),
            "260101-merge":state("merge",false,json!([{"type":"归并","target":"260101-p1"},{"type":"归并","target":"260101-p2"}]))
        }),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let result = dq::project_trace(
        &snapshot,
        &TraceOptions {
            selector: "260101-p2".into(),
            direction: RequestedDirection::Successors,
            depth: Some(1),
            max_records: 3,
        },
    )
    .unwrap();
    let value = serde_json::to_value(result).unwrap();
    assert_eq!(
        value["traceIds"],
        json!(["260101-merge", "260101-p1", "260101-p2"])
    );
    assert_eq!(value["contextIds"], json!([]));
    assert!(value.get("blockedEvent").is_none());
}
