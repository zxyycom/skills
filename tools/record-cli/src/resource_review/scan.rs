use super::{
    CompressionObservation, DuplicateCheck, DuplicateGroup, FileObservation, ReportObservation,
    ReportResources, Review, content,
    payload::{Payload, ReadBudget, Request},
    policy::{Level, Policy},
};
use crate::source::{self, RelativePath, Root};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

struct EqualContent {
    bytes: Vec<u8>,
    ids: Vec<String>,
}
struct Head {
    bytes: Vec<u8>,
    kind: content::Detected,
}
struct Resource {
    size: u64,
    head: Option<Head>,
}
impl Resource {
    fn observation(&self, id: &str, duplicate: bool, level: Level) -> FileObservation {
        FileObservation {
            resource_id: id.into(),
            bytes: self.size,
            content_type: self
                .head
                .as_ref()
                .map_or_else(|| "not-inspected".into(), |h| h.kind.name.clone()),
            duplicate_check: if duplicate {
                DuplicateCheck::NotChecked
            } else if level == Level::Off {
                DuplicateCheck::Disabled
            } else {
                DuplicateCheck::NotNeeded
            },
            compressibility: None,
        }
    }
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
    let resources = scan.probe(&ids, blocked);
    scan.report_sizes(reports, &resources);
    let mut counts = BTreeMap::<u64, usize>::new();
    for resource in resources.values() {
        *counts.entry(resource.size).or_default() += 1;
    }
    for (id, resource) in resources {
        let duplicate = counts[&resource.size] > 1
            && resource.size > 0
            && policy.exact_duplicates != Level::Off;
        scan.file(&id, resource, duplicate);
    }
    scan.finish_duplicates();
    scan.review.finish_findings();
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
    fn probe(
        &mut self,
        ids: &BTreeSet<String>,
        blocked: &BTreeSet<String>,
    ) -> BTreeMap<String, Resource> {
        let mut resources = BTreeMap::new();
        for id in ids.iter().take(self.policy.max_files) {
            if blocked.contains(id) {
                self.unavailable(
                    id,
                    "not read: resource failed path or version-control visibility checks".into(),
                );
                continue;
            }
            match self.probe_file(id) {
                Ok(resource) => {
                    resources.insert(id.clone(), resource);
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
        resources
    }
    fn probe_file(&mut self, id: &str) -> Result<Resource, String> {
        let mut file = self.open(id)?;
        let size = file.metadata().map_err(|e| e.to_string())?.len();
        let head = match self.budget.head(&mut file, size) {
            Ok(bytes) => {
                let kind = content::detect(&bytes);
                self.review.note(kind.category.level(self.policy), "resource-content-type", id,
                    format!("detected {}; review its evidence purpose; no execution or unpacking performed", kind.name));
                Some(Head { bytes, kind })
            }
            Err(error) => {
                self.unavailable(id, error.to_string());
                None
            }
        };
        Ok(Resource { size, head })
    }
    fn report_sizes(&mut self, reports: &ReportResources, resources: &BTreeMap<String, Resource>) {
        for (report, refs) in reports {
            let ids: BTreeSet<_> = refs.iter().collect();
            let bytes = ids
                .iter()
                .filter_map(|id| resources.get(*id))
                .fold(0u64, |total, resource| total.saturating_add(resource.size));
            self.review.reports.push(ReportObservation {
                report_id: report.clone(),
                resource_count: ids.len(),
                known_bytes: bytes,
                metadata_complete: ids.iter().all(|id| resources.contains_key(*id)),
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
    fn file(&mut self, id: &str, resource: Resource, duplicate: bool) {
        if resource.size > self.policy.file_bytes_warn {
            self.review.note(
                Level::Warn,
                "resource-file-bytes",
                id,
                format!(
                    "{} bytes exceed {}; review excerpting or summarizing",
                    resource.size, self.policy.file_bytes_warn
                ),
            );
        }
        let mut observation = resource.observation(id, duplicate, self.policy.exact_duplicates);
        if let Some(head) = resource.head
            && let Err(error) = self.inspect(id, head, duplicate, &mut observation)
        {
            self.unavailable(id, error);
        }
        self.review.files.push(observation);
    }
    fn inspect(
        &mut self,
        id: &str,
        head: Head,
        duplicate: bool,
        observation: &mut FileObservation,
    ) -> Result<(), String> {
        let policy = self.policy;
        let c = &policy.compressibility;
        let compression = (head.kind.category == content::Category::Text
            && c.band(observation.bytes).is_some())
        .then_some(c);
        let request = Request {
            size: observation.bytes,
            duplicate,
            compression,
        };
        let payload = self.payload(id, head.bytes, request)?;
        if compression.is_some() {
            let observed = content::compression(&payload, observation.bytes, policy)
                .map_err(|e| e.to_string())?;
            self.compression_note(id, observed.as_ref());
            observation.compressibility = observed;
        }
        observation.duplicate_check = self.duplicate_payload(id, duplicate, payload);
        Ok(())
    }
    fn payload(
        &mut self,
        id: &str,
        head: Vec<u8>,
        request: Request<'_>,
    ) -> Result<Payload, String> {
        let size = request.size;
        let plan = self.budget.plan(request, head.len() as u64);
        if plan.additional_bytes(head.len() as u64) == 0 {
            return Ok(Payload::from_head(head, size));
        }
        let mut file = self.open(id)?;
        self.budget
            .read(&mut file, head, plan)
            .map_err(|e| e.to_string())
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
