use super::*;

#[cfg(unix)]
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
    assert!(response["result"].get("verification").is_none());
}

#[test]
fn selected_decision_sync_failure_reports_configured_index_path() {
    let root = tempfile::tempdir().unwrap();
    for (directory, expected) in [
        (None, "docs/decisions/decision-index.json"),
        (
            Some("custom/decisions"),
            "custom/decisions/decision-index.json",
        ),
    ] {
        for preflight in [false, true] {
            let mut cmd = Command::new(env!("CARGO_BIN_EXE_decision-records"));
            cmd.args([
                "sync-index",
                "--select",
                "missing",
                "--root",
                root.path().to_str().unwrap(),
                "--json",
            ]);
            if let Some(directory) = directory {
                cmd.args(["--decisions-dir", directory]);
            }
            if preflight {
                cmd.arg("--preflight");
            }
            let output = cmd.output().unwrap();
            assert_eq!(output.status.code(), Some(1));
            let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
            assert_eq!(
                response["result"]["indexRelativePath"], expected,
                "{response}"
            );
        }
    }
}
