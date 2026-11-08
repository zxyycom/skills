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
fn decision_cli_default_list_selects_active_without_status_flag() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = |name: &str, path: &str, status: &str, created: &str| json!({"name":name,"sourcePath":path,"title":"A clear title","status":status,"alignment":"aligned","createdAt":created,"purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":[]});
    fs::write(dir.join("decision-index.json"), fixture("decisions", json!({"260101-one":state("one","260101-one.md","active","2026-01-01T00:00:00Z"),"260202-two":state("two","archive/260202-two.md","archived","2026-02-02T00:00:00Z")}))).unwrap();
    let out = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args(["list", "--json", "--root", root.path().to_str().unwrap()])
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let value: Value = serde_json::from_slice(&out.stdout).unwrap();
    let records = value["result"]["records"].as_array().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["decisionId"], "260101-one");
}

#[test]
fn decision_cli_combines_status_alignment_and_all_tags() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = |name: &str, status: &str, alignment: &str, tags: Vec<&str>| json!({"name":name,"sourcePath":format!("{}260101-{name}.md", if status == "archived" { "archive/" } else { "" }),"title":"Title","status":status,"alignment":alignment,"createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Decision","tags":tags,"relations":[]});
    let entries = json!({"260101-one":state("one","active","aligned",vec!["common","two"]),"260101-two":state("two","active","unaligned",vec!["common","two"]),"260101-three":state("three","archived","unaligned",vec!["common","two"]),"260101-four":state("four","active","unaligned",vec!["common"])});
    fs::write(
        dir.join("decision-index.json"),
        fixture("decisions", entries),
    )
    .unwrap();
    let run = |extra: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(["list", "--json", "--root", root.path().to_str().unwrap()])
            .args(extra)
            .output()
            .unwrap()
    };
    let result = run(&[
        "--status",
        "active",
        "--alignment",
        "unaligned",
        "--tag",
        "common",
        "--tag",
        "two",
    ]);
    assert!(
        result.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    let records = value["result"]["records"].as_array().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["decisionId"], "260101-two");
    let empty = run(&[
        "--status",
        "archived",
        "--alignment",
        "aligned",
        "--tag",
        "common",
        "--tag",
        "two",
    ]);
    assert!(empty.status.success());
    let value: Value = serde_json::from_slice(&empty.stdout).unwrap();
    assert_eq!(value["result"]["records"].as_array().unwrap().len(), 0);
    let all = run(&["--status", "all"]);
    assert!(all.status.success());
    let all: Value = serde_json::from_slice(&all.stdout).unwrap();
    let statuses: Vec<_> = all["result"]["records"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["status"].as_str().unwrap())
        .collect();
    assert!(statuses.contains(&"active"));
    assert!(statuses.contains(&"archived"));
    let empty_tag = run(&["--tag", "not-present"]);
    assert!(empty_tag.status.success());
    let value: Value = serde_json::from_slice(&empty_tag.stdout).unwrap();
    assert!(value["result"]["records"].as_array().unwrap().is_empty());
}

#[test]
fn decision_cli_date_page_and_argument_boundaries() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = |name: &str, created: &str| json!({"name":name,"sourcePath":format!("260101-{name}.md"),"title":"Title","status":"active","alignment":"aligned","createdAt":created,"purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    fs::write(dir.join("decision-index.json"), fixture("decisions", json!({"260101-a":state("a","2026-01-01T00:00:00Z"),"260101-b":state("b","2026-01-01T02:00:00+02:00"),"260101-c":state("c","2026-01-01T01:00:00Z")}))).unwrap();
    let run = |args: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(["list", "--json", "--root", root.path().to_str().unwrap()])
            .args(args)
            .output()
            .unwrap()
    };
    let result = run(&[
        "--created-from",
        "2026-01-01T02:00:00+02:00",
        "--created-to",
        "2026-01-01T00:00:00Z",
        "--limit",
        "1",
        "--offset",
        "1",
    ]);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stdout)
    );
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(value["result"]["total"], 2);
    assert_eq!(value["result"]["records"][0]["decisionId"], "260101-b");
    assert_eq!(value["result"]["facets"]["recordCount"], 3);
    for args in [
        &["--created-from", "bad"][..],
        &[
            "--created-from",
            "2026-01-02T00:00:00Z",
            "--created-to",
            "2026-01-01T00:00:00Z",
        ][..],
        &["--limit", "0"][..],
        &["--limit", "1001"][..],
        &["--offset", "-1"][..],
        &["--limit", "1", "--limit", "2"][..],
    ] {
        let failed = run(args);
        assert_eq!(
            failed.status.code(),
            Some(2),
            "{:?}: {}",
            args,
            String::from_utf8_lossy(&failed.stdout)
        );
        let value: Value = serde_json::from_slice(&failed.stdout).unwrap();
        assert_eq!(value["ok"], false);
    }
}

#[test]
fn decision_list_facets_cover_full_snapshot_and_empty_collection() {
    let state = |name: &str,
                 path: &str,
                 status: &str,
                 alignment: &str,
                 created: &str,
                 tags: Value| {
        json!({"name":name,"sourcePath":path,"title":"A clear title","status":status,"alignment":alignment,"createdAt":created,"purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":tags,"relations":[]})
    };
    let entries = json!({
        "250228-a":state("a","archive/a.md","archived","unaligned","2025-03-01T00:30:00+01:00",json!(["blue","shared"])),
        "250301-b":state("b","b.md","active","aligned","2025-03-01T00:45:00Z",json!(["red","shared"]))
    });
    let project = |entries| {
        let snapshot = QuerySnapshot::new(
            parse_index(&fixture("decisions", entries), &decision::Definition).unwrap(),
        );
        serde_json::to_value(
            dq::project_list(
                &snapshot,
                dq::ListProjection {
                    options: &options(),
                    status: StatusFilter::Active,
                    alignment: AlignmentFilter::All,
                    created_from: None,
                    created_to: None,
                },
            )
            .unwrap(),
        )
        .unwrap()
    };
    let result = project(entries);
    assert_eq!(result["total"], 1);
    assert_eq!(
        result["facets"],
        json!({
            "recordCount":2,
            "statuses":{"active":1,"archived":1},
            "alignments":{"aligned":1,"unaligned":1},
            "tags":[{"tag":"blue","count":1},{"tag":"red","count":1},{"tag":"shared","count":2}],
            "createdAt":{"earliest":"2025-02-28T23:30:00.000Z","latest":"2025-03-01T00:45:00.000Z","months":[{"month":"2025-02","count":1},{"month":"2025-03","count":1}]}
        })
    );
    let empty = project(json!({}));
    assert_eq!(empty["total"], 0);
    assert_eq!(
        empty["facets"],
        json!({
            "recordCount":0,"statuses":{"active":0,"archived":0},
            "alignments":{"aligned":0,"unaligned":0},"tags":[],
            "createdAt":{"earliest":null,"latest":null,"months":[]}
        })
    );
}
