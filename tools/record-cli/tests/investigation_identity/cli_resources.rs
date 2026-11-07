use super::*;

#[test]
fn cli_rename_preflight_and_execution_are_distinct() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("docs/investigations");
    std::fs::create_dir_all(&c).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", false)).unwrap();
    let call = |preflight: bool| {
        let mut command = std::process::Command::new(env!("CARGO_BIN_EXE_investigation-report"));
        command
            .args(["rename", "261106-old", "new", "--root"])
            .arg(dir.path())
            .arg("--json");
        if preflight {
            command.arg("--preflight");
        }
        command.output().unwrap()
    };
    let preview = call(true);
    assert!(
        preview.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&preview.stdout),
        String::from_utf8_lossy(&preview.stderr)
    );
    let preview_json: serde_json::Value = serde_json::from_slice(&preview.stdout).unwrap();
    assert_eq!(preview_json["result"]["oldName"], "old");
    assert_eq!(preview_json["result"]["newName"], "new");
    assert_eq!(preview_json["result"]["affectedResourceReferenceCount"], 0);
    assert_eq!(preview_json["result"]["planOutcome"], "preflight");
    assert!(c.join("_candidate.old").exists());
    let actual = call(false);
    assert!(
        actual.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&actual.stdout),
        String::from_utf8_lossy(&actual.stderr)
    );
    assert!(c.join("_candidate.new").exists());
    assert!(!c.join("_candidate.old").exists());
    let json: serde_json::Value = serde_json::from_slice(&actual.stdout).unwrap();
    assert_eq!(json["result"]["status"], "ok");
}
#[test]
fn discard_candidate_with_incomplete_scaffold_and_unreferenced_owner_resource() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old")).unwrap();
    std::fs::write(
        c.join("_candidate.old"),
        "---\ntitle: \"A\"\nid: \"261106-old\"\n---\nunfinished\n",
    )
    .unwrap();
    std::fs::write(c.join("_resources/261106-old/file.txt"), "draft").unwrap();
    let result = run(
        dir.path(),
        &mut op(Action::Discard {
            confirm_recorded: false,
            delete_owned_resources: true,
        }),
    );
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.committed);
    assert!(!c.join("_candidate.old").exists());
}
#[test]
fn published_resource_owner_move_rewrites_shared_links_and_rejects_shared_discard() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old/nested")).unwrap();
    std::fs::write(c.join("_resources/261106-old/nested/file.txt"), b"bytes").unwrap();
    let owner = report("261106-old", true);
    let reference = report("261106-next", false)
        + "\n## 随附资源\n- [shared](./_resources/261106-old/nested/file.txt)\n";
    publish_fixture(
        &c,
        &[
            ("261106-old", "old.md", owner),
            ("261106-next", "next.md", reference),
        ],
    );
    let out = run(
        dir.path(),
        &mut op(Action::Discard {
            confirm_recorded: false,
            delete_owned_resources: true,
        }),
    );
    assert!(!out.committed);
    assert!(c.join("_resources/261106-old/nested/file.txt").exists());
    let preview = std::process::Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["rename", "261106-old", "new", "--root"])
        .arg(dir.path())
        .args([
            "--investigations-dir",
            "investigations",
            "--preflight",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(
        preview.status.success(),
        "{}",
        String::from_utf8_lossy(&preview.stdout)
    );
    let json: serde_json::Value = serde_json::from_slice(&preview.stdout).unwrap();
    assert_eq!(json["result"]["affectedResourceReferenceCount"], 2);
    assert_eq!(json["result"]["plannedResourceOwnerMove"], true);
    assert!(json["result"].get("resourceOwnerMoved").is_none());
    let out = run(
        dir.path(),
        &mut op(Action::Rename {
            target: "new".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        }),
    );
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.committed);
    assert_eq!(out.value.as_ref().unwrap().impact.resource_references, 2);
    assert_eq!(
        std::fs::read(c.join("_resources/261106-new/nested/file.txt")).unwrap(),
        b"bytes"
    );
    assert!(
        std::fs::read_to_string(c.join("next.md"))
            .unwrap()
            .contains("_resources/261106-new/nested/file.txt")
    );
}
#[test]
fn ignored_owner_file_is_never_deleted_as_managed_resource() {
    let dir = tempfile::tempdir().unwrap();
    let git = std::process::Command::new("git")
        .arg("-C")
        .arg(dir.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(git.success());
    std::fs::write(dir.path().join(".gitignore"), "*.secret\n").unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old")).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", false)).unwrap();
    std::fs::write(c.join("_resources/261106-old/private.secret"), b"keep").unwrap();
    let out = run(
        dir.path(),
        &mut op(Action::Discard {
            confirm_recorded: true,
            delete_owned_resources: true,
        }),
    );
    assert!(!out.committed);
    assert_eq!(
        std::fs::read(c.join("_resources/261106-old/private.secret")).unwrap(),
        b"keep"
    );
    assert!(c.join("_candidate.old").exists());
}
#[test]
fn cli_owner_move_preserves_resources_and_platform_metadata() {
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("docs/investigations");
    let owner = c.join("_resources/261106-old");
    std::fs::create_dir_all(owner.join("nested")).unwrap();
    std::fs::write(c.join("_candidate.old"), report("261106-old", true)).unwrap();
    std::fs::write(owner.join("nested/file.txt"), b"mode evidence").unwrap();
    #[cfg(unix)]
    for (path, mode) in [
        (&owner, 0o775),
        (&owner.join("nested"), 0o751),
        (&owner.join("nested/file.txt"), 0o640),
    ] {
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)).unwrap();
    }
    #[cfg(unix)]
    let output = std::process::Command::new("sh")
        .args([
            "-c",
            "umask 077; exec \"$@\"",
            "umask-fixture",
            env!("CARGO_BIN_EXE_investigation-report"),
            "rename",
            "261106-old",
            "new",
            "--root",
        ])
        .arg(dir.path())
        .arg("--json")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["result"]["committed"], true);
    assert_eq!(result["result"]["affectedResourceReferenceCount"], 1);
    assert_eq!(result["result"]["affectedCandidateRelationCount"], 0);
    assert_eq!(result["result"]["affectedEstablishedRelationCount"], 0);
    let moved = c.join("_resources/261106-new");
    #[cfg(unix)]
    for (path, expected) in [
        (&moved, 0o775),
        (&moved.join("nested"), 0o751),
        (&moved.join("nested/file.txt"), 0o640),
    ] {
        assert_eq!(
            std::fs::metadata(path).unwrap().permissions().mode() & 0o777,
            expected
        );
    }
    assert_eq!(
        std::fs::read(moved.join("nested/file.txt")).unwrap(),
        b"mode evidence"
    );
    assert!(!owner.exists());
    let denied = std::process::Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["discard", "261106-new", "--root"])
        .arg(dir.path())
        .arg("--json")
        .output()
        .unwrap();
    assert_eq!(denied.status.code(), Some(1));
    let failure: serde_json::Value = serde_json::from_slice(&denied.stdout).unwrap();
    let diagnostic = &failure["diagnostics"][0];
    assert_eq!(diagnostic["target"], "261106-new");
    assert!(
        diagnostic["reason"]
            .as_str()
            .unwrap()
            .contains("1 resource(s)")
    );
    assert!(
        diagnostic["recovery"]
            .as_str()
            .unwrap()
            .contains("--delete-owned-resources")
    );
    assert_eq!(failure["result"]["changed"], false);
    assert_eq!(failure["result"]["committed"], false);
    assert!(failure["result"].get("deletedResourceIds").is_none());
    assert_eq!(
        std::fs::read(moved.join("nested/file.txt")).unwrap(),
        b"mode evidence"
    );
    assert!(c.join("_candidate.new").exists());
    let discard = std::process::Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(["discard", "261106-new", "--root"])
        .arg(dir.path())
        .args(["--delete-owned-resources", "--json"])
        .output()
        .unwrap();
    assert!(
        discard.status.success(),
        "stdout={} stderr={}",
        String::from_utf8_lossy(&discard.stdout),
        String::from_utf8_lossy(&discard.stderr)
    );
    let deleted: serde_json::Value = serde_json::from_slice(&discard.stdout).unwrap();
    assert_eq!(deleted["result"]["id"], "261106-new");
    assert_eq!(
        deleted["result"]["deletedResourceIds"],
        serde_json::json!(["261106-new/nested/file.txt"])
    );
    assert_eq!(
        deleted["result"]["requiresRecordedDeletionConfirmation"],
        false
    );
}

#[cfg(unix)]
#[test]
fn cli_resource_copy_write_failure_preserves_published_facts_and_reports_partial() {
    use std::os::unix::process::CommandExt;
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    let old_resource = c.join("_resources/261106-old/nested/file.txt");
    std::fs::create_dir_all(old_resource.parent().unwrap()).unwrap();
    let evidence = vec![b'e'; 8192];
    std::fs::write(&old_resource, &evidence).unwrap();
    let original = report("261106-old", true);
    publish_fixture(&c, &[("261106-old", "old.md", original.clone())]);
    let index = std::fs::read(c.join("investigation-index.json")).unwrap();
    let mut command = std::process::Command::new(env!("CARGO_BIN_EXE_investigation-report"));
    command
        .args(["rename", "261106-old", "new", "--root"])
        .arg(dir.path())
        .args(["--investigations-dir", "investigations", "--json"]);
    // Limit only the child: directory creation succeeds, but copied file data cannot be written.
    unsafe {
        command.pre_exec(|| {
            libc::signal(libc::SIGXFSZ, libc::SIG_IGN);
            let limit = libc::rlimit {
                rlim_cur: 4096,
                rlim_max: 4096,
            };
            if libc::setrlimit(libc::RLIMIT_FSIZE, &limit) != 0 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }
    let output = command.output().unwrap();
    assert_eq!(
        output.status.code(),
        Some(1),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let response: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(response["ok"], false);
    assert_eq!(response["error"]["code"], "resource-write");
    assert!(response["error"]["recovery"].as_str().is_some());
    let result = &response["result"];
    assert_eq!(result["changed"], true);
    assert_eq!(result["committed"], false);
    assert_eq!(result["outcome"], "partial-or-unknown");
    assert_eq!(result["verification"], "not-run");
    let partial = "investigations/_resources/261106-new/nested/file.txt";
    assert!(
        result["writtenPaths"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == partial)
    );
    assert!(
        result["unknownPaths"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == partial)
    );
    assert_eq!(
        std::fs::read(dir.path().join(partial)).unwrap(),
        evidence[..4096]
    );
    let backups = result["recoveryBackups"].as_array().unwrap();
    assert_eq!(backups.len(), 2);
    for (source, expected) in [
        ("investigations/old.md", original.as_bytes()),
        ("investigations/investigation-index.json", index.as_slice()),
    ] {
        let backup = backups
            .iter()
            .find(|entry| entry["source"] == source)
            .unwrap();
        assert_ne!(backup["backup"], partial);
        assert_eq!(
            std::fs::read(dir.path().join(backup["backup"].as_str().unwrap())).unwrap(),
            expected
        );
    }
    assert_eq!(
        std::fs::read(c.join("old.md")).unwrap(),
        original.as_bytes()
    );
    assert_eq!(
        std::fs::read(c.join("investigation-index.json")).unwrap(),
        index
    );
    assert_eq!(std::fs::read(old_resource).unwrap(), evidence);
    assert!(!c.join("new.md").exists());
}
