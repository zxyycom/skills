use super::*;
use std::{
    fs,
    process::{Command, Output},
};

fn workspace() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let state = json!({"name":"one","sourcePath":"semantic.md","title":"Indexed title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    fs::write(
        dir.join("decision-index.json"),
        fixture("decisions", json!({"260101-one":state})),
    )
    .unwrap();
    fs::write(
        dir.join("semantic.md"),
        "---\nid: 260101-one\n---\nalpha beta gamma\n",
    )
    .unwrap();
    root
}
fn search(root: &std::path::Path, text: &str, extra: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_decision-records"))
        .args(["search", text, "--root"])
        .arg(root)
        .args(["--json"])
        .args(extra)
        .output()
        .unwrap()
}
fn result(output: &Output) -> Value {
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    serde_json::from_slice::<Value>(&output.stdout).unwrap()["result"].clone()
}
#[test]
fn decision_content_modes_published_scope_and_current_identity() {
    let root = workspace();
    let dir = root.path().join("docs/decisions");
    let index = fs::read(dir.join("decision-index.json")).unwrap();
    fs::write(
        dir.join("unindexed.md"),
        "---\nid: 260102-unindexed\n---\nunindexedonly\n",
    )
    .unwrap();
    for (query, extra, expected) in [
        ("alpha beta", vec![], 1),
        ("alpha beta", vec!["--in", "content", "--match", "all"], 1),
        ("missing beta", vec!["--match", "any"], 1),
        ("alpha beta", vec!["--match", "phrase"], 1),
        ("alpha missing", vec!["--match", "all"], 0),
        ("alpha gamma", vec!["--match", "phrase"], 0),
        ("unindexedonly", vec![], 0),
    ] {
        let value = result(&search(root.path(), query, &extra));
        assert_eq!(
            value["records"].as_array().unwrap().len(),
            expected,
            "{query} {extra:?}: {value}"
        );
        if expected == 1 {
            assert_eq!(value["records"][0]["decisionId"], "260101-one");
            assert_eq!(value["records"][0]["sourcePath"], "semantic.md");
            assert!(
                !value["records"][0]["previews"]
                    .as_array()
                    .unwrap()
                    .is_empty()
            );
        }
    }
    let empty = result(&search(root.path(), "unindexedonly", &[]));
    assert_eq!(
        empty["searchInfo"]["counts"],
        json!({"matched":{"value":0,"precision":"exact"},"returned":0})
    );
    assert_eq!(empty["searchInfo"]["coverage"]["previewsComplete"], true);
    assert_eq!(empty["searchInfo"]["coverage"]["scanComplete"], true);
    assert_eq!(empty["searchInfo"]["coverage"]["resultsComplete"], true);
    assert_eq!(empty["searchInfo"]["query"]["limits"]["maxRecords"], 20);
    let empty_metadata = result(&search(root.path(), "unindexedonly", &["--in", "metadata"]));
    assert_eq!(
        empty_metadata["searchInfo"]["counts"],
        json!({"matched":{"value":0,"precision":"exact"},"returned":0})
    );
    assert!(empty_metadata["searchInfo"]["coverage"]["previewsComplete"].is_null());
    assert_eq!(
        empty_metadata["searchInfo"]["coverage"]["scanComplete"],
        true
    );
    assert_eq!(
        empty_metadata["searchInfo"]["coverage"]["resultsComplete"],
        true
    );
    fs::write(
        dir.join("semantic.md"),
        "---\nid: 260101-one\n---\nnewcurrentword\n",
    )
    .unwrap();
    assert_eq!(
        result(&search(root.path(), "newcurrentword", &[]))["records"][0]["decisionId"],
        "260101-one"
    );
    assert_eq!(fs::read(dir.join("decision-index.json")).unwrap(), index);
    fs::write(
        dir.join("semantic.md"),
        "---\nid: 260102-other\n---\nnot a match\n",
    )
    .unwrap();
    let mismatch = search(root.path(), "newcurrentword", &[]);
    assert!(!mismatch.status.success());
    let body: Value = serde_json::from_slice(&mismatch.stdout).unwrap();
    assert_eq!(body["ok"], false);
    assert!(body.to_string().contains("identity"), "{body}");
    fs::write(
        dir.join("semantic.md"),
        "---\nid: 260101-one\n---\nnewcurrentword\n",
    )
    .unwrap();
    fs::remove_file(dir.join("decision-index.json")).unwrap();
    let missing = search(root.path(), "newcurrentword", &[]);
    assert!(!missing.status.success());
    let body: Value = serde_json::from_slice(&missing.stdout).unwrap();
    assert_eq!(body["error"]["code"], "index-not-found");
    assert!(body["result"]["searchInfo"].is_null());
    assert!(!dir.join("decision-index.json").exists());
}

#[test]
fn decision_content_preview_budgets_report_only_actual_omissions() {
    let root = workspace();
    let path = root.path().join("docs/decisions/semantic.md");
    let run = |content: String| {
        fs::write(&path, format!("---\nid: 260101-one\n---\n{content}")).unwrap();
        result(&search(root.path(), "quasar", &[]))
    };
    let exact_matches = run("quasar quasar quasar".into());
    assert_eq!(exact_matches["truncation"]["matches"], false);
    assert_eq!(
        exact_matches["searchInfo"]["coverage"]["previewsComplete"],
        true
    );
    let too_many = run("quasar quasar quasar quasar".into());
    assert_eq!(too_many["truncation"]["matches"], true);
    assert_eq!(
        too_many["searchInfo"]["coverage"]["previewsComplete"],
        false
    );
    assert!(
        too_many["searchInfo"]["coverage"]["reasons"]
            .as_array()
            .unwrap()
            .contains(&json!("match-previews"))
    );
    let exact_characters = run(format!("quasar{}", "x".repeat(11991)));
    assert_eq!(
        exact_characters["truncation"]["previewCharacters"], false,
        "{exact_characters}"
    );
    let too_many_characters = run(format!("quasar{}", "x".repeat(11992)));
    assert_eq!(too_many_characters["truncation"]["previewCharacters"], true);
    assert!(
        too_many_characters["searchInfo"]["coverage"]["reasons"]
            .as_array()
            .unwrap()
            .contains(&json!("preview-characters"))
    );
    assert_eq!(
        too_many_characters["searchInfo"]["counts"]["matched"]["precision"],
        "exact"
    );
    assert_eq!(
        too_many_characters["searchInfo"]["coverage"]["scanComplete"],
        true
    );
    let warning = too_many_characters["warnings"].as_array().unwrap();
    assert!(
        warning
            .iter()
            .any(|w| w.as_str().is_some_and(|w| w.contains("preview-characters")))
    );
    assert!(warning.iter().all(|w| {
        w.as_str()
            .is_some_and(|w| !w.contains("sync-index") && !w.contains("source problem"))
    }));
    let state = |name: &str, path: &str| json!({"name":name,"sourcePath":path,"title":"Indexed title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    let directory = root.path().join("docs/decisions");
    fs::write(
        directory.join("decision-index.json"),
        fixture(
            "decisions",
            json!({"260101-one":state("one","semantic.md"),"260102-two":state("two","z-second.md")}),
        ),
    )
    .unwrap();
    fs::write(
        directory.join("z-second.md"),
        "---\nid: 260102-two\n---\nquasar second\n",
    )
    .unwrap();
    let both = result(&search(root.path(), "quasar", &[]));
    assert_eq!(both["records"].as_array().unwrap().len(), 2);
    assert_eq!(both["records"][1]["decisionId"], "260102-two");
    assert!(
        both["records"][1]["previews"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        both["searchInfo"]["counts"],
        json!({"matched":{"value":2,"precision":"exact"},"returned":2})
    );
}

#[test]
fn decision_relation_filters_use_published_edges_with_current_content() {
    let root = workspace();
    let dir = root.path().join("docs/decisions");
    let prior = json!({"name":"prior","sourcePath":"archive/prior.md","title":"Prior title","status":"archived","alignment":"aligned","createdAt":"2025-12-31T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[]});
    let current = json!({"name":"one","sourcePath":"semantic.md","title":"Indexed title","status":"active","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[{"type":"修订","target":"251231-prior","summary":"Indexed reason"}]});
    fs::write(
        dir.join("decision-index.json"),
        fixture(
            "decisions",
            json!({"251231-prior":prior,"260101-one":current}),
        ),
    )
    .unwrap();
    fs::write(dir.join("semantic.md"), "---\nid: 260101-one\nrelations:\n  - type: 替代\n    target: 251231-prior\n---\nneedlecurrent\n").unwrap();
    let run = |args: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(args)
            .arg("--root")
            .arg(root.path())
            .arg("--json")
            .output()
            .unwrap()
    };
    let list = result(&run(&[
        "list",
        "--related-to",
        "prior",
        "--relation-type",
        "修订",
        "--tag",
        "topic",
    ]));
    assert_eq!(list["records"].as_array().unwrap().len(), 1);
    assert_eq!(list["records"][0]["decisionId"], "260101-one");
    assert_eq!(list["records"][0]["filterRelations"][0]["type"], "修订");
    let content = result(&search(
        root.path(),
        "needlecurrent",
        &[
            "--related-to",
            "prior",
            "--relation-type",
            "修订",
            "--tag",
            "topic",
        ],
    ));
    assert_eq!(content["records"].as_array().unwrap().len(), 1);
    assert_eq!(content["records"][0]["filterRelations"][0]["type"], "修订");
    assert_eq!(
        content["searchInfo"]["query"]["filters"]["relatedTo"],
        "251231-prior"
    );
    assert_eq!(
        content["searchInfo"]["query"]["filters"]["tags"],
        json!(["topic"])
    );
    assert_eq!(
        content["searchInfo"]["query"]["filters"]["status"],
        "active"
    );
    let wrong_edge = result(&search(
        root.path(),
        "needlecurrent",
        &["--related-to", "prior", "--relation-type", "替代"],
    ));
    assert!(wrong_edge["records"].as_array().unwrap().is_empty());
    let metadata = result(&search(
        root.path(),
        "title",
        &[
            "--in",
            "metadata",
            "--related-to",
            "prior",
            "--relation-type",
            "修订",
        ],
    ));
    assert_eq!(metadata["records"].as_array().unwrap().len(), 1);
    assert_eq!(metadata["records"][0]["matchedRelations"], json!([]));
}
