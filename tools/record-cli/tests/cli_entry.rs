//! Real process exit behavior for location-independent help.
use std::process::Command;

#[test]
fn non_unicode_arguments_use_structured_usage_error_when_json_is_requested() {
    #[cfg(unix)]
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
            assert_eq!(response["version"], 1);
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
            assert_eq!(response["version"], 1);
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
fn identity_failure_reports_prepared_plan_separately_from_actual_writes() {
    let root = tempfile::tempdir().unwrap();
    let binary = env!("CARGO_BIN_EXE_decision-records");
    let create = Command::new(binary)
        .args([
            "new",
            "sample",
            "--title",
            "Sample",
            "--purpose",
            "Purpose",
            "--background",
            "Background",
            "--decision",
            "Decision",
            "--tag",
            "test",
            "--root",
            root.path().to_str().unwrap(),
            "--json",
        ])
        .output()
        .unwrap();
    assert!(
        create.status.success(),
        "{}",
        String::from_utf8_lossy(&create.stdout)
    );
    let unprepared = Command::new(binary)
        .args([
            "rename",
            "missing",
            "renamed",
            "--root",
            root.path().to_str().unwrap(),
            "--json",
        ])
        .output()
        .unwrap();
    let unprepared_json: serde_json::Value = serde_json::from_slice(&unprepared.stdout).unwrap();
    assert_eq!(unprepared.status.code(), Some(1));
    assert!(unprepared_json["result"].get("plannedIdentity").is_none());
    let mut rename = Command::new(binary);
    rename.args([
        "rename",
        "sample",
        "renamed",
        "--root",
        root.path().to_str().unwrap(),
        "--json",
    ]);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        // File writes fail deterministically after prepare; pipes remain writable.
        unsafe {
            rename.pre_exec(|| {
                libc::signal(libc::SIGXFSZ, libc::SIG_IGN);
                let limit = libc::rlimit {
                    rlim_cur: 0,
                    rlim_max: 0,
                };
                if libc::setrlimit(libc::RLIMIT_FSIZE, &limit) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
    let failed = rename.output().unwrap();
    assert_eq!(
        failed.status.code(),
        Some(1),
        "{}",
        String::from_utf8_lossy(&failed.stdout)
    );
    let response: serde_json::Value = serde_json::from_slice(&failed.stdout).unwrap();
    assert_eq!(response["ok"], false);
    assert_eq!(response["result"]["plannedIdentity"]["oldName"], "sample");
    assert_eq!(response["result"]["plannedIdentity"]["newName"], "renamed");
    assert_eq!(
        response["result"]["plannedIdentity"]["affectedEstablishedRelationCount"],
        0
    );
    assert_eq!(
        response["result"]["plannedIdentity"]["oldId"]
            .as_str()
            .unwrap()
            .rsplit('-')
            .next(),
        Some("sample")
    );
    assert_eq!(
        response["result"]["plannedIdentity"]["newId"]
            .as_str()
            .unwrap()
            .rsplit('-')
            .next(),
        Some("renamed")
    );
    assert!(response["result"].get("oldId").is_none());
    assert_ne!(response["result"]["verification"], "passed");
}
