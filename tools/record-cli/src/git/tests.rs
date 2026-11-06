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
