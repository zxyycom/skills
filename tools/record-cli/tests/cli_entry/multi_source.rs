use serde_json::{Value, json};
use std::{
    fs,
    path::Path,
    process::{Command, Output},
};

fn invoke(cwd: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .current_dir(cwd)
        .args(args)
        .output()
        .unwrap()
}
fn parse(output: &Output) -> Value {
    serde_json::from_slice(&output.stdout).unwrap()
}
fn source(root: &Path, dir: &str, name: &str) {
    let directory = root.join(dir);
    fs::create_dir_all(&directory).unwrap();
    let id = format!("260101-{name}");
    let fingerprint = format!("sha256:{}", "0".repeat(64));
    let path = directory.join("investigation-index.json");
    let mut index: Value = if path.exists() {
        serde_json::from_slice(&fs::read(&path).unwrap()).unwrap()
    } else {
        json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":fingerprint,"entries":{}},"entries":{}})
    };
    index["sourceRevision"]["entries"][&id] = json!(fingerprint);
    index["entries"][&id] = json!({"name":name,"sourcePath":format!("{name}.md"),"title":"Shared marker","formedAt":"2026-01-01T00:00:00Z","question":"Question","tags":["test"],"relations":[],"resourceIds":[]});
    fs::write(
        directory.join("investigation-index.json"),
        serde_json::to_vec(&index).unwrap(),
    )
    .unwrap();
    fs::write(
        directory.join(format!("{name}.md")),
        format!("---\ntitle: \"Shared marker\"\nid: \"{id}\"\n---\nneedle in body\n"),
    )
    .unwrap();
}
fn setup() -> tempfile::TempDir {
    let temp = tempfile::tempdir().unwrap();
    source(&temp.path().join("first"), "research/reports", "a");
    source(&temp.path().join("second"), "notes/reports", "b");
    fs::create_dir(temp.path().join(".local")).unwrap();
    fs::write(temp.path().join(".local/.investigation-report.local.json"), r#"{"defaultKey":"related","sources":{"related":[{"root":"../first","investigationsDir":"research/reports"},{"root":"../second","investigationsDir":"notes/reports"}]}}"#).unwrap();
    temp
}
fn successful(output: &Output) -> Value {
    assert!(
        output.status.success(),
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let value = parse(output);
    assert_eq!(value["ok"], true, "{value}");
    value
}

#[test]
fn ordered_sources_keep_independent_query_windows_without_deduplication() {
    let temp = setup();
    source(&temp.path().join("first"), "research/reports", "c");
    // The same ID in another repository is a separate result, not a global identity.
    fs::remove_dir_all(temp.path().join("second")).unwrap();
    source(&temp.path().join("second"), "notes/reports", "a");
    source(&temp.path().join("second"), "notes/reports", "d");
    for args in [
        vec!["list", "--limit", "1", "--json"],
        vec!["search", "needle", "--limit", "1", "--json"],
        vec![
            "search", "marker", "--in", "metadata", "--limit", "1", "--json",
        ],
    ] {
        let value = successful(&invoke(temp.path(), &args));
        let sources = value["result"]["sources"].as_array().unwrap();
        assert_eq!(sources.len(), 2);
        for (i, dir) in ["research/reports", "notes/reports"].iter().enumerate() {
            assert_eq!(sources[i]["investigationsDir"], *dir);
            assert_eq!(sources[i]["result"]["entries"].as_array().unwrap().len(), 1);
            assert_eq!(sources[i]["result"]["entries"][0]["id"], "260101-a");
        }
    }
    // Both sources have two matches. At equal formation time list orders by ID.
    let value = successful(&invoke(
        temp.path(),
        &["list", "--limit", "1", "--offset", "1", "--json"],
    ));
    for (index, id) in ["260101-c", "260101-d"].iter().enumerate() {
        assert_eq!(
            value["result"]["sources"][index]["result"]["entries"][0]["id"],
            *id
        );
        assert_eq!(value["result"]["sources"][index]["result"]["total"], 2);
    }
}

#[test]
fn returned_locations_allow_show_to_target_one_source_with_a_shared_id() {
    let temp = setup();
    fs::remove_dir_all(temp.path().join("second")).unwrap();
    source(&temp.path().join("second"), "notes/reports", "a");
    fs::write(
        temp.path().join("second/notes/reports/a.md"),
        "---\ntitle: \"Shared marker\"\nid: \"260101-a\"\n---\nsecond repository body\n",
    )
    .unwrap();
    let value = successful(&invoke(temp.path(), &["list", "--json"]));
    for (i, body) in ["needle in body", "second repository body"]
        .iter()
        .enumerate()
    {
        let location = &value["result"]["sources"][i];
        let shown = successful(&invoke(
            temp.path(),
            &[
                "show",
                "260101-a",
                "--root",
                location["root"].as_str().unwrap(),
                "--investigations-dir",
                location["investigationsDir"].as_str().unwrap(),
                "--json",
            ],
        ));
        assert_eq!(shown["result"]["id"], "260101-a");
        assert!(shown["result"]["markdown"].as_str().unwrap().contains(body));
        assert!(shown["result"]["sources"].is_null());
    }
}

#[test]
fn failed_source_retains_other_results_and_nonzero_exit() {
    let temp = setup();
    fs::remove_file(
        temp.path()
            .join("first/research/reports/investigation-index.json"),
    )
    .unwrap();
    let output = invoke(temp.path(), &["search", "needle", "--json"]);
    assert_eq!(output.status.code(), Some(1));
    let value = parse(&output);
    assert_eq!(value["ok"], false);
    assert_eq!(value["error"]["code"], "source-query-failed");
    let sources = value["result"]["sources"].as_array().unwrap();
    assert_eq!(sources.len(), 2);
    assert_eq!(sources[0]["ok"], false);
    assert_eq!(sources[0]["error"]["code"], "index-not-found");
    assert_eq!(sources[0]["investigationsDir"], "research/reports");
    assert_eq!(
        Path::new(sources[0]["root"].as_str().unwrap())
            .canonicalize()
            .unwrap(),
        temp.path().join("first").canonicalize().unwrap()
    );
    assert_eq!(sources[1]["ok"], true);
    assert_eq!(sources[1]["result"]["entries"][0]["id"], "260101-b");
}

#[test]
fn configuration_selects_default_or_explicit_key_relative_to_its_own_directory() {
    let temp = setup();
    let cwd = temp.path();
    let config = json!({"defaultKey":"related","sources":{
        "related":[{"root":"../first","investigationsDir":"research/reports"}],
        "other":[{"root":"../second","investigationsDir":"notes/reports"}]
    }});
    fs::write(
        cwd.join(".local/.investigation-report.local.json"),
        config.to_string(),
    )
    .unwrap();
    let default = successful(&invoke(cwd, &["list", "--json"]));
    assert_eq!(default["result"]["key"], "related");
    assert_eq!(
        default["result"]["sources"][0]["result"]["entries"][0]["id"],
        "260101-a"
    );
    let other = successful(&invoke(cwd, &["list", "--key", "other", "--json"]));
    assert_eq!(other["result"]["key"], "other");
    assert_eq!(other["result"]["sources"].as_array().unwrap().len(), 1);
    assert_eq!(
        other["result"]["sources"][0]["result"]["entries"][0]["id"],
        "260101-b"
    );
    // A different config location and default distinguishes --config from ignoring it.
    fs::create_dir(cwd.join("alternate")).unwrap();
    fs::write(cwd.join("alternate/sources.json"), r#"{"defaultKey":"not-selected","sources":{"not-selected":[{"root":"../first","investigationsDir":"research/reports"}],"chosen":[{"root":"../second","investigationsDir":"notes/reports"}]}}"#).unwrap();
    let explicit = successful(&invoke(
        cwd,
        &[
            "list",
            "--config",
            "alternate/sources.json",
            "--key",
            "chosen",
            "--json",
        ],
    ));
    assert_eq!(explicit["result"]["key"], "chosen");
    assert_eq!(
        explicit["result"]["sources"][0]["result"]["entries"][0]["id"],
        "260101-b"
    );
}

#[test]
fn invalid_or_explicitly_missing_configuration_never_falls_back_to_single_source() {
    let temp = setup();
    let cwd = temp.path();
    // A valid fallback makes accidental silent fallback distinguishable from rejection.
    source(cwd, "docs/investigations", "fallback");
    fs::write(
        cwd.join(".local/.investigation-report.local.json"),
        "invalid",
    )
    .unwrap();
    let output = invoke(cwd, &["list", "--json"]);
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(parse(&output)["error"]["code"], "config-error");
    fs::remove_file(cwd.join(".local/.investigation-report.local.json")).unwrap();
    for args in [
        vec!["list", "--config", "absent", "--json"],
        vec!["list", "--key", "related", "--json"],
    ] {
        let output = invoke(cwd, &args);
        assert_eq!(output.status.code(), Some(1), "{args:?}");
        assert_eq!(parse(&output)["error"]["code"], "config-error");
    }
    // Existing valid configuration, but a key outside its declared groups.
    fs::write(cwd.join(".local/.investigation-report.local.json"), r#"{"defaultKey":"related","sources":{"related":[{"root":"../first","investigationsDir":"research/reports"}]}}"#).unwrap();
    let unknown = invoke(cwd, &["list", "--key", "missing", "--json"]);
    assert_eq!(unknown.status.code(), Some(1));
    assert_eq!(parse(&unknown)["error"]["code"], "config-error");
}

#[test]
fn absent_cwd_configuration_uses_local_single_source_without_searching_parents() {
    let temp = setup();
    let child = temp.path().join("first");
    source(&child, "docs/investigations", "local");
    // Parent has a valid multi-source config. Upward search would succeed with a different shape.
    let value = successful(&invoke(&child, &["list", "--json"]));
    assert_eq!(value["result"]["entries"][0]["id"], "260101-local");
    assert!(value["result"]["sources"].is_null());
}

#[test]
fn source_group_options_are_isolated_from_explicit_locations_and_other_commands() {
    let temp = setup();
    let cwd = temp.path();
    let args = ["list", "--root", ".", "--key", "related", "--json"];
    let output = invoke(cwd, &args);
    assert_eq!(output.status.code(), Some(2));
    assert_eq!(parse(&output)["error"]["code"], "invalid-arguments");
    // Explicit location suppresses group routing, not configuration validation.
    source(&cwd.join("first"), "docs/investigations", "root-only");
    source(cwd, "custom/reports", "dir-only");
    for (args, id) in [
        (
            vec!["list", "--root", "first", "--json"],
            "260101-root-only",
        ),
        (
            vec!["list", "--investigations-dir", "custom/reports", "--json"],
            "260101-dir-only",
        ),
    ] {
        let config_root = if id == "260101-root-only" {
            cwd.join("first")
        } else {
            cwd.to_path_buf()
        };
        fs::write(config_root.join(".investigation-report.json"), "invalid").unwrap();
        let rejected = invoke(cwd, &args);
        assert_eq!(rejected.status.code(), Some(1));
        assert_eq!(parse(&rejected)["error"]["code"], "config-error");
        fs::write(config_root.join(".investigation-report.json"), "{}").unwrap();
        let value = successful(&invoke(cwd, &args));
        assert_eq!(value["result"]["entries"][0]["id"], id);
        assert!(value["result"]["sources"].is_null());
    }
    source(cwd, "docs/investigations", "local");
    let shown = successful(&invoke(
        cwd,
        &["show", "260101-local", "--root", ".", "--json"],
    ));
    assert_eq!(shown["result"]["id"], "260101-local");
}

#[path = "multi_source_layers.rs"]
mod layers;

#[test]
fn content_preview_preserves_raw_utf16_in_success_and_partial_failure() {
    use serde::Deserialize;
    #[derive(Deserialize)]
    struct Envelope {
        result: Group,
    }
    #[derive(Deserialize)]
    struct Group {
        sources: Vec<Source>,
    }
    #[derive(Deserialize)]
    struct Source {
        result: Option<Content>,
    }
    #[derive(Deserialize)]
    struct Content {
        entries: Vec<Entry>,
    }
    #[derive(Deserialize)]
    struct Entry {
        previews: Vec<Preview>,
    }
    #[derive(Deserialize)]
    struct Preview {
        line: usize,
        preview: Box<serde_json::value::RawValue>,
    }

    let temp = setup();
    // x + 23,998 a's + emoji = 24,001 UTF-16 units. The 24,000-unit
    // preview ends after the emoji's high surrogate, before its low surrogate.
    let prefix = format!("x{}", "a".repeat(23998));
    fs::write(
        temp.path().join("first/research/reports/a.md"),
        format!("---\ntitle: \"Shared marker\"\nid: \"260101-a\"\n---\n{prefix}😀\n"),
    )
    .unwrap();
    for failure in [false, true] {
        if failure {
            fs::remove_file(
                temp.path()
                    .join("second/notes/reports/investigation-index.json"),
            )
            .unwrap();
        }
        let output = invoke(temp.path(), &["search", "x", "--json"]);
        assert_eq!(
            output.status.code(),
            Some(if failure { 1 } else { 0 }),
            "{}",
            String::from_utf8_lossy(&output.stdout)
        );
        // Deserialize only the preview as RawValue: a normal Rust String cannot
        // represent the deliberately unpaired UTF-16 unit in this JSON string.
        let envelope: Envelope = serde_json::from_slice(&output.stdout).unwrap();
        let entries = &envelope.result.sources[0].result.as_ref().unwrap().entries;
        assert_eq!(entries.len(), 1);
        let preview = entries[0].previews.iter().find(|p| p.line == 5).unwrap();
        let raw = preview.preview.get();
        let (before_surrogate, last_unit) = raw.split_at(raw.len() - 7);
        assert!(last_unit.eq_ignore_ascii_case("\\ud83d\""));
        let decoded_prefix: String =
            serde_json::from_str(&format!("{before_surrogate}\"")).unwrap();
        assert_eq!(decoded_prefix, prefix);
    }
}

#[path = "multi_source_composite.rs"]
mod composite;

#[path = "multi_source_read_routing.rs"]
mod read_routing;

#[path = "multi_source_write_selection.rs"]
mod write_selection;

#[path = "multi_source_help_context.rs"]
mod help_context;
