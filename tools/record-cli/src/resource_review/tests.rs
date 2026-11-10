use super::{CompressionMethod, DuplicateCheck, ReportResources, Review, policy::Policy, review};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
};

fn fixture(files: &[(&str, Vec<u8>)]) -> (tempfile::TempDir, ReportResources) {
    let temp = tempfile::tempdir().unwrap();
    let resources = temp.path().join("records/_resources/owner");
    fs::create_dir_all(&resources).unwrap();
    let mut ids = Vec::new();
    for (name, bytes) in files {
        fs::write(resources.join(name), bytes).unwrap();
        ids.push(format!("owner/{name}"));
    }
    (temp, BTreeMap::from([("owner".into(), ids)]))
}

fn inspect(temp: &tempfile::TempDir, refs: &ReportResources, policy: &Policy) -> Review {
    let root = crate::source::open_root(temp.path()).unwrap();
    review(&root, "records", refs, policy, &BTreeSet::new())
}

#[test]
fn compression_starts_at_64_kib_and_reports_full_or_sampled_coverage() {
    let (temp, refs) = fixture(&[
        ("below.txt", vec![0x61; 65535]),
        ("boundary.txt", vec![0x62; 65536]),
        ("middle.txt", vec![0x64; 262144]),
        ("large.txt", vec![0x63; 1048577]),
    ]);
    let observed = inspect(&temp, &refs, &Policy::default());
    let find = |name: &str| {
        observed
            .files
            .iter()
            .find(|f| f.resource_id.ends_with(name))
            .unwrap()
    };
    assert!(find("below.txt").compressibility.is_none());
    for (name, method, threshold, input) in [
        ("boundary.txt", CompressionMethod::Full, 0.10, 65536),
        ("middle.txt", CompressionMethod::Full, 0.15, 262144),
        ("large.txt", CompressionMethod::Sampled, 0.20, 262144),
    ] {
        let compression = find(name).compressibility.as_ref().unwrap();
        assert_eq!(compression.method, method);
        assert_eq!(compression.threshold, threshold);
        assert_eq!(compression.input_bytes, input);
        assert!(compression.compressed_ratio <= threshold);
    }
    assert!(observed.complete);
}

#[test]
fn bounded_reads_report_incomplete_instead_of_silently_clearing_risks() {
    let (temp, refs) = fixture(&[("large.txt", vec![0x61; 65536])]);
    let policy = Policy {
        read_budget_bytes: 32,
        ..Policy::default()
    };
    let observed = inspect(&temp, &refs, &policy);
    assert!(!observed.complete);
    assert_eq!(observed.skipped_files, 1);
    assert!(observed.read_budget_used_bytes <= 32);
    assert!(
        observed
            .findings
            .iter()
            .any(|f| f.code == "resource-inspection-incomplete")
    );
}

#[test]
fn disabled_review_does_not_inspect_missing_resources() {
    let temp = tempfile::tempdir().unwrap();
    let refs = BTreeMap::from([("owner".into(), vec!["owner/missing.txt".into()])]);
    let policy = Policy {
        enabled: false,
        ..Policy::default()
    };
    let observed = inspect(&temp, &refs, &policy);
    assert!(!observed.enabled);
    assert!(!observed.complete);
    assert_eq!(observed.read_budget_used_bytes, 0);
    assert!(observed.files.is_empty());
    assert!(observed.findings.is_empty());
}

#[test]
fn sampled_equal_prefixes_never_confirm_duplicate_files() {
    let mut a = vec![0x61; 1048577];
    let mut b = a.clone();
    // Outside all four default windows: equal samples conceal a real difference.
    a[100000] = 0x78;
    b[100000] = 0x79;
    let (temp, refs) = fixture(&[("a.txt", a), ("b.txt", b)]);
    let policy = Policy {
        read_budget_bytes: 524288,
        ..Policy::default()
    };
    let observed = inspect(&temp, &refs, &policy);
    assert!(observed.duplicate_groups.is_empty());
    assert!(!observed.complete);
    assert_eq!(observed.files.len(), 2);
    assert!(
        observed
            .files
            .iter()
            .all(|f| f.duplicate_check == DuplicateCheck::NotChecked)
    );
    assert!(
        observed
            .files
            .iter()
            .all(|f| f.compressibility.as_ref().unwrap().input_bytes == 262144)
    );
}

#[test]
fn metadata_limits_report_known_totals_and_omitted_resources() {
    let (temp, refs) = fixture(&[("a.txt", vec![0x61; 4]), ("b.txt", vec![0x62; 5])]);
    let policy = Policy {
        file_bytes_warn: 4,
        report_bytes_warn: 8,
        report_files_warn: 1,
        ..Policy::default()
    };
    let observed = inspect(&temp, &refs, &policy);
    assert!(observed.complete);
    assert_eq!(observed.reports[0].known_bytes, 9);
    assert!(observed.reports[0].metadata_complete);
    let files: Vec<_> = observed
        .findings
        .iter()
        .filter(|f| f.code == "resource-file-bytes")
        .collect();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].target, "owner/b.txt");
    assert!(
        observed
            .findings
            .iter()
            .any(|f| f.code == "resource-report-bytes")
    );
    assert!(
        observed
            .findings
            .iter()
            .any(|f| f.code == "resource-report-count")
    );
    let limited = inspect(
        &temp,
        &refs,
        &Policy {
            max_files: 1,
            ..policy
        },
    );
    assert!(!limited.complete);
    assert_eq!(limited.skipped_files, 1);
    assert_eq!(limited.reports[0].resource_count, 2);
    assert_eq!(limited.reports[0].known_bytes, 4);
    assert!(!limited.reports[0].metadata_complete);
    assert!(
        limited
            .findings
            .iter()
            .any(|f| f.code == "resource-file-budget")
    );
}
