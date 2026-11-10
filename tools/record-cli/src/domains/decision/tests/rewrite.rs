use super::parse_frontmatter;
const SAMPLE: &str = "---\ntitle: Decision title\nid: 240229-record\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\n";

#[test]
fn local_rewrite_preserves_bom_crlf_comments_anchors_and_unselected_multiline() {
    let input = "\u{feff}---\r\ntitle: 'Decision title' # title comment\r\nid: 240229-record\r\nstatus: candidate # status comment\r\nalignment: null # alignment comment\r\ncreatedAt: null # timestamp comment\r\npurpose: &p >-\r\n  Purpose text\r\nbackground: *p\r\ndecision: Decision text\r\ntags: &tags [tag] # anchor stays\r\nrelations: [] # relation comment\r\n---\r\n\r\n## 目的\r\n正文\r\n";
    let output = super::replace_metadata(
        input.as_bytes(),
        "240229-record",
        super::MetadataUpdate {
            status: "active",
            alignment: Some("aligned"),
            created_at: Some("2024-02-29T00:00:00Z"),
            relations: None,
        },
    )
    .unwrap();
    let expected = input
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2024-02-29T00:00:00Z");
    assert_eq!(output, expected);
    assert_eq!(
        super::replace_metadata(
            input.as_bytes(),
            "240229-record",
            super::MetadataUpdate {
                status: "candidate",
                alignment: None,
                created_at: None,
                relations: None
            }
        )
        .unwrap(),
        input
    );
}
#[test]
fn relation_and_identity_rewrite_preserve_other_source_text() {
    let input = SAMPLE
        .replace("relations: []", "relations: [] # selected comment")
        .replace(
            "title: Decision title",
            "title: 'Decision title' # untouched",
        );
    let relation = super::Relation {
        relation_type: "修订".into(),
        target: "old".into(),
        summary: None,
    };
    let output = super::replace_metadata(
        input.as_bytes(),
        "240229-record",
        super::MetadataUpdate {
            status: "candidate",
            alignment: None,
            created_at: None,
            relations: Some(&[relation]),
        },
    )
    .unwrap();
    assert!(output.contains("title: 'Decision title' # untouched\n"));
    assert!(
        output
            .contains("relations:  # selected comment\n  - type: \"修订\"\n    target: \"old\"\n")
    );
    let renamed =
        super::replace_identity(output.as_bytes(), "240229-record", "old", "new").unwrap();
    assert!(renamed.contains("    target: \"new\""));
    assert!(renamed.ends_with("---\n\n## 目的\n"));
}
#[test]
fn flow_mapping_publish_preserves_unselected_bytes_bom_and_crlf() {
    let input = "\u{feff}---\r\n{title: Example title, id: 261106-one, status: candidate, alignment: null, createdAt: null, purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: []}\r\n---\r\n\r\n## 目的\r\n目的\r\n## 背景\r\n背景\r\n## 决策\r\n- 采用: 方案\r\n";
    let output = super::replace_metadata(
        input.as_bytes(),
        "261106-one",
        super::MetadataUpdate {
            status: "active",
            alignment: Some("unaligned"),
            created_at: Some("2026-11-06T12:00:00Z"),
            relations: None,
        },
    )
    .unwrap();
    let expected = input
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: unaligned")
        .replace("createdAt: null", "createdAt: 2026-11-06T12:00:00Z");
    assert_eq!(output, expected);
}
#[test]
fn flow_mapping_accepts_implicit_null_lifecycle_values() {
    let input = "---\n{title: Example title, id: 261106-one, status: candidate, alignment: , createdAt: , purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: []}\n---\n\n## 目的\n";
    let output = super::replace_metadata(
        input.as_bytes(),
        "261106-one",
        super::MetadataUpdate {
            status: "active",
            alignment: Some("aligned"),
            created_at: Some("2026-11-06T12:00:00Z"),
            relations: None,
        },
    )
    .unwrap();
    assert_eq!(
        parse_frontmatter(output.as_bytes(), "261106-one")
            .unwrap()
            .alignment
            .as_deref(),
        Some("aligned")
    );
    assert!(output.contains("purpose: Some purpose"));
}
#[test]
fn flow_relations_retain_comments_and_unmodified_members() {
    let input = "---\r\n{title: Decision title, id: 261106-one, status: active, alignment: aligned, createdAt: 2026-11-06T12:00:00Z, purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: [ # before item\r\n {type: 修订, target: old} # after item\r\n ]}\r\n---\r\n\r\n## 目的\r\n";
    let output = super::replace_identity(input.as_bytes(), "261106-one", "old", "new").unwrap();
    let parsed = parse_frontmatter(output.as_bytes(), "261106-one").unwrap();
    assert_eq!(parsed.relations[0].target, "new");
    assert!(output.contains("# before item\r\n"));
    assert!(output.contains("# after item\r\n"));
    assert!(output.contains("purpose: Some purpose, background: Some background"));
    assert!(output.ends_with("---\r\n\r\n## 目的\r\n"));
}
#[test]
fn flow_relations_accept_plain_apostrophe_and_escaped_single_quotes() {
    let template = "---\n{title: Decision title, id: 261106-one, status: active, alignment: aligned, createdAt: 2026-11-06T12:00:00Z, purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: [{type: 修订, target: old, summary: SUMMARY}]}\n---\n\n## 目的\n";
    for summary in ["user's reason", "'user''s reason'"] {
        let input = template.replace("SUMMARY", summary);
        let output = super::replace_identity(input.as_bytes(), "261106-one", "old", "new").unwrap();
        let parsed = parse_frontmatter(output.as_bytes(), "261106-one").unwrap();
        assert_eq!(parsed.relations[0].target, "new");
        assert_eq!(
            parsed.relations[0].summary.as_deref(),
            Some("user's reason")
        );
    }
}
#[test]
fn flow_relations_and_identity_handle_nested_commas_and_unicode() {
    let input = "---\n{title: \"测试, title\", id: 261106-one, status: active, alignment: aligned, createdAt: 2026-11-06T12:00:00Z, purpose: Some purpose, background: Some background, decision: Some decision, tags: [test], relations: [{type: 修订, target: old, summary: \"reason, yes\"}]}\n---\n\n## 目的\n";
    let output = super::replace_identity(input.as_bytes(), "261106-one", "old", "new").unwrap();
    let parsed = parse_frontmatter(output.as_bytes(), "261106-one").unwrap();
    assert_eq!(parsed.relations[0].target, "new");
    assert!(output.contains("title: \"测试, title\""));
    assert_eq!(parsed.relations[0].summary.as_deref(), Some("reason, yes"));
    let next = super::replace_metadata(
        output.as_bytes(),
        "261106-one",
        super::MetadataUpdate {
            status: "active",
            alignment: Some("aligned"),
            created_at: Some("2026-11-06T12:00:00Z"),
            relations: Some(&[]),
        },
    )
    .unwrap();
    assert!(
        parse_frontmatter(next.as_bytes(), "261106-one")
            .unwrap()
            .relations
            .is_empty()
    );
    assert!(next.ends_with("---\n\n## 目的\n"));
}
#[test]
fn rewrites_folded_value_and_quoted_key_without_touching_other_fields() {
    let input = SAMPLE.replace(
        "status: candidate\n",
        "\"status\" : >- # status note\n  candidate\n# between fields\n",
    );
    let output = super::replace_metadata(
        input.as_bytes(),
        "240229-record",
        super::MetadataUpdate {
            status: "active",
            alignment: Some("aligned"),
            created_at: Some("2024-02-29T00:00:00Z"),
            relations: None,
        },
    )
    .unwrap();
    assert!(output.contains("\"status\" : active # status note\n# between fields\n"));
    assert!(output.contains("purpose: Purpose text\nbackground: Background text\n"));
}
#[test]
fn changing_an_anchor_used_by_other_fields_fails_closed() {
    let input = SAMPLE
        .replace("status: candidate", "status: &shared candidate")
        .replace("background: Background text", "background: *shared");
    assert!(super::parse_frontmatter(input.as_bytes(), "240229-record").is_ok());
    assert!(
        super::replace_metadata(
            input.as_bytes(),
            "240229-record",
            super::MetadataUpdate {
                status: "active",
                alignment: Some("aligned"),
                created_at: Some("2024-02-29T00:00:00Z"),
                relations: None
            }
        )
        .is_err()
    );
}
#[test]
fn metadata_replacement_preserves_body_and_validates_lifecycle() {
    let result = super::replace_metadata(
        SAMPLE.as_bytes(),
        "240229-record",
        super::MetadataUpdate {
            status: "active",
            alignment: Some("aligned"),
            created_at: Some("2024-02-29T00:00:00Z"),
            relations: None,
        },
    )
    .unwrap();
    let front = parse_frontmatter(result.as_bytes(), "240229-record").unwrap();
    assert_eq!(front.body, "## 目的\n");
    assert_eq!(front.status, "active");
    assert!(
        super::replace_metadata(
            SAMPLE.as_bytes(),
            "240229-record",
            super::MetadataUpdate {
                status: "candidate",
                alignment: Some("aligned"),
                created_at: None,
                relations: None
            }
        )
        .is_err()
    );
}
#[test]
fn yaml_emitter_round_trips_and_rejects_invalid_changes() {
    let front = parse_frontmatter(SAMPLE.as_bytes(), "240229-record").unwrap();
    let output = super::serialize_document(&front).unwrap();
    assert_eq!(
        parse_frontmatter(output.as_bytes(), &front.id).unwrap(),
        front
    );
    let mut invalid = front;
    invalid.alignment = Some("aligned".into());
    assert!(super::serialize_document(&invalid).is_err());
}
