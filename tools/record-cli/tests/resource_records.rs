use serde_json::Value;
use std::{
    fs,
    path::Path,
    process::{Command, Output},
};
fn run(root: &Path, args: &[&str]) -> (Output, Value) {
    let o = Command::new(env!("CARGO_BIN_EXE_resource-records"))
        .args(args)
        .arg("--root")
        .arg(root)
        .arg("--json")
        .output()
        .unwrap();
    let v = serde_json::from_slice(&o.stdout).unwrap_or_else(|_| {
        panic!(
            "stdout {:?}, stderr {:?}",
            String::from_utf8_lossy(&o.stdout),
            String::from_utf8_lossy(&o.stderr)
        )
    });
    (o, v)
}
fn fixture() -> tempfile::TempDir {
    let d = tempfile::tempdir().unwrap();
    fs::create_dir_all(d.path().join("resources/records")).unwrap();
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
#[path = "resource_records/queries.rs"]
mod queries;
#[path = "resource_records/regressions.rs"]
mod regressions;
#[path = "resource_records/validation.rs"]
mod validation;
