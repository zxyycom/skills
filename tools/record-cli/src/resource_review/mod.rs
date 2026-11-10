//! Bounded, read-only resource advisories. Findings never authorize mutation.
mod content;
mod payload;
pub mod policy;
mod scan;
use policy::Level;
pub(crate) use scan::review;
use serde::Serialize;
use std::collections::BTreeMap;

pub(crate) type ReportResources = BTreeMap<String, Vec<String>>;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum CompressionMethod {
    Full,
    Sampled,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum DuplicateCheck {
    Disabled,
    NotNeeded,
    NotChecked,
    FullByteComparison,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Finding {
    pub code: &'static str,
    pub level: Level,
    pub target: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompressionObservation {
    pub method: CompressionMethod,
    pub algorithm: &'static str,
    pub input_bytes: u64,
    pub compressed_bytes: u64,
    pub compressed_ratio: f64,
    pub threshold: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileObservation {
    pub resource_id: String,
    pub bytes: u64,
    pub content_type: String,
    pub duplicate_check: DuplicateCheck,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compressibility: Option<CompressionObservation>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReportObservation {
    pub report_id: String,
    pub resource_count: usize,
    pub known_bytes: u64,
    pub metadata_complete: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DuplicateGroup {
    pub resource_ids: Vec<String>,
    pub redundant_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Review {
    pub enabled: bool,
    pub scope: &'static str,
    pub complete: bool,
    pub resource_count: usize,
    pub read_budget_used_bytes: u64,
    pub skipped_files: usize,
    pub omitted_findings: usize,
    pub findings: Vec<Finding>,
    pub duplicate_groups: Vec<DuplicateGroup>,
    pub reports: Vec<ReportObservation>,
    pub files: Vec<FileObservation>,
}

impl Review {
    fn new(enabled: bool, resource_count: usize) -> Self {
        Self {
            enabled,
            scope: "selected-report-references",
            complete: enabled,
            resource_count,
            read_budget_used_bytes: 0,
            skipped_files: 0,
            omitted_findings: 0,
            reports: vec![],
            files: vec![],
            duplicate_groups: vec![],
            findings: vec![],
        }
    }
    fn note(&mut self, level: Level, code: &'static str, target: &str, message: String) {
        if level == Level::Off {
            return;
        }
        if self.findings.len() >= 128 {
            self.omitted_findings += 1;
            return;
        }
        self.findings.push(Finding {
            code,
            level,
            target: target.into(),
            message,
        });
    }
    pub fn warnings(&self) -> Vec<String> {
        let mut messages: Vec<_> = self
            .findings
            .iter()
            .filter(|f| f.level == Level::Warn)
            .map(|f| format!("{}: {}: {}", f.code, f.target, f.message))
            .collect();
        if !self.complete && self.enabled {
            messages.push(format!("resource-review-incomplete: {} file inspections incomplete; inspect resourceReview coverage", self.skipped_files));
        }
        if self.omitted_findings > 0 {
            messages.push(format!(
                "resource-review-truncated: {} additional findings omitted",
                self.omitted_findings
            ));
        }
        messages
    }
}

#[cfg(test)]
mod tests;
