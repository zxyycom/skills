//! Real process exit behavior for location-independent help.
use std::process::Command;

#[path = "cli_entry/failure_facts.rs"]
mod failure_facts;

#[cfg(unix)]
#[test]
fn non_unicode_arguments_use_structured_usage_error_when_json_is_requested() {
    let (invalid, inline_root) = {
        use std::os::unix::ffi::OsStringExt;
        (
            std::ffi::OsString::from_vec(vec![0xff]),
            std::ffi::OsString::from_vec(b"--root=\xff".to_vec()),
        )
    };
    let cases = [
        (
            vec!["list".into(), "--json".into(), invalid.clone()],
            "list",
        ),
        (
            vec![
                "--root".into(),
                invalid.clone(),
                "list".into(),
                "--json".into(),
            ],
            "list",
        ),
        (vec![inline_root, "list".into(), "--json".into()], "list"),
        (vec![invalid, "--json".into()], ""),
    ];
    for binary in [
        env!("CARGO_BIN_EXE_decision-records"),
        env!("CARGO_BIN_EXE_investigation-report"),
    ] {
        for (args, command) in &cases {
            let output = Command::new(binary).args(args).output().unwrap();
            assert_eq!(output.status.code(), Some(2));
            let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
            assert_eq!(response["version"], 2);
            assert_eq!(response["command"], *command);
            assert_eq!(response["ok"], false);
            assert_eq!(response["error"]["code"], "invalid-arguments");
            assert!(response["diagnostics"].is_array());
            assert!(
                response["error"]["message"]
                    .as_str()
                    .unwrap()
                    .contains("Unicode")
            );
            assert!(!String::from_utf8_lossy(&output.stderr).contains("panicked"));
        }
    }
}

#[test]
fn invalid_query_and_mutation_arguments_use_single_json_object_and_usage_exit() {
    for binary in [
        env!("CARGO_BIN_EXE_decision-records"),
        env!("CARGO_BIN_EXE_investigation-report"),
    ] {
        for command in ["list", "new"] {
            let output = Command::new(binary)
                .args([command, "--json", "--definitely-unknown"])
                .output()
                .unwrap();
            assert_eq!(output.status.code(), Some(2), "{binary} {command}");
            // Parsing the entire stdout rejects extra JSON objects or text.
            let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
            assert_eq!(response["version"], 2);
            assert_eq!(response["command"], command);
            assert_eq!(response["ok"], false);
            assert_eq!(response["error"]["code"], "invalid-arguments");
            assert!(response["diagnostics"].is_array());
        }
    }
}

#[test]
fn missing_command_is_usage_error_and_explicit_help_needs_no_workspace() {
    for binary in [
        env!("CARGO_BIN_EXE_decision-records"),
        env!("CARGO_BIN_EXE_investigation-report"),
    ] {
        let missing = Command::new(binary).output().unwrap();
        assert_eq!(missing.status.code(), Some(2));
        assert!(!missing.stdout.is_empty());
        for args in [
            vec!["--help"],
            vec!["help", "stage"],
            vec!["--version"],
            vec!["--root", "definitely-not-a-workspace", "--help"],
            vec!["--root", "definitely-not-a-workspace", "stage", "--help"],
        ] {
            let help = Command::new(binary).args(args).output().unwrap();
            assert_eq!(help.status.code(), Some(0));
            assert!(!help.stdout.is_empty());
        }
    }
}

#[test]
fn decision_new_and_search_help_expose_supported_contract() {
    let binary = env!("CARGO_BIN_EXE_decision-records");
    let help = |topic: &str| {
        let result = Command::new(binary).args(["help", topic]).output().unwrap();
        assert!(result.status.success());
        String::from_utf8(result.stdout).unwrap()
    };
    let top = Command::new(binary).arg("--help").output().unwrap();
    assert!(top.status.success());
    let top = String::from_utf8(top.stdout).unwrap();
    for command in ["evolve", "new", "show-candidate"] {
        assert!(top.contains(command));
    }
    assert!(!top.contains("split"));
    let evolve = help("evolve");
    for option in ["--successor", "--clear-relations"] {
        assert!(evolve.contains(option));
    }
    let new = help("new");
    for term in [
        "--relation",
        "--relation-summary",
        "scaffold",
        "body",
        "publication",
    ] {
        assert!(new.contains(term), "missing {term}: {new}");
    }
    let search = help("search");
    for term in [
        "content|metadata",
        "all|any|phrase",
        "--alignment",
        "--status",
        "--tag",
        "--related-to",
        "--direction",
        "--relation-type",
    ] {
        assert!(search.contains(term), "missing {term}: {search}");
    }
    let list = help("list");
    for term in [
        "--created-from",
        "--created-to",
        "--status",
        "--alignment",
        "--limit",
        "--offset",
        "--detail",
    ] {
        assert!(list.contains(term), "missing {term}: {list}");
    }
}

#[test]
fn mutation_help_matches_each_domain_and_parser() {
    let decision = env!("CARGO_BIN_EXE_decision-records");
    let investigation = env!("CARGO_BIN_EXE_investigation-report");
    for (binary, command, expected, absent) in [
        (
            decision,
            "publish",
            "SELECTOR --alignment aligned|unaligned",
            "SELECTOR...",
        ),
        (
            investigation,
            "publish",
            "SELECTOR... [--preflight]",
            "--alignment",
        ),
        (
            decision,
            "discard",
            "SELECTOR [--delete-recorded]",
            "--delete-owned-resources",
        ),
        (
            investigation,
            "discard",
            "[--delete-owned-resources]",
            "--alignment",
        ),
    ] {
        let output = Command::new(binary)
            .args(["help", command])
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(0));
        let text = String::from_utf8(output.stdout).unwrap();
        assert!(text.contains(expected), "{text}");
        assert!(!text.contains(absent), "{text}");
    }
    let root = tempfile::tempdir().unwrap();
    for (binary, args, accepted) in [
        (
            decision,
            vec!["publish", "one", "--alignment", "aligned"],
            true,
        ),
        (decision, vec!["publish", "one"], false),
        (
            decision,
            vec!["publish", "one", "two", "--alignment", "aligned"],
            false,
        ),
        (investigation, vec!["publish", "one", "two"], true),
        (
            investigation,
            vec!["publish", "one", "--alignment", "aligned"],
            false,
        ),
        (
            decision,
            vec!["discard", "one", "--delete-owned-resources"],
            false,
        ),
        (
            investigation,
            vec!["discard", "one", "--delete-owned-resources"],
            true,
        ),
    ] {
        let output = Command::new(binary)
            .args(args)
            .args(["--root", root.path().to_str().unwrap(), "--json"])
            .output()
            .unwrap();
        let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(response["ok"], false, "{response}");
        assert_eq!(
            response["error"]["code"],
            if accepted {
                "collection"
            } else {
                "invalid-arguments"
            },
            "{response}"
        );
    }
}

#[test]
fn decision_cli_evolve_requires_successor_even_with_discard() {
    let root = tempfile::tempdir().unwrap();
    for args in [
        vec!["evolve"],
        vec!["evolve", "--discard", "candidate"],
        vec!["evolve", "--delete-recorded", "--successor", "aligned=one"],
        vec![
            "evolve",
            "--successor",
            "aligned=one",
            "--successor",
            "unaligned=one",
        ],
    ] {
        let result = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(args)
            .args(["--json", "--root", root.path().to_str().unwrap()])
            .output()
            .unwrap();
        assert_eq!(result.status.code(), Some(2));
        let response: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(response["error"]["code"], "invalid-arguments");
        assert!(!root.path().join("docs").exists());
    }
}

#[test]
fn decision_query_rejects_invalid_tag_and_duplicate_relation_filters() {
    let root = tempfile::tempdir().unwrap();
    let cases: &[&[&str]] = &[
        &["list", "--tag", "Bad_Tag"],
        &["list", "--related-to", "a", "--related-to", "b"],
        &[
            "search",
            "term",
            "--direction",
            "both",
            "--direction",
            "both",
        ],
        &["list", "--relation-type", "修订", "--relation-type", "替代"],
    ];
    for args in cases {
        let result = std::process::Command::new(env!("CARGO_BIN_EXE_decision-records"))
            .args(*args)
            .args(["--json", "--root", root.path().to_str().unwrap()])
            .output()
            .unwrap();
        assert_eq!(result.status.code(), Some(2), "{args:?}");
        let response: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(response["error"]["code"], "invalid-arguments");
        assert!(!root.path().join("docs").exists());
    }
}

#[path = "cli_entry/multi_source.rs"]
mod multi_source;
