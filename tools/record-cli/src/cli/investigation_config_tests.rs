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

#[test]
fn acceptances_resolve_in_defining_layer_and_reject_invalid_rules() {
    let temp = tempfile::tempdir().unwrap();
    std::fs::create_dir(temp.path().join(".local")).unwrap();
    std::fs::create_dir(temp.path().join("source")).unwrap();
    let path = temp.path().join(".local/.investigation-report.local.json");
    let item = json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-file-bytes","target":"owner/a","reason":"reviewed"});
    std::fs::write(
        &path,
        json!({"resources":{"acceptances":[item]}}).to_string(),
    )
    .unwrap();
    let config = load(temp.path(), None).unwrap();
    assert_eq!(
        config.policy.resolved_acceptances[0].root,
        temp.path().join("source").canonicalize().unwrap()
    );
    // An unrelated later layer must retain the base of the defining project layer.
    let project = temp.path().join(".investigation-report.json");
    std::fs::write(&project, json!({"resources":{"acceptances":[{"source":{"root":"source","investigationsDir":"records"},"code":"resource-file-bytes","target":"owner/a","reason":"project"}]}}).to_string()).unwrap();
    std::fs::write(&path, json!({"resources":{"fileBytesWarn":2}}).to_string()).unwrap();
    let inherited = load(temp.path(), None).unwrap();
    assert_eq!(
        inherited.policy.resolved_acceptances[0].root,
        temp.path().join("source").canonicalize().unwrap()
    );
    assert_eq!(inherited.policy.resolved_acceptances[0].reason, "project");
    std::fs::write(&path, json!({"resources":{"acceptances":[]}}).to_string()).unwrap();
    assert!(
        load(temp.path(), None)
            .unwrap()
            .policy
            .resolved_acceptances
            .is_empty()
    );
    std::fs::remove_file(project).unwrap();
    let missing = json!({"source":{"root":"../missing","investigationsDir":"records"},"code":"resource-file-bytes","target":"owner/a","reason":"reviewed"});
    std::fs::write(
        &path,
        json!({"resources":{"acceptances":[missing]}}).to_string(),
    )
    .unwrap();
    let missing_config = load(temp.path(), None).unwrap();
    assert_eq!(
        missing_config.policy.resolved_acceptances[0].root,
        temp.path().join(".local/../missing")
    );
    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStringExt;
        let non_utf8 = temp
            .path()
            .join(std::ffi::OsString::from_vec(vec![b'n', 0xff]));
        std::fs::create_dir(&non_utf8).unwrap();
        std::fs::write(non_utf8.join(".investigation-report.json"), json!({"resources":{"acceptances":[{"source":{"root":".","investigationsDir":"records"},"code":"resource-file-bytes","target":"owner/a","reason":"reviewed"}]}}).to_string()).unwrap();
        let loaded = load(&non_utf8, None).unwrap();
        assert_eq!(
            loaded.policy.resolved_acceptances[0].root,
            non_utf8.canonicalize().unwrap()
        );
    }
    for invalid in [
        json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-report-bytes","target":"owner/a","reason":"x"}),
        json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-file-bytes","target":"owner","reason":"x"}),
        json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-inspection-incomplete","target":"owner/a","reason":"x"}),
        json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-file-bytes","target":"../a","reason":"x"}),
        json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-file-bytes","target":"owner/a","reason":" "}),
        json!({"source":{"root":"../source","investigationsDir":"records"},"code":"resource-exact-duplicates","members":["owner/b","owner/a"],"reason":"x"}),
    ] {
        std::fs::write(
            &path,
            json!({"resources":{"acceptances":[invalid]}}).to_string(),
        )
        .unwrap();
        assert!(load(temp.path(), None).is_err());
    }
}
