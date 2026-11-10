use super::ready_report;
use serde_json::{Value, json};
use std::{
    fs,
    path::Path,
    process::{Command, Output},
};

const ID: &str = "261106-advisory";
const DIR: &str = "docs/investigations";

fn fixture(files: &[(&str, Vec<u8>)]) -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join(DIR);
    let resources = directory.join("_resources").join(ID);
    fs::create_dir_all(&resources).unwrap();
    let mut links = Vec::new();
    for (name, bytes) in files {
        fs::write(resources.join(name), bytes).unwrap();
        links.push(format!("- [{name}](./_resources/{ID}/{name})"));
    }
    links.sort();
    let body = ready_report(
        ID,
        "relations: []",
        &format!("\n## 随附资源\n\n{}\n", links.join("\n")),
    );
    fs::write(directory.join(format!("_candidate.{ID}")), body).unwrap();
    temp
}
fn invoke(root: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .current_dir(root)
        .args(args)
        .output()
        .unwrap()
}
fn success(output: &Output) -> Value {
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).unwrap()
}
fn codes(review: &Value) -> Vec<&str> {
    review["findings"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["code"].as_str().unwrap())
        .collect()
}
fn project(root: &Path, value: Value) {
    fs::write(root.join(".investigation-report.json"), value.to_string()).unwrap();
}

#[test]
fn candidate_automatically_exposes_compression_duplicates_and_library_detected_media() {
    let temp = fixture(&[
        ("large.txt", vec![0x61; 65536]),
        ("a.txt", b"same bytes".to_vec()),
        ("b.txt", b"same bytes".to_vec()),
        ("image.png", vec![137, 80, 78, 71, 13, 10, 26, 10]),
    ]);
    let output = invoke(temp.path(), &["show-candidate", ID, "--json"]);
    let value = success(&output);
    let review = &value["result"]["resourceReview"];
    assert_eq!(
        value["result"]["candidate"]["readiness"]["resourceReady"],
        true
    );
    assert_eq!(review["complete"], true);
    assert!(codes(review).contains(&"resource-high-compressibility"));
    assert!(codes(review).contains(&"resource-exact-duplicates"));
    assert_eq!(review["duplicateGroups"][0]["redundantBytes"], 10);
    assert!(
        review["files"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["contentType"] == "image/png")
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("resource-high-compressibility"));
    assert!(stderr.contains("image/png"));
}

#[test]
fn ignored_candidate_resources_are_not_opened_by_advisory_scans() {
    let temp = fixture(&[("sample.ignored", vec![0x61; 65536])]);
    assert!(
        Command::new("git")
            .args(["init", "--quiet"])
            .current_dir(temp.path())
            .status()
            .unwrap()
            .success()
    );
    fs::write(temp.path().join(".gitignore"), "*.ignored\n").unwrap();
    let value = success(&invoke(temp.path(), &["show-candidate", ID, "--json"]));
    let review = &value["result"]["resourceReview"];
    assert_eq!(review["complete"], false);
    assert_eq!(review["readBudgetUsedBytes"], 0);
    assert!(review["files"].as_array().unwrap().is_empty());
    assert_eq!(
        value["result"]["candidate"]["readiness"]["resourceReady"],
        false
    );
}

#[test]
fn resource_warnings_do_not_block_publication_or_change_resource_bytes() {
    let data = vec![0x61; 65536];
    let temp = fixture(&[("large.txt", data.clone())]);
    let preflight = success(&invoke(
        temp.path(),
        &["publish", ID, "--preflight", "--json"],
    ));
    assert!(
        codes(&preflight["result"]["resourceReview"]).contains(&"resource-high-compressibility")
    );
    assert!(!temp.path().join(DIR).join(format!("{ID}.md")).exists());
    let published = success(&invoke(temp.path(), &["publish", ID, "--json"]));
    assert!(
        codes(&published["result"]["resourceReview"]).contains(&"resource-high-compressibility")
    );
    assert!(temp.path().join(DIR).join(format!("{ID}.md")).exists());
    assert_eq!(
        fs::read(
            temp.path()
                .join(DIR)
                .join("_resources")
                .join(ID)
                .join("large.txt")
        )
        .unwrap(),
        data
    );
    for args in [vec!["check", "--id", ID, "--json"], vec!["check", "--json"]] {
        let checked = success(&invoke(temp.path(), &args));
        assert_eq!(checked["result"]["resourceReview"]["resourceCount"], 1);
        assert!(
            codes(&checked["result"]["resourceReview"]).contains(&"resource-high-compressibility")
        );
    }
}

#[test]
fn project_and_local_settings_merge_and_explicit_config_replaces_both() {
    let temp = fixture(&[("sample.txt", vec![0x61; 65536])]);
    project(
        temp.path(),
        json!({"version":1,"resources":{"fileBytesWarn":1,"compressibility":{"enabled":false}}}),
    );
    fs::create_dir(temp.path().join(".local")).unwrap();
    fs::write(
        temp.path().join(".local/.investigation-report.local.json"),
        r#"{"resources":{"fileBytesWarn":1000000}}"#,
    )
    .unwrap();
    let merged = success(&invoke(
        temp.path(),
        &["show-candidate", ID, "--root", ".", "--json"],
    ));
    assert!(codes(&merged["result"]["resourceReview"]).is_empty());
    fs::write(
        temp.path().join("chosen.json"),
        r#"{"resources":{"fileBytesWarn":1}}"#,
    )
    .unwrap();
    let explicit = success(&invoke(
        temp.path(),
        &[
            "show-candidate",
            ID,
            "--root",
            ".",
            "--config",
            "chosen.json",
            "--json",
        ],
    ));
    let found = codes(&explicit["result"]["resourceReview"]);
    assert!(found.contains(&"resource-file-bytes"));
    assert!(found.contains(&"resource-high-compressibility"));
}

#[test]
fn invalid_configuration_fails_before_writes_but_help_and_version_remain_available() {
    let temp = fixture(&[("sample.txt", vec![0x61; 65536])]);
    project(temp.path(), json!({"resources":{"readBudgetBytes":0}}));
    let candidate = temp.path().join(DIR).join(format!("_candidate.{ID}"));
    let before = fs::read(&candidate).unwrap();
    let output = invoke(temp.path(), &["publish", ID, "--json"]);
    assert_eq!(output.status.code(), Some(1));
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["error"]["code"], "config-error");
    assert!(
        !temp
            .path()
            .join(DIR)
            .join("investigation-index.json")
            .exists()
    );
    assert!(!temp.path().join(DIR).join(format!("{ID}.md")).exists());
    assert_eq!(fs::read(candidate).unwrap(), before);
    assert!(invoke(temp.path(), &["help", "publish"]).status.success());
    assert!(invoke(temp.path(), &["--version"]).status.success());
}
