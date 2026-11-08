use super::ready_report;
use std::{
    fs,
    path::Path,
    process::{Command, Output},
};

fn run(root: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_investigation-report"))
        .args(args)
        .args(["--root", root.to_str().unwrap(), "--json"])
        .output()
        .unwrap()
}

fn new(root: &Path, name: &str, extra: &[&str]) -> Output {
    let mut args = vec![
        "new",
        name,
        "--title",
        "Example",
        "--question",
        "Question",
        "--tag",
        "test",
        "--formed-at",
        "2026-11-06T12:00:00Z",
    ];
    args.extend_from_slice(extra);
    run(root, &args)
}

fn candidate_names(root: &Path) -> Vec<std::ffi::OsString> {
    let mut names: Vec<_> = fs::read_dir(root.join("docs/investigations"))
        .unwrap()
        .map(|e| e.unwrap().file_name())
        .collect();
    names.sort();
    names
}

#[path = "ir_cli_contract/collection.rs"]
mod collection;
#[path = "ir_cli_contract/creation.rs"]
mod creation;
