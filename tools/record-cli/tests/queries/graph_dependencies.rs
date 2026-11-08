use super::*;
use std::{fs, process::Command};

#[test]
fn queries_only_require_graph_for_relation_filter_or_trace() {
    for domain in ["decisions", "investigations"] {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("docs").join(domain);
        fs::create_dir_all(&dir).unwrap();
        let entries = if domain == "decisions" {
            let state = |name: &str, other: &str| json!({"name":name,"sourcePath":format!("archive/{name}.md"),"title":"Indexed marker","status":"archived","alignment":"aligned","createdAt":"2026-01-01T00:00:00Z","purpose":"Purpose","background":"Background","decision":"Choice","tags":["topic"],"relations":[{"type":"修订","target":other}]});
            fs::create_dir(dir.join("archive")).unwrap();
            for (name, id) in [("one", "260101-one"), ("two", "260101-two")] {
                fs::write(
                    dir.join("archive").join(format!("{name}.md")),
                    format!("---\nid: {id}\n---\nIndexed marker\n"),
                )
                .unwrap();
            }
            json!({"260101-one":state("one","260101-two"),"260101-two":state("two","260101-one")})
        } else {
            let state = |name: &str, other: &str| json!({"name":name,"sourcePath":format!("{name}.md"),"title":"Indexed marker","formedAt":"2026-01-01T00:00:00Z","question":"Question","tags":["topic"],"relations":[{"type":"补充","target":other}],"resourceIds":[]});
            for (name, id) in [("one", "260101-one"), ("two", "260101-two")] {
                fs::write(
                    dir.join(format!("{name}.md")),
                    format!("---\ntitle: \"Title\"\nid: \"{id}\"\n---\nIndexed marker\n"),
                )
                .unwrap();
            }
            json!({"260101-one":state("one","260101-two"),"260101-two":state("two","260101-one")})
        };
        let (binary, index) = if domain == "decisions" {
            (
                env!("CARGO_BIN_EXE_decision-records"),
                "decision-index.json",
            )
        } else {
            (
                env!("CARGO_BIN_EXE_investigation-report"),
                "investigation-index.json",
            )
        };
        fs::write(dir.join(index), fixture(domain, entries)).unwrap();
        let run = |args: &[&str]| {
            Command::new(binary)
                .args(args)
                .args(["--root", root.path().to_str().unwrap(), "--json"])
                .output()
                .unwrap()
        };
        let list = if domain == "decisions" {
            vec!["list", "--status", "all"]
        } else {
            vec!["list"]
        };
        let metadata = if domain == "decisions" {
            vec!["search", "Indexed", "--in", "metadata", "--status", "all"]
        } else {
            vec!["search", "Indexed", "--in", "metadata"]
        };
        let content = if domain == "decisions" {
            vec!["search", "Indexed", "--in", "content", "--status", "all"]
        } else {
            vec!["search", "Indexed", "--in", "content"]
        };
        for args in [list, metadata, vec!["show", "one"], content] {
            let result = run(&args);
            assert!(
                result.status.success(),
                "{domain} {args:?}: {}",
                String::from_utf8_lossy(&result.stdout)
            );
        }
        for args in [vec!["list", "--related-to", "one"], vec!["trace", "one"]] {
            let result = run(&args);
            assert!(!result.status.success(), "{domain} {args:?}");
            let response: Value = serde_json::from_slice(&result.stdout).unwrap();
            assert_eq!(response["ok"], false);
        }
    }
}
