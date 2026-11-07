use super::*;
#[test]
fn rename_moves_owned_resources_and_updates_reference() {
    let dir = tempfile::tempdir().unwrap();
    let c = dir.path().join("investigations");
    std::fs::create_dir_all(c.join("_resources/261106-old")).unwrap();
    let text = "---\ntitle: \"Example\"\nid: \"261106-old\"\nformedAt: \"2026-11-06T12:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"example\"\nrelations: []\n---\n\n## 随附资源\n- [file](./_resources/261106-old/file.txt)\n";
    std::fs::write(c.join("_candidate.old"), text).unwrap();
    std::fs::write(c.join("_resources/261106-old/file.txt"), b"original").unwrap();
    let root = source::open_root(dir.path()).unwrap();
    let mut op = InvestigationIdentityOperation {
        collection: RelativePath::new("investigations").unwrap(),
        index_path: RelativePath::new("investigations/investigation-index.json").unwrap(),
        selector: "261106-old".into(),
        action: Action::Rename {
            target: "new".into(),
            confirm_recorded_report: false,
            confirm_recorded_candidate: false,
        },
    };
    let out = crate::transaction::run_transaction(&root, &mut op);
    assert!(out.errors.is_empty(), "{:?}", out.errors);
    assert!(out.changed && out.committed);
    assert!(!c.join("_candidate.old").exists());
    assert!(!c.join("_resources/261106-old").exists());
    assert_eq!(
        std::fs::read(c.join("_resources/261106-new/file.txt")).unwrap(),
        b"original"
    );
    let updated = std::fs::read_to_string(c.join("_candidate.new")).unwrap();
    assert!(updated.contains("_resources/261106-new/file.txt"));
}
