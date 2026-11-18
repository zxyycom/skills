use serde_json::Value;
use std::{
    fs,
    path::Path,
    process::{Command, Output},
};
fn command(root: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_resource-records"));
    command.arg("--root").arg(root);
    command
}
fn run(root: &Path, args: &[&str]) -> (Output, Value) {
    let o = command(root).arg("--json").args(args).output().unwrap();
    let v = serde_json::from_slice(&o.stdout).unwrap_or_else(|_| {
        panic!(
            "stdout {:?}, stderr {:?}",
            String::from_utf8_lossy(&o.stdout),
            String::from_utf8_lossy(&o.stderr)
        )
    });
    (o, v)
}
fn successful_result(root: &Path, args: &[&str]) -> Value {
    let (output, mut envelope) = run(root, args);
    assert!(output.status.success(), "{args:?}: {envelope}");
    assert_eq!(envelope["ok"], true, "{args:?}: {envelope}");
    envelope["result"].take()
}
fn assert_error(root: &Path, args: &[&str], code: i32, fragments: &[&str]) {
    let (output, envelope) = run(root, args);
    assert_eq!(output.status.code(), Some(code), "{args:?}: {envelope}");
    assert!(output.stderr.is_empty(), "{args:?}: {output:?}");
    assert_eq!(envelope["ok"], false, "{envelope}");
    let message = envelope["error"]["message"].as_str().unwrap();
    for fragment in fragments {
        assert!(
            message.contains(fragment),
            "expected {fragment:?} in {message:?}"
        );
    }
}
fn empty_fixture() -> tempfile::TempDir {
    let d = tempfile::tempdir().unwrap();
    fs::create_dir_all(d.path().join("resources/records")).unwrap();
    d
}
fn fixture() -> tempfile::TempDir {
    let d = empty_fixture();
    write(
        d.path(),
        "collection",
        r#"---
schemaVersion: 1
kind: collection
id: root
title: 根
selections:
  - slot: use
    target: {resource: pack, version: v1, member: frame}
    basis: user-confirmed
    scope: 测试
    evidence: {path: decisions.md, locator: choice}
---
集合正文
"#,
    );
    write(
        d.path(),
        "base",
        r#"---
schemaVersion: 1
kind: resource
id: base
title: 底图
collection: root
versions:
  - id: v1
    files:
      - id: original
        role: primary
        sha256: null
        locations: []
        gap: 不可取用
      - id: crop
        role: derivative
        sha256: null
        locations: []
        gap: 不可取用
        relations:
          - type: preview-of
            target: {record: {resource: base, version: v1, member: original}}
            evidence: {path: evidence.md, locator: crop}
            scope: 裁剪
    members: []
---
底图正文
"#,
    );
    write(
        d.path(),
        "pack",
        r#"---
schemaVersion: 1
kind: resource
id: pack
title: 图包
collection: root
versions:
  - id: v1
    files: []
    members:
      - id: frame
        target: {resource: base, version: v1, member: crop}
        role: first
---
图包正文
"#,
    );
    d
}
fn write(root: &Path, name: &str, text: &str) {
    fs::write(root.join(format!("resources/records/{name}.md")), text).unwrap();
}
#[path = "resource_records/cli_regressions.rs"]
mod cli_regressions;
#[path = "resource_records/lineage.rs"]
mod lineage;
#[path = "resource_records/logical_entries.rs"]
mod logical_entries;
#[path = "resource_records/queries.rs"]
mod queries;
#[path = "resource_records/regressions.rs"]
mod regressions;
#[path = "resource_records/validation.rs"]
mod validation;
