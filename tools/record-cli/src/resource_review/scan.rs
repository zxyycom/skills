use super::{
    CompressionObservation, DuplicateCheck, DuplicateGroup, FileObservation, ReportObservation,
    ReportResources, Review, content,
    payload::{Payload, ReadBudget},
    policy::{Level, Policy},
};
use crate::source::{self, RelativePath, Root};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

struct EqualContent {
    bytes: Vec<u8>,
    ids: Vec<String>,
}
struct Scanner<'a> {
    root: &'a Root,
    directory: &'a str,
    policy: &'a Policy,
    review: Review,
    budget: ReadBudget,
    duplicates: BTreeMap<String, Vec<EqualContent>>,
}

pub(crate) fn review(
    root: &Root,
    directory: &str,
    reports: &ReportResources,
    policy: &Policy,
    blocked: &BTreeSet<String>,
) -> Review {
    let ids: BTreeSet<_> = reports.values().flatten().cloned().collect();
    let mut scan = Scanner {
        root,
        directory,
        policy,
        review: Review::new(policy.enabled, ids.len()),
        duplicates: BTreeMap::new(),
        budget: ReadBudget::new(policy.read_budget_bytes),
    };
    if !policy.enabled {
        return scan.review;
    }
    let sizes = scan.metadata(&ids, blocked);
    scan.report_sizes(reports, &sizes);
    let mut counts = BTreeMap::<u64, usize>::new();
    for size in sizes.values() {
        *counts.entry(*size).or_default() += 1;
    }
    for (id, size) in sizes {
        scan.file(&id, size, counts[&size] > 1 && size > 0);
    }
    scan.finish_duplicates();
    scan.review.read_budget_used_bytes = scan.budget.used();
    scan.review
}

impl Scanner<'_> {
    fn open(&self, id: &str) -> Result<std::fs::File, String> {
        let path = RelativePath::new(
            std::path::Path::new(self.directory)
                .join("_resources")
                .join(id),
        )
        .map_err(|e| e.to_string())?;
        source::open_resource_file(self.root, &path).map_err(|e| e.to_string())
    }
    fn unavailable(&mut self, id: &str, detail: String) {
        self.review.complete = false;
        self.review.skipped_files += 1;
        self.review
            .note(Level::Warn, "resource-inspection-incomplete", id, detail);
    }
    fn metadata(
        &mut self,
        ids: &BTreeSet<String>,
        blocked: &BTreeSet<String>,
    ) -> BTreeMap<String, u64> {
        let mut sizes = BTreeMap::new();
        for id in ids.iter().take(self.policy.max_files) {
            if blocked.contains(id) {
                self.unavailable(
                    id,
                    "not read: resource failed path or version-control visibility checks".into(),
                );
                continue;
            }
            match self
                .open(id)
                .and_then(|f| f.metadata().map(|m| m.len()).map_err(|e| e.to_string()))
            {
                Ok(size) => {
                    sizes.insert(id.clone(), size);
                }
                Err(error) => self.unavailable(id, error),
            }
        }
        let omitted = ids.len().saturating_sub(self.policy.max_files);
        if omitted > 0 {
            self.review.complete = false;
            self.review.skipped_files += omitted;
            self.review.note(
                Level::Warn,
                "resource-file-budget",
                "_resources",
                format!(
                    "{omitted} resources not inspected: maxFiles={}",
                    self.policy.max_files
                ),
            );
        }
        sizes
    }
    fn report_sizes(&mut self, reports: &ReportResources, sizes: &BTreeMap<String, u64>) {
        for (report, refs) in reports {
            let ids: BTreeSet<_> = refs.iter().collect();
            let bytes = ids
                .iter()
                .filter_map(|id| sizes.get(*id))
                .fold(0u64, |total, size| total.saturating_add(*size));
            self.review.reports.push(ReportObservation {
                report_id: report.clone(),
                resource_count: ids.len(),
                known_bytes: bytes,
                metadata_complete: ids.iter().all(|id| sizes.contains_key(*id)),
            });
            if bytes > self.policy.report_bytes_warn {
                self.review.note(Level::Warn, "resource-report-bytes", report, format!("known resource bytes {bytes} exceed {}; inspect the largest files in resourceReview.files", self.policy.report_bytes_warn));
            }
            if ids.len() > self.policy.report_files_warn {
                self.review.note(
                    Level::Info,
                    "resource-report-count",
                    report,
                    format!(
                        "{} resources exceed {}; review whether the evidence can be consolidated",
                        ids.len(),
                        self.policy.report_files_warn
                    ),
                );
            }
        }
    }
    fn file(&mut self, id: &str, size: u64, repeated_size: bool) {
        if size > self.policy.file_bytes_warn {
            self.review.note(
                Level::Warn,
                "resource-file-bytes",
                id,
                format!(
                    "{size} bytes exceed {}; review excerpting or summarizing",
                    self.policy.file_bytes_warn
                ),
            );
        }
        let duplicate = repeated_size && self.policy.exact_duplicates != Level::Off;
        match self.inspect(id, size, duplicate) {
            Ok(file) => self.review.files.push(file),
            Err(error) => {
                self.unavailable(id, error);
                self.review.files.push(FileObservation {
                    resource_id: id.into(),
                    bytes: size,
                    content_type: "not-inspected".into(),
                    duplicate_check: if duplicate {
                        DuplicateCheck::NotChecked
                    } else if self.policy.exact_duplicates == Level::Off {
                        DuplicateCheck::Disabled
                    } else {
                        DuplicateCheck::NotNeeded
                    },
                    compressibility: None,
                });
            }
        }
    }
    fn inspect(&mut self, id: &str, size: u64, duplicate: bool) -> Result<FileObservation, String> {
        let mut file = self.open(id)?;
        if file.metadata().map_err(|e| e.to_string())?.len() != size {
            return Err("resource size changed before inspection".into());
        }
        let payload = self
            .budget
            .read(&mut file, size, duplicate, self.policy)
            .map_err(|e| e.to_string())?;
        self.observe(id, size, duplicate, payload)
    }

    fn observe(
        &mut self,
        id: &str,
        size: u64,
        duplicate: bool,
        payload: Payload,
    ) -> Result<FileObservation, String> {
        let kind = content::detect(payload.head());
        let level = kind.category.level(self.policy);
        if level != Level::Off {
            self.review.note(
                level,
                "resource-content-type",
                id,
                format!(
                    "detected {}; review its evidence purpose; no execution or unpacking performed",
                    kind.name
                ),
            );
        }
        let compression = if kind.category == content::Category::Text {
            let observed =
                content::compression(&payload, size, self.policy).map_err(|e| e.to_string())?;
            self.compression_note(id, observed.as_ref());
            observed
        } else {
            None
        };
        let duplicate_check = self.duplicate_payload(id, duplicate, payload);
        Ok(FileObservation {
            resource_id: id.into(),
            bytes: size,
            content_type: kind.name,
            duplicate_check,
            compressibility: compression,
        })
    }
    fn compression_note(&mut self, id: &str, observation: Option<&CompressionObservation>) {
        if let Some(c) = observation
            && c.compressed_ratio <= c.threshold
        {
            self.review.note(Level::Warn, "resource-high-compressibility", id, format!("{:?} zstd-1 ratio {:.2}% <= {:.2}% over {} bytes; possible repeated information, not a semantic duplication verdict", c.method, c.compressed_ratio * 100.0, c.threshold * 100.0, c.input_bytes));
        }
    }
    fn duplicate_payload(&mut self, id: &str, duplicate: bool, payload: Payload) -> DuplicateCheck {
        if !duplicate {
            return if self.policy.exact_duplicates == Level::Off {
                DuplicateCheck::Disabled
            } else {
                DuplicateCheck::NotNeeded
            };
        }
        let Payload::Full(bytes) = payload else {
            self.unavailable(
                id,
                "exact duplicate comparison requires complete bytes; sampled content is not proof"
                    .into(),
            );
            return DuplicateCheck::NotChecked;
        };
        let hash = format!("{:x}", Sha256::digest(&bytes));
        let entries = self.duplicates.entry(hash).or_default();
        if let Some(equal) = entries.iter_mut().find(|entry| entry.bytes == bytes) {
            equal.ids.push(id.into());
        } else {
            entries.push(EqualContent {
                bytes,
                ids: vec![id.into()],
            });
        }
        DuplicateCheck::FullByteComparison
    }
    fn finish_duplicates(&mut self) {
        for entries in self.duplicates.values() {
            for equal in entries.iter().filter(|e| e.ids.len() > 1) {
                let redundant =
                    (equal.bytes.len() as u64).saturating_mul((equal.ids.len() - 1) as u64);
                self.review.note(self.policy.exact_duplicates, "resource-exact-duplicates", &equal.ids[0], format!("{} byte-identical files, {redundant} redundant bytes; review sharing without changing historical evidence", equal.ids.len()));
                self.review.duplicate_groups.push(DuplicateGroup {
                    resource_ids: equal.ids.clone(),
                    redundant_bytes: redundant,
                });
            }
        }
    }
}
