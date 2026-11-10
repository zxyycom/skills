use super::parse_frontmatter;
const SAMPLE: &str = "---\ntitle: Decision title\nid: 240229-record\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\n";

#[test]
fn decision_frontmatter_rejects_missing_invalid_and_removed_fields() {
    assert!(parse_frontmatter(SAMPLE.as_bytes(), "240229-record").is_ok());
    for source in [
        SAMPLE.replace("title: Decision title", "title: Ab"),
        SAMPLE.replace("purpose: Purpose text\n", ""),
        SAMPLE.replace("tags: [tag]", "tags: []"),
        SAMPLE.replace("tags: [tag]", "tags: [Bad_Tag]"),
        SAMPLE.replace("tags: [tag]", "tags: [z, a]"),
        SAMPLE.replace("tags: [tag]", "tags: [tag, tag]"),
        SAMPLE.replace("tags: [tag]\n", ""),
        SAMPLE.replace("relations: []", "relations: []\ndomain: removed"),
        SAMPLE.replace("relations: []", "relations: []\ndomains: [removed]"),
        SAMPLE.replace("relations: []", "relations: []\nextra: removed"),
    ] {
        assert!(
            parse_frontmatter(source.as_bytes(), "240229-record").is_err(),
            "{source}"
        );
    }
}
#[test]
fn established_document_projects_only_when_body_and_path_are_valid() {
    let source = SAMPLE
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2024-02-29T00:00:00Z")
        .replace(
            "## 目的\n",
            "## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用: 选择\n",
        );
    let parsed = super::parse_established(source.as_bytes(), "240229-record", "record.md").unwrap();
    assert_eq!(parsed.state.name, "record");
    assert!(
        super::parse_established(source.as_bytes(), "240229-record", "archive/record.md").is_err()
    );
}
#[test]
fn identity_discovery_does_not_require_a_ready_body() {
    let partial = "---\nid: 240229-record\n---\ninvalid body";
    assert_eq!(
        super::id_from_markdown(partial).as_deref(),
        Some("240229-record")
    );
    assert!(super::parse_candidate(partial.as_bytes(), "240229-record").is_err());
}
#[test]
fn candidate_body_keeps_scaffold_and_readiness_separate() {
    let scaffold = "## 目的\n\n## 背景\n\n## 决策\n";
    let result = super::assess_body(scaffold, true);
    assert!(result.scaffold_errors.is_empty());
    assert!(!result.body_ready);
    let ready = "## 目的\n目的\n## 背景\n背景\n## 决策\n- 采用：选择\n";
    let result = super::assess_body(ready, true);
    assert!(result.scaffold_errors.is_empty());
    assert!(result.body_ready);
    assert!(
        !super::assess_body("## 背景\n内容\n", true)
            .scaffold_errors
            .is_empty()
    );
}

#[test]
fn decision_adopted_value_requires_supported_marker_and_same_line_content() {
    let body = |line: &str| format!("## 目的\n目的\n## 背景\n背景\n## 决策\n{line}\n");
    for marker in ["-", "*", "+"] {
        for colon in [":", "："] {
            let valid = super::assess_body(&body(&format!("{marker} 采用{colon} 选择")), false);
            assert!(
                valid.body_ready && valid.scaffold_errors.is_empty(),
                "{marker}{colon}: {valid:?}"
            );
            for value in ["", "  ", "\n选择"] {
                let invalid =
                    super::assess_body(&body(&format!("{marker} 采用{colon}{value}")), false);
                assert!(
                    !invalid.body_ready
                        && invalid
                            .scaffold_errors
                            .iter()
                            .any(|error| error.contains("采用")),
                    "{marker}{colon}{value:?}: {invalid:?}"
                );
            }
        }
    }
    for unsupported in ["• 采用: 选择", "- 采用; 选择"] {
        let invalid = super::assess_body(&body(unsupported), false);
        assert!(
            !invalid.body_ready
                && invalid
                    .scaffold_errors
                    .iter()
                    .any(|error| error.contains("采用"))
        );
    }
}
#[test]
fn reads_yaml_and_rejects_duplicate_keys_and_bad_lifecycle() {
    let parsed = parse_frontmatter(SAMPLE.as_bytes(), "240229-record").unwrap();
    assert_eq!(parsed.status, "candidate");
    assert_eq!(parsed.created_at, None);
    assert_eq!(parsed.body, "## 目的\n");
    assert!(
        parse_frontmatter(
            SAMPLE
                .replace("status: candidate", "status: candidate\nstatus: active")
                .as_bytes(),
            "240229-record"
        )
        .is_err()
    );
    assert!(
        parse_frontmatter(
            SAMPLE
                .replace("alignment: null", "alignment: aligned")
                .as_bytes(),
            "240229-record"
        )
        .is_err()
    );
    assert!(parse_frontmatter(SAMPLE.as_bytes(), "other").is_err());
}

#[test]
fn established_decision_requires_explicit_alignment_for_active_and_archived() {
    for (status, alignment) in [
        ("active", "aligned"),
        ("active", "unaligned"),
        ("archived", "aligned"),
        ("archived", "unaligned"),
    ] {
        let valid = SAMPLE
            .replace("status: candidate", &format!("status: {status}"))
            .replace("alignment: null", &format!("alignment: {alignment}"))
            .replace("createdAt: null", "createdAt: 2024-02-29T00:00:00Z");
        assert!(parse_frontmatter(valid.as_bytes(), "240229-record").is_ok());
        for invalid in [
            valid.replace(&format!("alignment: {alignment}"), "alignment: null"),
            valid.replace(&format!("alignment: {alignment}\n"), ""),
        ] {
            assert!(parse_frontmatter(invalid.as_bytes(), "240229-record").is_err());
        }
    }
}

#[test]
fn parsed_source_preserves_independent_classification_metadata_and_body() {
    let established = SAMPLE
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2024-02-29T00:00:00Z");
    for text in [
        SAMPLE.to_owned(),
        format!("\u{feff}{}", SAMPLE.replace('\n', "\r\n")),
    ] {
        let parsed = super::ParsedSource::new(&text, "record.md").unwrap();
        assert_eq!(parsed.id, "240229-record");
        assert!(parsed.candidate);
        let front = parsed.front.as_ref().unwrap();
        assert_eq!(front.title, "Decision title");
        assert_eq!(front.body, "## 目的\n");
        assert_eq!(front.tags, ["tag"]);
    }
    let parsed = super::ParsedSource::new(&established, "record.md").unwrap();
    assert!(!parsed.candidate);
    assert_eq!(parsed.front.as_ref().unwrap().status, "active");
    assert!(parsed.established_document("record.md").is_err());
    let invalid_fields = established.replace("title: Decision title", "title: Ab");
    let parsed = super::ParsedSource::new(&invalid_fields, "record.md").unwrap();
    assert!(!parsed.candidate);
    assert!(parsed.front.is_err());
    let no_body = SAMPLE.replace("---\n\n## 目的\n", "---");
    let parsed = super::ParsedSource::new(&no_body, "record.md").unwrap();
    assert_eq!(parsed.front.unwrap().body, "");
    let duplicate_id = SAMPLE.replace("id: 240229-record", "id: 240229-record\nid: other");
    assert!(super::ParsedSource::new(&duplicate_id, "record.md").is_err());
    let invalid_yaml = SAMPLE.replace("title: Decision title", "title: [broken");
    assert!(super::ParsedSource::new(&invalid_yaml, "record.md").is_err());
    let missing_id = SAMPLE.replace("id: 240229-record\n", "");
    assert!(super::ParsedSource::new(&missing_id, "record.md").is_err());
}
