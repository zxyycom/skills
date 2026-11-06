//! Read-only search coverage and result-count facts.
use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub max_records: u64,
    pub resources: Option<ResourceLimits>,
    pub preview: Option<PreviewLimits>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceLimits {
    pub max_candidate_files: usize,
    pub max_file_bytes: u64,
    pub max_total_bytes: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewLimits {
    pub context_lines: usize,
    pub max_matches_per_file: usize,
    pub max_preview_characters: usize,
}
#[derive(Serialize)]
pub struct Query<F: Serialize> {
    pub text: String,
    #[serde(rename = "in")]
    pub scope: &'static str,
    #[serde(rename = "match")]
    pub mode: &'static str,
    pub filters: F,
    pub limits: Limits,
}
#[derive(Serialize)]
pub struct Source {
    pub kind: &'static str,
    pub currentness: &'static str,
    pub fallback: bool,
}
#[derive(Serialize)]
pub struct Matched {
    pub value: usize,
    pub precision: &'static str,
}
#[derive(Serialize)]
pub struct Counts {
    pub matched: Matched,
    pub returned: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Coverage {
    pub scan_complete: bool,
    pub results_complete: bool,
    pub previews_complete: Option<bool>,
    pub reasons: Vec<&'static str>,
}
#[derive(Serialize)]
pub struct SearchInfo<F: Serialize> {
    pub query: Query<F>,
    pub source: Source,
    pub counts: Counts,
    pub coverage: Coverage,
}
/// Complete metadata scan totals before and after limiting.
pub struct MetadataCounts {
    pub matched: usize,
    pub returned: usize,
}
pub fn metadata<F: Serialize>(
    text: String,
    mode: &'static str,
    filters: F,
    limit: u64,
    counts: MetadataCounts,
) -> SearchInfo<F> {
    let MetadataCounts { matched, returned } = counts;
    SearchInfo {
        query: Query {
            text,
            scope: "metadata",
            mode,
            filters,
            limits: Limits {
                max_records: limit,
                resources: None,
                preview: None,
            },
        },
        source: Source {
            kind: "published-index",
            currentness: "unchecked",
            fallback: false,
        },
        counts: Counts {
            matched: Matched {
                value: matched,
                precision: "exact",
            },
            returned,
        },
        coverage: Coverage {
            scan_complete: true,
            results_complete: matched == returned,
            previews_complete: None,
            reasons: if matched > returned {
                vec!["max-records"]
            } else {
                vec![]
            },
        },
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Truncation {
    pub files: bool,
    pub matches: bool,
    pub preview_characters: bool,
}
impl From<&super::content::Scan> for Truncation {
    fn from(scan: &super::content::Scan) -> Self {
        Self {
            files: scan.files_truncated,
            matches: scan.matches_truncated,
            preview_characters: scan.characters_truncated,
        }
    }
}

/// Warnings mirror the content coverage reasons without conflating preview and file limits.
pub fn content_warnings(coverage: &Coverage) -> Vec<String> {
    let mut warnings = Vec::new();
    if coverage.reasons.contains(&"max-records") {
        warnings.push("search results limited: max-records".into());
    }
    let reasons: Vec<_> = coverage
        .reasons
        .iter()
        .copied()
        .filter(|reason| *reason != "max-records")
        .collect();
    if !reasons.is_empty() {
        warnings.push(format!("search previews limited: {}", reasons.join(",")));
    }
    warnings
}

pub fn mode_name(mode: super::matcher::MatchMode) -> &'static str {
    match mode {
        super::matcher::MatchMode::All => "all",
        super::matcher::MatchMode::Any => "any",
        super::matcher::MatchMode::Phrase => "phrase",
    }
}

impl From<&super::content::Policy> for Limits {
    fn from(policy: &super::content::Policy) -> Self {
        Self {
            max_records: policy.max_files as u64,
            resources: Some(ResourceLimits {
                max_candidate_files: policy.max_candidate_files,
                max_file_bytes: policy.max_file_bytes,
                max_total_bytes: policy.max_total_bytes,
            }),
            preview: Some(PreviewLimits {
                context_lines: 1,
                max_matches_per_file: policy.max_matches,
                max_preview_characters: policy.max_characters,
            }),
        }
    }
}

pub fn content<F: Serialize>(
    text: String,
    mode: &'static str,
    filters: F,
    policy: &super::content::Policy,
    scan: &super::content::Scan,
) -> SearchInfo<F> {
    let complete = scan.scanned == scan.selected;
    SearchInfo {
        query: Query {
            text,
            scope: "content",
            mode,
            filters,
            limits: Limits::from(policy),
        },
        source: Source {
            kind: "published-index+current-text",
            currentness: "unchecked",
            fallback: false,
        },
        counts: Counts {
            matched: Matched {
                value: scan.matched,
                precision: if complete { "exact" } else { "lower-bound" },
            },
            returned: scan.hits.len(),
        },
        coverage: Coverage::from(scan),
    }
}

impl From<&super::content::Scan> for Coverage {
    fn from(scan: &super::content::Scan) -> Self {
        let complete = scan.scanned == scan.selected;
        let mut reasons = Vec::new();
        if scan.files_truncated {
            reasons.push("max-records");
        }
        if scan.matches_truncated {
            reasons.push("match-previews");
        }
        if scan.characters_truncated {
            reasons.push("preview-characters");
        }
        Self {
            scan_complete: complete,
            results_complete: complete && !scan.files_truncated,
            previews_complete: Some(!scan.matches_truncated && !scan.characters_truncated),
            reasons,
        }
    }
}

/// Machine coverage, human warnings, and truncation all describe the same content scan.
pub struct ContentPresentation<F: Serialize> {
    pub info: SearchInfo<F>,
    pub warnings: Vec<String>,
    pub truncation: Truncation,
}
pub fn content_presentation<F: Serialize>(
    text: String,
    mode: &'static str,
    filters: F,
    policy: &super::content::Policy,
    scan: &super::content::Scan,
) -> ContentPresentation<F> {
    let info = content(text, mode, filters, policy, scan);
    let warnings = content_warnings(&info.coverage);
    let truncation = Truncation::from(scan);
    ContentPresentation {
        info,
        warnings,
        truncation,
    }
}
