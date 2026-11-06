use super::parse_frontmatter;
const REPORT: &str = "---\ntitle: \"Title\"\nid: \"240229-report\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n";
#[test]
fn established_projection_checks_utc_date_and_body() {
    let source = format!(
        "{REPORT}\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n"
    );
    let parsed = super::parse_established(source.as_bytes(), "240229-report", "report.md").unwrap();
    assert_eq!(parsed.state.name, "report");
    let bad = source.replace("2024-02-29T00:00:00Z", "2024-02-28T23:00:00Z");
    assert!(super::parse_established(bad.as_bytes(), "240229-report", "report.md").is_err());
}
#[test]
fn identity_discovery_ignores_later_invalid_content() {
    let partial = "---\ntitle: whatever\nid: \"240229-report\"\ninvalid";
    assert_eq!(
        super::id_from_markdown(partial).as_deref(),
        Some("240229-report")
    );
    assert!(super::parse_frontmatter(partial.as_bytes(), "240229-report").is_err());
}
#[test]
#[cfg(any(unix, windows))]
fn owner_tree_requires_matching_capture_and_direct_references() {
    use crate::source::{RelativePath, capture_tree, open_root};
    let workspace = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(workspace.path().join("resources/report")).unwrap();
    std::fs::write(workspace.path().join("resources/report/file.txt"), b"data").unwrap();
    let root = open_root(workspace.path()).unwrap();
    let path = RelativePath::new("resources/report").unwrap();
    let tree = capture_tree(&root, &path).unwrap();
    assert!(
        super::validate_owner_tree(&root, &path, "report", &tree, &["report/file.txt".into()])
            .is_ok()
    );
    assert!(super::validate_owner_tree(&root, &path, "report", &tree, &[]).is_err());
    assert!(
        super::validate_owner_tree(
            &root,
            &path,
            "report",
            &tree,
            &["report/missing.txt".into()]
        )
        .is_err()
    );
    assert!(super::validate_owner_tree(&root, &path, "other", &tree, &[]).is_err());
}
#[test]
fn identity_replacement_changes_only_selected_links_and_id() {
    let source = format!("{REPORT}\n- [file](./_resources/240229-report/file.txt)\n");
    let result = super::replace_identity(
        source.as_bytes(),
        "240229-report",
        "240229-report",
        "240229-renamed",
    )
    .unwrap();
    assert!(result.contains("id: \"240229-renamed\""));
    assert!(result.contains("](./_resources/240229-renamed/file.txt)"));
    assert!(result.contains("question: \"Question\""));
}
#[test]
fn line_format_rejects_whitespace_after_quoted_scalar() {
    let invalid = REPORT.replace("title: \"Title\"", "title: \"Title\" ");
    assert!(super::parse_frontmatter(invalid.as_bytes(), "240229-report").is_err());
    let windows = REPORT.replace('\n', "\r\n");
    let parsed = super::parse_frontmatter(windows.as_bytes(), "240229-report").unwrap();
    assert_eq!(parsed.id, "240229-report");
}
#[test]
fn canonical_frontmatter_round_trips() {
    let front = super::parse_frontmatter(REPORT.as_bytes(), "240229-report").unwrap();
    let serialized = super::serialize_frontmatter(&front).unwrap();
    assert_eq!(serialized, REPORT.trim_end());
}
#[test]
fn relation_replacement_is_local_and_checked() {
    let relation = super::Relation {
        relation_type: "复查".into(),
        target: "old".into(),
        summary: Some("reason".into()),
    };
    let next = super::replace_relations(REPORT.as_bytes(), "240229-report", &[relation]).unwrap();
    assert!(next.contains("  - type: \"复查\"\n    target: \"old\"\n    summary: \"reason\""));
    assert!(next.ends_with("---\n"));
    assert!(
        super::replace_relations(
            next.as_bytes(),
            "240229-report",
            &[super::Relation {
                relation_type: "invalid".into(),
                target: "old".into(),
                summary: None
            }]
        )
        .is_err()
    );
}
#[test]
fn body_detects_empty_sections_and_resource_links() {
    let text = format!(
        "{REPORT}\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n## 随附资源\n- [file](./_resources/240229-report/file.txt)\n"
    );
    let body = super::assess_body(text.as_bytes(), 8, false).unwrap();
    assert!(body.body_errors.is_empty());
    assert!(body.resource_errors.is_empty());
    assert_eq!(body.resource_ids, ["240229-report/file.txt"]);
    let broken = text.replace("240229-report/file.txt", "240229-report/../secret");
    assert!(
        !super::assess_body(broken.as_bytes(), 8, false)
            .unwrap()
            .resource_errors
            .is_empty()
    );
    let empty = text.replace("背景\n## 调查目的", "## 调查目的");
    assert!(
        !super::assess_body(empty.as_bytes(), 8, false)
            .unwrap()
            .body_errors
            .is_empty()
    );
    assert!(
        super::assess_body(empty.as_bytes(), 8, true)
            .unwrap()
            .body_errors
            .is_empty()
    );
}
#[test]
fn fixed_order_and_declared_identity_are_checked() {
    let parsed = parse_frontmatter(REPORT.as_bytes(), "240229-report").unwrap();
    assert_eq!(parsed.end_line, 8);
    assert!(parse_frontmatter(REPORT.as_bytes(), "different").is_err());
    assert!(
        parse_frontmatter(
            REPORT.replace("tags:\n", "extra: true\ntags:\n").as_bytes(),
            "240229-report"
        )
        .is_err()
    );
    assert!(
        parse_frontmatter(
            REPORT
                .replace("title: \"Title\"", "title: Title")
                .as_bytes(),
            "240229-report"
        )
        .is_err()
    );
}
