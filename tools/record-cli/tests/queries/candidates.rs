use super::*;

#[test]
fn candidate_header_distinguishes_bad_scaffold_duplicate_identity_and_surrogate() {
    use record_cli::domains::{decision, investigation};
    assert_eq!(
        investigation::candidate_header("---\nquestion: \"later\"\nid: \"260101-one\"\n---\n")
            .unwrap(),
        Some("260101-one".into())
    );
    assert_eq!(
        investigation::candidate_header(
            "---\ntitle: \"first\"\ntitle: \"second\"\nid: \"260101-one\"\n---\n"
        )
        .unwrap(),
        Some("260101-one".into())
    );
    assert!(
        investigation::candidate_header("---\nid: \"260101-one\"\nid: \"260101-two\"\n---\n")
            .is_err()
    );
    assert_eq!(
        investigation::candidate_header("---\ntitle: \"\\ud800\"\nid: \"260101-one\"\n---\n")
            .unwrap_err(),
        "unsupported-unpaired-surrogate"
    );
    assert!(
        investigation::candidate_header("---\ntitle: \"\\\\ud800\"\nid: \"260101-one\"\n---\n")
            .is_ok()
    );
    assert!(
        decision::candidate_header(
            "---\nid: 260101-one\nstatus: candidate\nstatus: active\n---\n",
            "260101-one.md"
        )
        .is_err()
    );
    assert_eq!(
        decision::candidate_header(
            "---\nid: 260101-one\nstatus: candidate\n---\n",
            "260101-one.md"
        )
        .unwrap(),
        (Some("260101-one".into()), true)
    );
}

#[test]
fn investigation_candidate_parser_accepts_candidate_locator_without_formal_path() {
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n";
    let candidate =
        investigation::parse_candidate(text.as_bytes(), "260101-one", "_candidate.260101-one")
            .unwrap();
    assert!(candidate.readiness.scaffold_valid);
    assert!(candidate.state.is_none());
    assert!(candidate.resource_ids.is_empty());
    assert!(candidate.diagnostics.is_empty());
    assert!(candidate.readiness.resource_ready.is_none());
}

#[test]
fn investigation_candidates_ignore_unmanaged_git_resources_but_do_not_hide_managed_ones() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    let owner = dir.join("_resources/260101-one");
    fs::create_dir_all(&owner).unwrap();
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n";
    fs::write(dir.join("_candidate.260101-one"), text).unwrap();
    fs::write(owner.join("ignored.txt"), "ignored").unwrap();
    fs::write(
        root.path().join(".gitignore"),
        "docs/investigations/_resources/**\n",
    )
    .unwrap();
    let git = |args: &[&str]| {
        let result = Command::new("git")
            .current_dir(root.path())
            .args(args)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
    };
    git(&["init", "-q"]);
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert_eq!(items.len(), 1);
    assert!(items[0].readiness.resource_ready);
    git(&[
        "add",
        "-f",
        "docs/investigations/_resources/260101-one/ignored.txt",
    ]);
    let (items, warnings) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert!(!items[0].readiness.resource_ready);
    assert!(
        warnings
            .iter()
            .any(|warning| warning.contains("must be referenced by its owner report 260101-one"))
    );
}

#[test]
fn investigation_candidate_list_and_show_discover_declared_identity() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n";
    fs::write(dir.join("_candidate.legacy-location"), text).unwrap();
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (all, warnings) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].id, "260101-one");
    assert!(all[0].readiness.scaffold_valid);
    assert!(all[0].readiness.body_ready);
    assert!(all[0].readiness.resource_ready);
    assert_eq!(warnings.len(), 1);
    let (one, _) = iq::candidates(&handle, "docs/investigations", Some("one.md")).unwrap();
    assert_eq!(one[0].id, "260101-one");
    fs::write(dir.join("_candidate.other"), text).unwrap();
    assert!(iq::candidates(&handle, "docs/investigations", None).is_err());
}

#[test]
fn decision_candidates_discover_and_warn_about_missing_dependency() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/decisions");
    fs::create_dir_all(&dir).unwrap();
    let body = "---\ntitle: Decision title\nid: 240229-record\nstatus: candidate\nalignment: null\ncreatedAt: null\npurpose: Purpose text\nbackground: Background text\ndecision: Decision text\ntags: [tag]\nrelations: []\n---\n\n## 目的\nText\n\n## 背景\nText\n\n## 决策\n- 采用: Choice\n";
    let path = dir.join("legacy.md");
    fs::write(&path, body).unwrap();
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (all, warnings) = dq::candidates(&handle, "docs/decisions", None).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].0.decision_id, "240229-record");
    assert!(all[0].0.body_ready);
    assert_eq!(warnings.len(), 1);
    let related = body.replace(
        "relations: []",
        "relations:\n  - type: 修订\n    target: 240101-prior",
    );
    fs::write(&path, related).unwrap();
    let (records, warnings) = dq::candidates(&handle, "docs/decisions", None).unwrap();
    assert_eq!(records.len(), 1);
    assert!(warnings.iter().any(|warning| {
        warning.contains("Candidate relation target is not yet established: 240101-prior")
    }));
}

#[test]
fn investigation_candidate_owned_resource_is_checked_without_loading_ignored_siblings() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    let owner = dir.join("_resources/260101-one");
    fs::create_dir_all(&owner).unwrap();
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n\n## 随附资源\n- [证据](./_resources/260101-one/evidence.txt)\n";
    fs::write(dir.join("_candidate.260101-one"), text).unwrap();
    fs::write(owner.join("evidence.txt"), "evidence").unwrap();
    let init = Command::new("git")
        .current_dir(root.path())
        .args(["init", "-q"])
        .status()
        .unwrap();
    assert!(init.success());
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert_eq!(items.len(), 1);
    assert!(items[0].readiness.resource_ready);
    assert!(items[0].errors.is_empty());
    fs::remove_file(owner.join("evidence.txt")).unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert!(!items[0].readiness.resource_ready);
    assert!(items[0].errors.iter().any(|e| e.contains("does not exist")));
}

#[test]
fn investigation_candidate_shared_resource_requires_owner_direct_reference() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    let owner = dir.join("_resources/260101-owner");
    fs::create_dir_all(&owner).unwrap();
    let doc = |id: &str, link: bool| {
        format!(
            "---\ntitle: \"A title\"\nid: \"{id}\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n{}",
            if link {
                "\n## 随附资源\n- [证据](./_resources/260101-owner/evidence.txt)\n"
            } else {
                ""
            }
        )
    };
    fs::write(
        dir.join("_candidate.260101-owner"),
        doc("260101-owner", true),
    )
    .unwrap();
    fs::write(
        dir.join("_candidate.260101-reader"),
        doc("260101-reader", true),
    )
    .unwrap();
    fs::write(owner.join("evidence.txt"), "evidence").unwrap();
    assert!(
        Command::new("git")
            .current_dir(root.path())
            .args(["init", "-q"])
            .status()
            .unwrap()
            .success()
    );
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", Some("reader")).unwrap();
    assert!(items[0].readiness.resource_ready);
    fs::write(
        dir.join("_candidate.260101-owner"),
        doc("260101-owner", false),
    )
    .unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", Some("reader")).unwrap();
    assert!(!items[0].readiness.resource_ready);
    assert!(
        items[0]
            .errors
            .iter()
            .any(|e| e.contains("must be referenced by its owner report"))
    );
}

#[cfg(unix)]
#[test]
fn investigation_candidate_referenced_symlink_is_a_resource_issue() {
    use std::{fs, process::Command};
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs").join("investigations");
    let owner = dir.join("_resources").join("260101-one");
    fs::create_dir_all(&owner).unwrap();
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n\n## 随附资源\n- [证据](./_resources/260101-one/evidence.txt)\n";
    fs::write(dir.join("_candidate.260101-one"), text).unwrap();
    std::os::unix::fs::symlink("/etc/passwd", owner.join("evidence.txt")).unwrap();
    assert!(
        Command::new("git")
            .current_dir(root.path())
            .args(["init", "-q"])
            .status()
            .unwrap()
            .success()
    );
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert!(!items[0].readiness.resource_ready);
    assert!(
        items[0]
            .errors
            .iter()
            .any(|error| error.contains("must not traverse or target a symbolic link"))
    );
}

#[test]
fn investigation_candidate_reports_resource_case_mismatch_without_accepting_alias() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    let owner = dir.join("_resources/260101-one");
    fs::create_dir_all(&owner).unwrap();
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n\n## 随附资源\n- [证据](./_resources/260101-one/evidence.txt)\n";
    fs::write(dir.join("_candidate.260101-one"), text).unwrap();
    fs::write(owner.join("Evidence.txt"), "evidence").unwrap();
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (items, _) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert!(!items[0].readiness.resource_ready);
    assert!(
        items[0]
            .errors
            .iter()
            .any(|error| error.contains("must match actual path casing; found \"Evidence.txt\""))
    );
}

#[test]
fn investigation_candidate_empty_section_keeps_identity_and_line_diagnostic() {
    use std::fs;
    let root = tempfile::tempdir().unwrap();
    let dir = root.path().join("docs/investigations");
    fs::create_dir_all(&dir).unwrap();
    let text = "---\ntitle: \"A title\"\nid: \"260101-one\"\nformedAt: \"2026-01-01T00:00:00Z\"\nquestion: \"A question\"\ntags:\n  - \"topic\"\nrelations: []\n---\n\n## 形成时背景\n背景\n\n## 调查目的\n\n## 调查范围与依据\n范围\n\n## 调查结果与边界\n结果\n";
    fs::write(dir.join("_candidate.260101-one"), text).unwrap();
    let handle = record_cli::source::open_root(root.path()).unwrap();
    let (items, warnings) = iq::candidates(&handle, "docs/investigations", None).unwrap();
    assert!(!items[0].readiness.body_ready);
    let expected = "260101-one:14 section \"调查目的\" must not be empty";
    assert!(items[0].errors.iter().any(|error| error == expected));
    assert!(warnings.iter().any(|warning| warning == expected));
}
