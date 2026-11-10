use super::*;
use serde_json::json;

#[test]
fn invalid_layers_are_rejected_even_when_local_settings_override_them() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::create_dir(temp.path().join(".local")).unwrap();
    std::fs::write(
        temp.path().join(".local/.investigation-report.local.json"),
        json!({
            "version": 1,
            "resources": {
                "readBudgetBytes": 1024,
                "compressibility": {"bands": [{"minBytes": 65536, "maxCompressedRatio": 0.1}]},
                "binary": {"unknown": "warn"},
                "enabled": true
            }
        })
        .to_string(),
    )
    .unwrap();
    for invalid in [
        json!({"resources":{"compressibility":{"bands":[]}}}),
        json!({"resources":{"readBudgetBytes":0}}),
        json!({"resources":{"binary":{"unknown":"error"}}}),
        json!({"resources":{"enabled":null}}),
        json!({"version":2}),
        json!({"resources":{"unexpected":true}}),
    ] {
        std::fs::write(
            temp.path().join(".investigation-report.json"),
            invalid.to_string(),
        )
        .unwrap();
        let error = match load(temp.path(), None) {
            Ok(_) => panic!("accepted invalid configuration: {invalid}"),
            Err(error) => error,
        };
        assert_eq!(error.code.as_ref(), "config-error");
        assert!(error.message.contains(".investigation-report.json"));
    }
}

#[test]
fn composition_resolves_cross_layer_references_in_first_seen_depth_first_order() {
    let temp = tempfile::tempdir().unwrap();
    let cwd = temp.path();
    std::fs::create_dir(cwd.join(".local")).unwrap();
    std::fs::create_dir(cwd.join("first")).unwrap();
    std::fs::create_dir(cwd.join("second")).unwrap();
    std::fs::write(cwd.join(".investigation-report.json"), json!({"defaultKey":"all","sources":{"a":{"root":"first","investigationsDir":"research/reports"},"all":["a","nested","a"]}}).to_string()).unwrap();
    std::fs::write(cwd.join(".local/.investigation-report.local.json"), json!({"sources":{"nested":[{"root":"../second","investigationsDir":"notes/reports"},"a"]}}).to_string()).unwrap();
    let selection = load(cwd, None)
        .unwrap()
        .select_sources(None, SourceAccess::Read)
        .unwrap()
        .unwrap();
    assert_eq!(selection.key, "all");
    assert_eq!(selection.sources.len(), 2);
    for (source, (root, directory)) in selection
        .sources
        .iter()
        .zip([("first", "research/reports"), ("second", "notes/reports")])
    {
        assert_eq!(
            source.root.canonicalize().unwrap(),
            cwd.join(root).canonicalize().unwrap()
        );
        assert_eq!(source.directory, directory);
    }
}

#[test]
fn missing_and_cyclic_references_identify_the_defining_layer_and_key() {
    let temp = tempfile::tempdir().unwrap();
    let cwd = temp.path();
    std::fs::create_dir(cwd.join(".local")).unwrap();
    std::fs::write(
        cwd.join(".investigation-report.json"),
        json!({"defaultKey":"all","sources":{"all":["nested"]}}).to_string(),
    )
    .unwrap();
    for (reference, diagnostic) in [
        ("missing", "unknown source key"),
        ("all", "source reference cycle"),
    ] {
        std::fs::write(
            cwd.join(".local/.investigation-report.local.json"),
            json!({"sources":{"nested":[reference]}}).to_string(),
        )
        .unwrap();
        let error = load(cwd, None)
            .err()
            .expect("invalid source graph accepted");
        assert_eq!(error.code.as_ref(), "config-error");
        assert!(error.message.contains(diagnostic), "{}", error.message);
        assert!(
            error.message.contains(".investigation-report.local.json"),
            "{}",
            error.message
        );
        assert!(
            error.message.contains("sources.nested"),
            "{}",
            error.message
        );
    }
}

#[test]
fn invalid_source_settings_are_rejected_before_routing() {
    let temp = tempfile::tempdir().unwrap();
    for invalid in [
        json!({"defaultKey":"unknown","sources":{"related":{"root":".","investigationsDir":"research/reports"}}}),
        json!({"defaultKey":"related","sources":{"related":[]}}),
        json!({"defaultKey":"related","sources":{"related":{"root":".","investigationsDir":"../escape"}}}),
    ] {
        std::fs::write(
            temp.path().join(".investigation-report.json"),
            invalid.to_string(),
        )
        .unwrap();
        let error = load(temp.path(), None)
            .err()
            .expect("invalid source settings accepted");
        assert_eq!(error.code.as_ref(), "config-error", "{invalid}");
    }
}

#[test]
fn invalid_default_write_keys_are_rejected_before_routing() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join(".investigation-report.json");
    let mut config = json!({
        "defaultKey": "one",
        "defaultWriteKey": "one",
        "sources": {
            "one": {"root": ".", "investigationsDir": "reports"},
            "many": ["one", {"root": ".", "investigationsDir": "other"}]
        }
    });
    std::fs::write(&path, config.to_string()).unwrap();
    load(temp.path(), None).expect("valid single-source write default rejected");
    for key in [
        json!("unknown"),
        json!(""),
        json!("many"),
        json!(false),
        json!(null),
    ] {
        config["defaultWriteKey"] = key;
        std::fs::write(&path, config.to_string()).unwrap();
        let error = load(temp.path(), None)
            .err()
            .expect("invalid write default accepted");
        assert_eq!(error.code.as_ref(), "config-error", "{config}");
    }
}

#[test]
fn write_defaults_resolve_after_layer_merging_independently_of_read_defaults() {
    let temp = tempfile::tempdir().unwrap();
    let cwd = temp.path();
    std::fs::create_dir(cwd.join(".local")).unwrap();
    std::fs::write(
        cwd.join(".investigation-report.json"),
        json!({
            "defaultKey": "all",
            "defaultWriteKey": "first",
            "sources": {
                "first": {"root": "first", "investigationsDir": "reports"},
                "all": ["first", "second"]
            }
        })
        .to_string(),
    )
    .unwrap();
    std::fs::write(
        cwd.join(".local/.investigation-report.local.json"),
        json!({
            "defaultWriteKey": "aliases",
            "sources": {
                "second": {"root": "../second", "investigationsDir": "notes"},
                "aliases": ["second", "second"]
            }
        })
        .to_string(),
    )
    .unwrap();
    let config = load(cwd, None).unwrap();
    let read = config
        .select_sources(None, SourceAccess::Read)
        .unwrap()
        .unwrap();
    assert_eq!(read.key, "all");
    assert_eq!(read.sources.len(), 2);
    let write = config
        .select_sources(None, SourceAccess::Write)
        .unwrap()
        .unwrap();
    assert_eq!(write.key, "aliases");
    assert_eq!(write.sources.len(), 1);
    assert_eq!(write.sources[0].root, cwd.join(".local/../second"));
    assert_eq!(write.sources[0].directory, "notes");
}
