use super::*;

fn investigation_state(name: &str, id: &str) -> Value {
    json!({"formedAt":"2026-01-01T00:00:00Z","name":name,"question":"A question","relations":[],"resourceIds":[],"sourcePath":format!("{id}.md"),"tags":["topic"],"title":"A title"})
}

fn search_investigation_needle(root: &std::path::Path, bytes: &[u8]) -> Value {
    use record_cli::queries::{
        matcher::MatchMode,
        options::{SearchOptions, SearchScope},
    };
    let snapshot = QuerySnapshot::new(parse_index(bytes, &investigation::Definition).unwrap());
    let root = record_cli::source::open_root(root).unwrap();
    let opts = SearchOptions {
        text: "needle".into(),
        scope: SearchScope::Content,
        mode: MatchMode::All,
        tags: vec![],
        relation: RelationFilter {
            related_to: None,
            direction: None,
            relation_type: None,
        },
        limit: 1,
    };
    let result = iq::project_content(
        &root,
        "docs/investigations",
        &snapshot,
        &opts,
        iq::FormationRange {
            from: None,
            to: None,
        },
    )
    .unwrap();
    serde_json::to_value(result).unwrap()
}

#[test]
fn investigation_content_search_counts_hidden_hit_and_exposes_preview_ranges() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":investigation_state("one","260101-one"),"260101-two":investigation_state("two","260101-two")}),
    );
    for id in ["260101-one", "260101-two"] {
        fs::write(
            dir.join(format!("{id}.md")),
            format!("---\ntitle: \"A title\"\nid: \"{id}\"\n---\nneedle text\n"),
        )
        .unwrap();
    }
    let value = search_investigation_needle(root.path(), &bytes);
    assert_eq!(
        value["searchInfo"]["counts"],
        json!({"matched":{"value":2,"precision":"exact"},"returned":1})
    );
    assert_eq!(
        value["searchInfo"]["coverage"],
        json!({"scanComplete":true,"resultsComplete":false,"previewsComplete":true,"reasons":["max-records"]})
    );
    assert_eq!(
        value["entries"][0]["previews"][1],
        json!({"line":5,"column":1,"preview":"needle text","ranges":[{"start":0,"end":6}]})
    );
}

#[test]
fn decision_content_preview_serializes_lone_surrogate_without_replacement() {
    use record_cli::queries::{
        matcher::MatchMode,
        options::{SearchOptions, SearchScope},
    };
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let bytes = fixture(
        "decisions",
        json!({"260101-one":{"name":"one","sourcePath":"260101-one.md","title":"A clear title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"A clear purpose","background":"Clear background","decision":"A clear decision","tags":["topic"],"relations":[]}}),
    );
    fs::write(dir.join("decision-index.json"), &bytes).unwrap();
    let line = format!("x{}😀", "a".repeat(11998));
    fs::write(
        dir.join("260101-one.md"),
        format!("---\nid: 260101-one\n---\n{line}\n"),
    )
    .unwrap();
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &decision::Definition).unwrap());
    let root = record_cli::source::open_root(root.path()).unwrap();
    let options = SearchOptions {
        text: "x".into(),
        scope: SearchScope::Content,
        mode: MatchMode::Phrase,
        tags: vec![],
        relation: RelationFilter {
            related_to: None,
            direction: None,
            relation_type: None,
        },
        limit: 20,
    };
    let result = dq::project_content(
        &root,
        "docs/decisions",
        &snapshot,
        &options,
        dq::DecisionFilters {
            status: StatusFilter::Active,
            alignment: AlignmentFilter::All,
        },
    )
    .unwrap();
    let serialized = serde_json::to_string(&result).unwrap();
    assert!(serialized.contains("\\ud83d"));
    assert!(!serialized.contains("\\ufffd"));
    assert!(result.truncation.preview_characters);
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args([
            "search",
            "x",
            "--json",
            "--root",
            root.path().to_str().unwrap(),
            "--in",
            "content",
        ])
        .output()
        .unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("\\ud83d"));
    assert!(!stdout.contains("\\ufffd"));
}

#[test]
fn investigation_content_search_fails_on_invalid_selected_source() {
    use record_cli::queries::{
        matcher::MatchMode,
        options::{SearchOptions, SearchScope},
    };
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"A question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"A title"}}),
    );
    let path = dir.join("260101-one.md");
    fs::write(&path, [0xff]).unwrap();
    let snapshot = QuerySnapshot::new(parse_index(&bytes, &investigation::Definition).unwrap());
    let root = record_cli::source::open_root(root.path()).unwrap();
    let options = SearchOptions {
        text: "missing".into(),
        scope: SearchScope::Content,
        mode: MatchMode::All,
        tags: vec![],
        relation: RelationFilter {
            related_to: None,
            direction: None,
            relation_type: None,
        },
        limit: 10,
    };
    assert!(
        iq::project_content(
            &root,
            "docs/investigations",
            &snapshot,
            &options,
            iq::FormationRange {
                from: None,
                to: None
            }
        )
        .is_err()
    );
    fs::write(&path, "---\ntitle: \"Title\"\nid: \"260101-other\"\n---\n").unwrap();
    assert!(
        iq::project_content(
            &root,
            "docs/investigations",
            &snapshot,
            &options,
            iq::FormationRange {
                from: None,
                to: None
            }
        )
        .is_err()
    );
}

#[test]
fn investigation_content_search_stops_after_first_hidden_hit_and_reports_lower_bound() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-a":investigation_state("a","260101-a"),"260101-b":investigation_state("b","260101-b"),"260101-c":investigation_state("c","260101-c")}),
    );
    for id in ["260101-a", "260101-b"] {
        fs::write(
            dir.join(format!("{id}.md")),
            format!("---\ntitle: \"A title\"\nid: \"{id}\"\n---\nneedle\n"),
        )
        .unwrap();
    }
    let value = search_investigation_needle(root.path(), &bytes);
    assert_eq!(
        value["searchInfo"]["counts"],
        json!({"matched":{"value":2,"precision":"lower-bound"},"returned":1})
    );
    assert_eq!(value["searchInfo"]["coverage"]["scanComplete"], false);
}

#[test]
fn cli_rejects_unpaired_surrogate_with_actionable_structured_error() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"A question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"MARKER"}}),
    );
    let json = String::from_utf8(bytes)
        .unwrap()
        .replace("\"MARKER\"", r#""\ud800""#);
    fs::write(dir.join("investigation-index.json"), json).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["list", "--json", "--root", root.path().to_str().unwrap()])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let result: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["error"]["code"], "unsupported-unpaired-surrogate");
    assert!(result["error"]["recovery"].is_string());
    assert!(
        result["error"]["path"]
            .as_str()
            .unwrap()
            .ends_with("investigation-index.json")
    );
}

#[test]
fn investigation_search_failure_preserves_failure_kind_without_fake_counts() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    fs::create_dir_all(root.path().join("docs/investigations")).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args([
            "search",
            "needle",
            "--json",
            "--root",
            root.path().to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["error"]["code"], "index-not-found");
    assert_eq!(value["result"]["failureKind"], "operation");
    assert!(value["result"]["searchInfo"].is_null());
    assert!(
        value["result"]["errors"]
            .as_array()
            .is_some_and(|errors| !errors.is_empty())
    );
}

#[test]
fn investigation_trace_cli_selector_failure_identifies_selector_and_recovery() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let bytes = fixture(
        "investigations",
        json!({"260101-one":{"formedAt":"2026-01-01T00:00:00Z","name":"one","question":"A question","relations":[],"resourceIds":[],"sourcePath":"260101-one.md","tags":["topic"],"title":"A title"}}),
    );
    fs::write(dir.join("investigation-index.json"), bytes).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args([
            "trace",
            "missing",
            "--json",
            "--root",
            root.path().to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["error"]["code"], "selector-not-found");
    assert_eq!(value["error"]["field"], "selector");
    assert!(
        value["error"]["message"]
            .as_str()
            .unwrap()
            .contains("missing")
    );
    assert!(value["error"]["recovery"].is_string());
}
