use super::*;

#[test]
fn investigation_metadata_search_counts_all_matches_before_limit() {
    use record_cli::queries::{
        matcher::MatchMode,
        options::{SearchOptions, SearchScope},
    };
    let state = |name: &str, id: &str| json!({"formedAt":"2026-01-01T00:00:00Z","name":name,"question":"Blue question","relations":[],"resourceIds":[],"sourcePath":format!("{id}.md"),"tags":["topic"],"title":"Red title"});
    let bytes = fixture(
        "investigations",
        json!({"260101-one":state("one","260101-one"),"260101-two":state("two","260101-two")}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let options = SearchOptions {
        text: "RED blue".into(),
        scope: SearchScope::Metadata,
        mode: MatchMode::All,
        tags: vec![],
        relation: RelationFilter {
            related_to: None,
            direction: None,
            relation_type: None,
        },
        limit: 1,
    };
    let result =
        iq::project_metadata(&snapshot, &options, None, None, "index.json".into()).unwrap();
    let value = serde_json::to_value(result).unwrap();
    assert_eq!(value["entries"][0]["id"], "260101-one");
    assert_eq!(
        value["entries"][0]["matchedFields"],
        json!(["title", "question"])
    );
    assert_eq!(
        value["searchInfo"]["counts"],
        json!({"matched":{"value":2,"precision":"exact"},"returned":1})
    );
    assert_eq!(
        value["searchInfo"]["coverage"],
        json!({"scanComplete":true,"resultsComplete":false,"previewsComplete":null,"reasons":["max-records"]})
    );
    assert_eq!(
        value["warnings"],
        json!(["search results limited: max-records"])
    );
}

#[test]
fn decision_metadata_search_preserves_match_evidence_and_exact_counts() {
    use record_cli::queries::{
        matcher::MatchMode,
        options::{SearchOptions, SearchScope},
    };
    let state = |name: &str, id: &str| json!({"name":name,"sourcePath":format!("{id}.md"),"title":"Red title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Blue purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":[]});
    let bytes = fixture(
        "decisions",
        json!({"260101-one":state("one","260101-one"),"260101-two":state("two","260101-two")}),
    );
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let options = SearchOptions {
        text: "red blue".into(),
        scope: SearchScope::Metadata,
        mode: MatchMode::All,
        tags: vec![],
        relation: RelationFilter {
            related_to: None,
            direction: None,
            relation_type: None,
        },
        limit: 1,
    };
    let result = dq::project_metadata(
        &snapshot,
        &options,
        StatusFilter::Active,
        AlignmentFilter::All,
    )
    .unwrap();
    let value = serde_json::to_value(result).unwrap();
    assert_eq!(value["records"][0]["decisionId"], "260101-one");
    assert_eq!(
        value["records"][0]["matchedFields"],
        json!(["title", "purpose"])
    );
    assert_eq!(
        value["searchInfo"]["counts"],
        json!({"matched":{"value":2,"precision":"exact"},"returned":1})
    );
    assert_eq!(
        value["searchInfo"]["coverage"]["reasons"],
        json!(["max-records"])
    );
}

#[test]
fn decision_metadata_search_uses_only_published_segments_and_relation_summaries() {
    use record_cli::queries::{
        matcher::MatchMode,
        options::{SearchOptions, SearchScope},
    };
    let old = json!({"name":"old","sourcePath":"archive/260101-old.md","title":"Old title","status":"archived","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    let current = json!({"name":"new","sourcePath":"260102-new.md","title":"Ｒｅｄ title","status":"active","alignment":"aligned","createdAt":"2026-01-02T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["blue"],"relations":[{"type":"修订","target":"260101-old","summary":"special reason"}]});
    let snapshot = QuerySnapshot::new(
        parse_index(
            &fixture("decisions", json!({"260101-old":old,"260102-new":current})),
            &decision::Definition,
        )
        .unwrap(),
    );
    let search = |text: &str, mode: MatchMode| {
        let opts = SearchOptions {
            text: text.into(),
            scope: SearchScope::Metadata,
            mode,
            tags: vec![],
            relation: RelationFilter {
                related_to: None,
                direction: None,
                relation_type: None,
            },
            limit: 20,
        };
        serde_json::to_value(
            dq::project_metadata(&snapshot, &opts, StatusFilter::All, AlignmentFilter::All)
                .unwrap(),
        )
        .unwrap()
    };
    let all = search("red blue", MatchMode::All);
    assert_eq!(all["records"][0]["decisionId"], "260102-new");
    assert_eq!(all["records"][0]["matchedFields"], json!(["title", "tags"]));
    assert!(all["records"][0].get("previews").is_none());
    assert!(
        search("red blue", MatchMode::Phrase)["records"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let relation = search("special reason", MatchMode::Phrase);
    assert_eq!(relation["records"].as_array().unwrap().len(), 1);
    assert_eq!(
        relation["records"][0]["matchedRelations"],
        json!([{"type":"修订","target":"260101-old","summary":"special reason"}])
    );
    assert!(
        search("修订", MatchMode::Phrase)["records"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let target_text = search("260101-old", MatchMode::Phrase);
    assert!(
        target_text["records"]
            .as_array()
            .unwrap()
            .iter()
            .all(|record| record["decisionId"] != "260102-new")
    );
}

#[test]
fn decision_metadata_cli_requires_index_and_ignores_source_bytes() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = json!({"name":"one","sourcePath":"260101-one.md","title":"Indexed marker","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    let mut archived = state.clone();
    archived["name"] = json!("old");
    archived["status"] = json!("archived");
    archived["alignment"] = json!("unaligned");
    archived["sourcePath"] = json!("archive/260101-old.md");
    fs::write(
        dir.join("decision-index.json"),
        fixture(
            "decisions",
            json!({"260101-one":state, "260101-old":archived}),
        ),
    )
    .unwrap();
    fs::write(dir.join("260101-one.md"), [0xff, 0xfe]).unwrap();
    let run = || {
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args([
                "search",
                "Indexed",
                "--in",
                "metadata",
                "--json",
                "--root",
                root.path().to_str().unwrap(),
            ])
            .output()
            .unwrap()
    };
    let found = run();
    assert!(
        found.status.success(),
        "{}",
        String::from_utf8_lossy(&found.stdout)
    );
    let result: Value = serde_json::from_slice(&found.stdout).unwrap();
    assert_eq!(result["result"]["records"].as_array().unwrap().len(), 1);
    assert_eq!(result["result"]["records"][0]["decisionId"], "260101-one");
    let archived = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args([
            "search",
            "Indexed",
            "--in",
            "metadata",
            "--status",
            "archived",
            "--json",
            "--root",
            root.path().to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(archived.status.success());
    let archived: Value = serde_json::from_slice(&archived.stdout).unwrap();
    let records = archived["result"]["records"].as_array().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0]["decisionId"], "260101-old");
    assert_eq!(records[0]["sourcePath"], "archive/260101-old.md");
    assert_eq!(records[0]["alignment"], "unaligned");
    let pretty = Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args([
            "search",
            "Indexed",
            "--in",
            "metadata",
            "--root",
            root.path().to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(pretty.status.success());
    let pretty_text = String::from_utf8(pretty.stdout).unwrap();
    assert!(pretty_text.contains("\n  "));
    let pretty_value: Value = serde_json::from_str(&pretty_text).unwrap();
    assert_eq!(pretty_value, result["result"]);
    assert_eq!(String::from_utf8_lossy(&found.stdout).lines().count(), 1);
    fs::remove_file(dir.join("decision-index.json")).unwrap();
    let missing = run();
    assert!(!missing.status.success());
    let result: Value = serde_json::from_slice(&missing.stdout).unwrap();
    assert_eq!(result["ok"], false);
    assert!(String::from_utf8_lossy(&missing.stdout).contains("sync-index"));
}
