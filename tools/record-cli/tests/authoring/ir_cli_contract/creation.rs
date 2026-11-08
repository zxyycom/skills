use super::*;

#[test]
fn investigation_cli_new_duplicate_id_preserves_candidate_and_reports_readiness() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    let first = new(root, "example", &[]);
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stdout)
    );
    let result: serde_json::Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(result["result"]["created"], true);
    assert_eq!(result["result"]["readiness"]["scaffoldValid"], true);
    assert_eq!(result["result"]["readiness"]["bodyReady"], false);
    let candidate = root.join("docs/investigations/_candidate.261106-example");
    let original = fs::read(&candidate).unwrap();
    let names = candidate_names(root);
    let second = new(root, "example", &[]);
    assert!(!second.status.success());
    let result: serde_json::Value = serde_json::from_slice(&second.stdout).unwrap();
    assert_eq!(result["ok"], false);
    assert_eq!(fs::read(candidate).unwrap(), original);
    assert_eq!(candidate_names(root), names);
}

#[test]
fn investigation_cli_new_summary_resolves_target_and_preserves_equals() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    let target = new(root, "target", &[]);
    assert!(
        target.status.success(),
        "{}",
        String::from_utf8_lossy(&target.stdout)
    );
    let source = new(
        root,
        "source",
        &[
            "--relation",
            "补充=target",
            "--relation-summary",
            "261106-target=first=second",
        ],
    );
    assert!(
        source.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&source.stdout),
        String::from_utf8_lossy(&source.stderr)
    );
    let body =
        fs::read_to_string(root.join("docs/investigations/_candidate.261106-source")).unwrap();
    assert!(body.contains("261106-target"), "{body}");
    assert!(body.contains("first=second"), "{body}");
}

#[test]
fn investigation_cli_new_rejects_unbound_summary_without_writes() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    let target = new(root, "target", &[]);
    assert!(target.status.success());
    let path = root.join("docs/investigations/_candidate.261106-target");
    let before = fs::read(&path).unwrap();
    let names = candidate_names(root);
    let rejected = new(
        root,
        "unbound",
        &["--relation-summary", "261106-target=summary"],
    );
    assert!(!rejected.status.success());
    let result: serde_json::Value = serde_json::from_slice(&rejected.stdout).unwrap();
    assert_eq!(result["ok"], false);
    assert!(
        !root
            .join("docs/investigations/_candidate.261106-unbound")
            .exists()
    );
    assert_eq!(candidate_names(root), names);
    assert_eq!(fs::read(path).unwrap(), before);
}

#[test]
fn investigation_cli_summary_aliases_resolve_independently_and_trim_before_validation() {
    let fixture = tempfile::tempdir().unwrap();
    let root = fixture.path();
    assert!(new(root, "target", &[]).status.success());
    for (name, summary, expected) in [
        ("blank", "target=\n ", None),
        ("trimmed", "target=\n  reason  \n", Some("reason")),
    ] {
        let result = new(
            root,
            name,
            &[
                "--relation",
                "补充=261106-target",
                "--relation-summary",
                summary,
            ],
        );
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stdout)
        );
        let text =
            fs::read_to_string(root.join(format!("docs/investigations/_candidate.261106-{name}")))
                .unwrap();
        if let Some(value) = expected {
            let yaml = text.split("---").nth(1).unwrap();
            let parsed = yaml_rust2::YamlLoader::load_from_str(yaml).unwrap();
            assert_eq!(parsed[0]["relations"][0]["summary"].as_str(), Some(value));
        } else {
            assert!(!text.contains("summary:"));
        }
    }
    for (name, summary) in [
        ("bad-date", "261105-target=reason"),
        ("multiline", "target=one\ntwo"),
    ] {
        let result = new(
            root,
            name,
            &[
                "--relation",
                "补充=261106-target",
                "--relation-summary",
                summary,
            ],
        );
        assert!(!result.status.success());
        assert!(
            !root
                .join(format!("docs/investigations/_candidate.261106-{name}"))
                .exists()
        );
    }
}

#[test]
fn investigation_cli_new_defaults_formed_at_to_current_utc_and_uses_its_date() {
    let fixture = tempfile::tempdir().unwrap();
    let before = time::OffsetDateTime::now_utc().unix_timestamp();
    let output = run(
        fixture.path(),
        &[
            "new",
            "current",
            "--title",
            "Title",
            "--question",
            "Question",
            "--tag",
            "test",
        ],
    );
    let after = time::OffsetDateTime::now_utc().unix_timestamp();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let id = value["result"]["id"].as_str().unwrap();
    let file = fixture
        .path()
        .join("docs/investigations")
        .join(format!("_candidate.{id}"));
    let source = fs::read(file).unwrap();
    let parsed = record_cli::domains::investigation::parse_frontmatter(&source, id).unwrap();
    let formed = time::OffsetDateTime::parse(
        &parsed.formed_at,
        &time::format_description::well_known::Rfc3339,
    )
    .unwrap();
    assert!((before..=after).contains(&formed.unix_timestamp()));
    let utc = formed.to_offset(time::UtcOffset::UTC);
    assert_eq!(
        id,
        format!(
            "{:02}{:02}{:02}-current",
            utc.year() % 100,
            u8::from(utc.month()),
            utc.day()
        )
    );
}
