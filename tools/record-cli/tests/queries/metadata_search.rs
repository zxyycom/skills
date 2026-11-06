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
