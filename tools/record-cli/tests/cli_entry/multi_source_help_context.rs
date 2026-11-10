use super::*;

fn help_text(cwd: &Path, args: &[&str]) -> String {
    let output = invoke(cwd, args);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).unwrap()
}

#[test]
fn help_forms_describe_selected_sources_without_reading_indexes() {
    let temp = setup();
    fs::write(
        temp.path()
            .join("first/research/reports/investigation-index.json"),
        "broken",
    )
    .unwrap();
    for args in [
        vec!["--help"],
        vec!["help", "--key", "related"],
        vec!["--key", "related", "help"],
        vec!["help", "show", "--key", "related"],
        vec!["show", "--help", "--key", "related"],
    ] {
        let text = help_text(temp.path(), &args);
        for expected in [
            "Usage:",
            "Key: related",
            "Selected: related",
            "research/reports",
            "notes/reports",
        ] {
            assert!(
                text.contains(expected),
                "{args:?}: missing {expected}: {text}"
            );
        }
    }
}

#[test]
fn write_help_matches_single_source_requirements_and_workspace_default() {
    let temp = setup();
    let multiple = help_text(temp.path(), &["help", "new", "--key", "related"]);
    assert!(multiple.contains("Source diagnostic: write requires exactly one source"));
    assert!(!multiple.contains("Selected:"));
    let workspace = help_text(temp.path(), &["help", "new"]);
    assert!(workspace.contains("Selected: workspace"));
    assert!(!workspace.contains("Selected: related"));
}

#[test]
fn help_respects_explicit_location_and_configuration() {
    let temp = setup();
    let text = help_text(temp.path(), &["help", "list", "--root", "first"]);
    assert!(text.contains("Selected: explicit location"));
    assert!(!text.contains("Selected: related"));
    fs::write(temp.path().join("alternate.json"), json!({"defaultKey":"other","sources":{"other":{"root":"second","investigationsDir":"notes/reports"}}}).to_string()).unwrap();
    let text = help_text(
        temp.path(),
        &[
            "--config",
            "alternate.json",
            "help",
            "show",
            "--key",
            "other",
        ],
    );
    assert!(text.contains("Selected: other"));
    assert!(text.contains("alternate.json"));
    assert!(!text.contains("Key: related"));
}

#[test]
fn bad_configuration_is_diagnostic_not_a_help_failure_or_silent_fallback() {
    let temp = setup();
    fs::write(
        temp.path().join(".local/.investigation-report.local.json"),
        "broken",
    )
    .unwrap();
    let text = help_text(temp.path(), &["--help"]);
    assert!(text.contains("Usage:"));
    assert!(text.contains("Source diagnostic:"));
    assert!(text.contains(".investigation-report.local.json"));
    assert!(!text.contains("Selected:"));
}
