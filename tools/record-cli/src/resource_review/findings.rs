//! Complete finding collection, deterministic priority ordering and totals.
use super::{Finding, Review, policy::Level};
use serde::Serialize;
use std::{cmp::Ordering, collections::BTreeMap};

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Summary {
    pub accepted: usize,
    pub warnings: usize,
    pub info: usize,
    pub by_code: BTreeMap<&'static str, usize>,
}

impl Summary {
    fn from_findings(findings: &[Finding]) -> Self {
        let mut summary = Self::default();
        for finding in findings {
            summary.accepted += usize::from(finding.accepted);
            match finding.level {
                Level::Off => continue,
                Level::Info => summary.info += 1,
                Level::Warn => summary.warnings += 1,
            }
            *summary.by_code.entry(finding.code).or_default() += 1;
        }
        summary
    }
}

impl Review {
    pub(super) fn note(&mut self, level: Level, code: &'static str, target: &str, message: String) {
        if level == Level::Off {
            return;
        }
        self.findings.push(Finding {
            code,
            level,
            target: target.into(),
            message,
            accepted: false,
            acceptance_reason: None,
        });
    }
    pub(super) fn finish_findings(&mut self) {
        self.findings.sort_by(compare);
        self.summary = Summary::from_findings(&self.findings);
    }
    pub fn coverage_warnings(&self) -> Vec<String> {
        let mut messages = Vec::new();
        if !self.complete && self.enabled {
            messages.push(format!("resource-review-incomplete: {} file inspections incomplete; inspect resourceReview coverage", self.skipped_files));
        }
        messages
    }
    pub fn warnings(&self) -> Vec<String> {
        let mut messages = self.coverage_warnings();
        messages.extend(
            self.findings
                .iter()
                .filter(|f| f.level == Level::Warn && !f.accepted)
                .map(|f| format!("{}: {}: {}", f.code, f.target, f.message)),
        );
        messages
    }
}

fn priority(code: &str) -> u8 {
    match code {
        "resource-inspection-incomplete" | "resource-file-budget" => 0,
        "resource-exact-duplicates" => 1,
        "resource-file-bytes" | "resource-report-bytes" | "resource-report-count" => 2,
        "resource-content-type" => 3,
        "resource-high-compressibility" => 4,
        _ => 5,
    }
}

fn compare(a: &Finding, b: &Finding) -> Ordering {
    let level = |level| match level {
        Level::Warn => 0,
        Level::Info => 1,
        Level::Off => 2,
    };
    let rank = |finding: &Finding| {
        let kind = priority(finding.code);
        (u8::from(kind != 0), level(finding.level), kind)
    };
    (rank(a), a.code, &a.target, &a.message).cmp(&(rank(b), b.code, &b.target, &b.message))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn priority_sorting_keeps_all_findings_and_global_counts() {
        let mut review = Review::new(true, 136);
        for i in 0..132 {
            review.note(
                Level::Warn,
                "resource-high-compressibility",
                &format!("{i}.txt"),
                "heuristic".into(),
            );
        }
        review.note(
            Level::Info,
            "resource-content-type",
            "media.png",
            "media".into(),
        );
        review.note(
            Level::Warn,
            "resource-file-bytes",
            "large.txt",
            "large".into(),
        );
        review.note(
            Level::Warn,
            "resource-exact-duplicates",
            "same.txt",
            "proven".into(),
        );
        review.note(
            Level::Warn,
            "resource-inspection-incomplete",
            "missing.txt",
            "missing".into(),
        );
        review.note(Level::Off, "resource-content-type", "off", "ignored".into());
        review.complete = false;
        review.skipped_files = 1;
        review.finish_findings();
        assert_eq!(review.findings.len(), 136);
        assert_eq!(review.omitted_findings, 0);
        assert_eq!(review.summary.warnings, 135);
        assert_eq!(review.summary.info, 1);
        assert_eq!(review.summary.by_code["resource-high-compressibility"], 132);
        let codes: Vec<_> = review.findings.iter().take(3).map(|f| f.code).collect();
        assert_eq!(
            codes,
            [
                "resource-inspection-incomplete",
                "resource-exact-duplicates",
                "resource-file-bytes"
            ]
        );
        assert_eq!(
            review
                .findings
                .iter()
                .filter(|f| f.level == Level::Warn)
                .count(),
            135
        );
        assert_eq!(
            review
                .findings
                .iter()
                .filter(|f| f.code == "resource-high-compressibility")
                .count(),
            132
        );
        assert_eq!(review.findings.last().unwrap().target, "media.png");
        assert!(review.warnings()[0].starts_with("resource-review-incomplete:"));
    }
}
