use super::*;

#[test]
fn layered_source_groups_preserve_each_configuration_files_relative_paths() {
    let temp = setup();
    let cwd = temp.path();
    fs::write(
        cwd.join(".investigation-report.json"),
        json!({
            "defaultKey": "project",
            "sources": {
                "project": [{"root": "first", "investigationsDir": "research/reports"}],
                "shared": [
                    {"root": "first", "investigationsDir": "research/reports"},
                    {"root": "second", "investigationsDir": "notes/reports"}
                ]
            },
            "resources": {"fileBytesWarn": 100}
        })
        .to_string(),
    )
    .unwrap();
    fs::write(
        cwd.join(".local/.investigation-report.local.json"),
        json!({
            "defaultKey": "local",
            "sources": {
                "local": [{"root": "../second", "investigationsDir": "notes/reports"}],
                "shared": [{"root": "../second", "investigationsDir": "notes/reports"}]
            },
            "resources": {"reportBytesWarn": 200}
        })
        .to_string(),
    )
    .unwrap();
    let local = successful(&invoke(cwd, &["list", "--json"]));
    assert_eq!(local["result"]["key"], "local");
    assert_eq!(
        local["result"]["sources"][0]["result"]["entries"][0]["id"],
        "260101-b"
    );
    let project = successful(&invoke(cwd, &["list", "--key", "project", "--json"]));
    assert_eq!(
        project["result"]["sources"][0]["result"]["entries"][0]["id"],
        "260101-a"
    );
    let replaced = successful(&invoke(cwd, &["list", "--key", "shared", "--json"]));
    assert_eq!(replaced["result"]["sources"].as_array().unwrap().len(), 1);
    assert_eq!(
        replaced["result"]["sources"][0]["result"]["entries"][0]["id"],
        "260101-b"
    );
}
