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
        ("large.txt", CompressionMethod::Sampled, 0.20, 1048576),
    ] {
        let compression = find(name).compressibility.as_ref().unwrap();
        assert_eq!(compression.method, method);
        assert_eq!(compression.threshold, threshold);
        assert_eq!(compression.input_bytes, input);
        assert!(compression.compressed_ratio <= threshold);
    }
    assert!(observed.complete);
    assert_eq!(
        observed.read_budget_used_bytes,
        8192 + 65536 + 262144 + 1048576
    );
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
    let mut a = vec![0x61; 4194305];
    let mut b = a.clone();
    // Outside all four default windows: equal samples conceal a real difference.
    a[500000] = 0x78;
    b[500000] = 0x79;
    let (temp, refs) = fixture(&[("a.txt", a), ("b.txt", b)]);
    let policy = Policy {
        read_budget_bytes: 2097152,
        ..Policy::default()
    };
    let observed = inspect(&temp, &refs, &policy);
    assert!(observed.duplicate_groups.is_empty());
    assert!(!observed.complete);
    assert_eq!(observed.read_budget_used_bytes, 2097152);
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
            .all(|f| f.compressibility.as_ref().unwrap().input_bytes == 1048576)
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

#[test]
fn non_text_resources_only_read_headers_without_duplicate_candidates() {
    let mut png = vec![0; 1048577];
    png[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    let (temp, refs) = fixture(&[("large.png", png)]);
    let observed = inspect(&temp, &refs, &Policy::default());
    assert!(observed.complete);
    assert_eq!(observed.read_budget_used_bytes, 8192);
    assert_eq!(observed.files[0].content_type, "image/png");
    assert!(observed.files[0].compressibility.is_none());
}

#[test]
fn non_text_duplicate_candidates_compare_complete_bytes() {
    let mut png = vec![0; 16384];
    png[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    let mut different = png.clone();
    different[10000] = 1;
    let (temp, refs) = fixture(&[("a.png", png.clone()), ("b.png", png), ("c.png", different)]);
    let observed = inspect(&temp, &refs, &Policy::default());
    assert!(observed.complete);
    assert_eq!(observed.read_budget_used_bytes, 49152);
    assert_eq!(observed.duplicate_groups.len(), 1);
    assert_eq!(
        observed.duplicate_groups[0].resource_ids,
        ["owner/a.png", "owner/b.png"]
    );
    assert_eq!(observed.duplicate_groups[0].redundant_bytes, 16384);
    assert_eq!(observed.files.len(), 3);
    assert!(observed.files.iter().all(|file| {
        file.duplicate_check == DuplicateCheck::FullByteComparison && file.compressibility.is_none()
    }));
}

#[test]
fn basic_observations_survive_exhausted_content_budget() {
    let (temp, refs) = fixture(&[
        ("a.txt", vec![0x61; 65536]),
        ("b.txt", vec![0x62; 65536]),
        ("late.png", vec![137, 80, 78, 71, 13, 10, 26, 10]),
    ]);
    let policy = Policy {
        read_budget_bytes: 16392,
        ..Policy::default()
    };
    let observed = inspect(&temp, &refs, &policy);
    assert!(!observed.complete);
    assert_eq!(observed.skipped_files, 2);
    assert_eq!(observed.read_budget_used_bytes, 16392);
    assert_eq!(observed.files.len(), 3);
    assert!(
        observed
            .files
            .iter()
            .all(|f| f.content_type != "not-inspected")
    );
    assert_eq!(observed.files[2].content_type, "image/png");
    assert!(
        observed.files[..2]
            .iter()
            .all(|f| f.duplicate_check == DuplicateCheck::NotChecked)
    );
}

#[test]
fn overlapping_sample_requests_reuse_headers_and_read_each_byte_once() {
    let (temp, refs) = fixture(&[("sample.txt", vec![0x61; 10000])]);
    let mut policy = Policy::default();
    policy.compressibility.full_file_bytes = 1;
    policy.compressibility.sample_window_bytes = 8192;
    policy.compressibility.bands = vec![super::policy::Band {
        min_bytes: 1,
        max_compressed_ratio: 0.2,
    }];
    policy.read_budget_bytes = 10000;
    policy.validate().unwrap();
    let observed = inspect(&temp, &refs, &policy);
    assert!(observed.complete);
    assert_eq!(observed.read_budget_used_bytes, 10000);
    let compression = observed.files[0].compressibility.as_ref().unwrap();
    assert_eq!(compression.method, CompressionMethod::Sampled);
    assert_eq!(compression.input_bytes, 10000);
}

#[test]
fn acceptance_is_scoped_to_source_rule_and_exact_duplicate_members() {
    use super::policy::{Acceptance, AcceptanceSource};
    let (temp, refs) = fixture(&[("a", b"same".to_vec()), ("b", b"same".to_vec())]);
    let source = AcceptanceSource {
        root: ".".into(),
        investigations_dir: "records".into(),
    };
    let mut policy = Policy {
        file_bytes_warn: 1,
        ..Policy::default()
    };
    policy.acceptances = vec![
        Acceptance {
            source: source.clone(),
            code: "resource-file-bytes".into(),
            target: Some("owner/a".into()),
            members: None,
            reason: "retained evidence".into(),
        },
        Acceptance {
            source,
            code: "resource-exact-duplicates".into(),
            target: None,
            members: Some(vec!["owner/a".into(), "owner/b".into()]),
            reason: "both needed".into(),
        },
    ];
    policy.resolved_acceptances = policy
        .acceptances
        .iter()
        .map(|a| a.resolve(temp.path()).unwrap())
        .collect();
    let observed = inspect(&temp, &refs, &policy);
    assert_eq!(observed.summary.accepted, 2);
    assert!(
        observed
            .findings
            .iter()
            .any(|f| f.target == "owner/b" && f.code == "resource-file-bytes" && !f.accepted)
    );
    assert!(
        !observed
            .warnings()
            .iter()
            .any(|w| w.contains("resource-exact-duplicates"))
    );
    assert!(observed.complete);
    assert!(
        observed
            .findings
            .iter()
            .find(|f| f.code == "resource-exact-duplicates")
            .unwrap()
            .acceptance_reason
            .as_deref()
            == Some("both needed")
    );
    let (other, other_refs) = fixture(&[("a", b"same".to_vec()), ("b", b"same".to_vec())]);
    assert_eq!(inspect(&other, &other_refs, &policy).summary.accepted, 0);
    policy.acceptances[1].members = Some(vec!["owner/a".into(), "owner/c".into()]);
    policy.resolved_acceptances = policy
        .acceptances
        .iter()
        .map(|a| a.resolve(temp.path()).unwrap())
        .collect();
    assert_eq!(inspect(&temp, &refs, &policy).summary.accepted, 1);
    policy.resolved_acceptances.clear();
    assert_eq!(inspect(&temp, &refs, &policy).summary.accepted, 0);
}
