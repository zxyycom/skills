use super::*;

#[test]
fn pending_record_parses_representation_and_rejects_invalid_identity_or_path() {
    assert!(valid_oid(&"a".repeat(40)));
    assert!(valid_oid(&"0".repeat(64)));
    assert!(!valid_oid(&"a".repeat(39)));
    assert!(!valid_oid(&"A".repeat(40)));
    assert!(!valid_oid(&"g".repeat(40)));
    let oid = "a".repeat(40);
    let record = format!("100755 {oid} 0\tdocs/record.md");
    let parsed = parse_pending_entry(record.as_bytes()).unwrap();
    assert_eq!(parsed.path, PathBuf::from("docs/record.md"));
    assert_eq!(parsed.mode, 0o100755);
    assert_eq!(parsed.oid, oid);
    assert_eq!(parsed.stage, 0);

    for malformed in [
        format!("100644 {} 0\tdocs/x", "A".repeat(40)),
        format!("100644 {} 4\tdocs/x", "a".repeat(40)),
        format!("100644 {} 0\t../x", "a".repeat(40)),
        format!("100644 {} 0 extra\tdocs/x", "a".repeat(40)),
    ] {
        assert!(
            parse_pending_entry(malformed.as_bytes()).is_err(),
            "{malformed}"
        );
    }
}

#[test]
fn local_paths_convert_to_git_spelling_without_weakening_raw_output_validation() {
    let local = PathBuf::from("docs").join("nested").join("record.md");
    assert_eq!(git_path(&local).unwrap(), "docs/nested/record.md");
    for invalid in [
        "",
        "../record.md",
        "docs/../record.md",
        "/absolute",
        "docs//record.md",
    ] {
        assert!(
            git_path(std::path::Path::new(invalid)).is_err(),
            "{invalid}"
        );
    }
    assert_raw_git_paths();
    #[cfg(windows)]
    assert_eq!(
        git_path(std::path::Path::new(r"docs\record.md")).unwrap(),
        "docs/record.md"
    );
    #[cfg(not(windows))]
    {
        assert!(git_path(std::path::Path::new(r"docs\record.md")).is_err());
        for valid in [
            "docs/file:stream",
            "docs/NUL",
            "docs/con.txt",
            "docs/Lpt1.log",
        ] {
            assert_eq!(git_path(std::path::Path::new(valid)).unwrap(), valid);
        }
    }
}

/// Raw Git records retain their own POSIX path validation, independent of local paths.
fn assert_raw_git_paths() {
    let oid = "a".repeat(40);
    for name in [r"docs\record.md", r"docs\..\record.md"] {
        let record = format!("100644 {oid} 0\t{name}");
        assert!(parse_pending_entry(record.as_bytes()).is_err(), "{name}");
    }
    for name in ["docs/file:stream", "docs/NUL", "docs/con.txt"] {
        let record = format!("100644 {oid} 0\t{name}");
        assert!(parse_pending_entry(record.as_bytes()).is_ok(), "{name}");
    }
}
