use super::*;

pub(super) struct CollectionMembers {
    pub(super) directories: Vec<DirectoryProof>,
    pub(super) members: Vec<SourceMember>,
    pub(super) index_identity: Option<source::FileIdentity>,
}

pub(super) fn collect_members(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
) -> Result<CollectionMembers, CheckError> {
    let listing = source::enumerate_directory(root, dir)
        .map_err(|e| error("collection-read", directory, e.to_string()))?;
    let mut directories = vec![DirectoryProof::from_listing(
        &listing,
        Some("decision-index.json"),
    )];
    let mut members = Vec::new();
    let mut index_identity = None;
    for member in listing.members.iter().cloned() {
        if member.name == "decision-index.json" {
            if member.kind != MemberKind::File {
                return Err(error(
                    "index-invalid",
                    &member.name,
                    "index is not a regular file",
                ));
            }
            index_identity = Some(member.identity);
            continue;
        }
        if member.name == "archive" {
            let (proof, archive_members) = collect_archive(root, dir, directory, &member)?;
            directories.push(proof);
            members.extend(archive_members);
        } else {
            members.push(SourceMember {
                path: member.name.clone(),
                member,
            });
        }
    }
    Ok(CollectionMembers {
        directories,
        members,
        index_identity,
    })
}

fn collect_archive(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
    member: &DirectoryMember,
) -> Result<(DirectoryProof, Vec<SourceMember>), CheckError> {
    if member.kind != MemberKind::Directory {
        return Err(error(
            "member-invalid",
            &member.name,
            "archive must be a regular directory",
        ));
    }
    let archive = RelativePath::new(dir.as_path().join("archive"))
        .map_err(|e| error("path-invalid", directory, e.to_string()))?;
    let contents = source::enumerate_directory(root, &archive)
        .map_err(|e| error("collection-read", "archive", e.to_string()))?;
    if contents.identity.device != member.identity.device
        || contents.identity.inode != member.identity.inode
        || contents.identity.mode != member.identity.mode
    {
        return Err(error(
            "source-changed",
            "archive",
            "directory identity changed",
        ));
    }
    let proof = DirectoryProof::from_listing(&contents, None);
    let members = contents
        .members
        .iter()
        .cloned()
        .map(|file| SourceMember {
            path: format!("archive/{}", file.name),
            member: file,
        })
        .collect();
    Ok((proof, members))
}

pub(super) struct ScannedDecisions {
    pub(super) source_proofs: Vec<FileProof>,
    pub(super) states: BTreeMap<String, DecisionState>,
    pub(super) revisions: BTreeMap<String, String>,
    pub(super) candidate_count: usize,
    pub(super) activation_paths: Vec<(String, String)>,
    pub(super) warnings: Vec<String>,
    pub(super) summary: DecisionSummary,
    pub(super) checked_ids: Vec<String>,
}

#[derive(Default)]
struct SourceScan {
    source_proofs: Vec<FileProof>,
    states: BTreeMap<String, DecisionState>,
    revisions: BTreeMap<String, String>,
    all_ids: HashSet<String>,
    candidate_count: usize,
    body_ready_candidates: usize,
    activation_paths: Vec<(String, String)>,
    scaffold_candidates: usize,
    summary_states: Vec<(String, Option<String>)>,
    warnings: Vec<String>,
    diagnostics: Vec<CheckError>,
}

fn capture_member(
    root: &Root,
    dir: &RelativePath,
    entry: &SourceMember,
) -> Result<source::SourceSnapshot, CheckError> {
    let basename = entry.path.strip_prefix("archive/").unwrap_or(&entry.path);
    if entry.member.kind != MemberKind::File
        || !basename.strip_suffix(".md").is_some_and(domains::is_kebab)
    {
        return Err(error(
            "member-invalid",
            &entry.path,
            "expected a safe Decision Markdown member",
        ));
    }
    super::super::capture_member(root, dir, &entry.path, &entry.member)
}

impl SourceScan {
    fn observe(
        &mut self,
        root: &Root,
        dir: &RelativePath,
        entry: SourceMember,
    ) -> Result<(), CheckError> {
        let file = capture_member(root, dir, &entry)?;
        self.source_proofs.push(FileProof::from(&file));
        let text = match source::strict_text(&file) {
            Ok(text) => text,
            Err(e) => {
                self.diagnostics
                    .push(error("source-encoding", &entry.path, e.to_string()));
                return Ok(());
            }
        };
        let (id, candidate) = match domains::decision::candidate_header(text, &entry.path) {
            Ok(value) => value,
            Err(e) => {
                self.diagnostics
                    .push(error("source-invalid", &entry.path, e));
                return Ok(());
            }
        };
        let Some(id) = id else {
            self.diagnostics.push(error(
                "source-invalid",
                &entry.path,
                "missing valid Decision ID",
            ));
            return Ok(());
        };
        if !self.all_ids.insert(id.clone()) {
            self.diagnostics
                .push(error("duplicate-id", &entry.path, id));
            return Ok(());
        }
        if candidate {
            self.candidate(&id, &entry.path, &file.bytes);
            return Ok(());
        }
        self.established(&id, &entry.path, &file.bytes, text);
        Ok(())
    }
    fn established(&mut self, id: &str, path: &str, bytes: &[u8], text: &str) {
        if let Ok(front) = domains::decision::parse_frontmatter(bytes, id) {
            self.summary_states.push((front.status, front.alignment));
        }
        let parsed = match domains::decision::parse_established(bytes, id, path) {
            Ok(parsed) => parsed,
            Err(e) => {
                self.diagnostics.push(error("source-invalid", path, e));
                return;
            }
        };
        self.revisions.insert(
            id.to_owned(),
            source_revision::fingerprint(Domain::Decision, id, path, text),
        );
        self.states.insert(id.to_owned(), parsed.state);
    }
    fn candidate(&mut self, id: &str, path: &str, bytes: &[u8]) {
        self.candidate_count += 1;
        let candidate = match domains::decision::parse_candidate(bytes, id) {
            Ok(candidate) => candidate,
            Err(e) => {
                self.diagnostics.push(error("candidate-invalid", path, e));
                return;
            }
        };
        if !candidate.readiness.scaffold_valid {
            self.diagnostics.push(error(
                "candidate-invalid",
                path,
                candidate.diagnostics.join("; "),
            ));
            return;
        }
        self.scaffold_candidates += 1;
        if candidate.readiness.body_ready {
            self.body_ready_candidates += 1;
            self.activation_paths.push((id.to_owned(), path.to_owned()));
        }
        if !candidate.readiness.body_ready {
            self.warnings
                .push(format!("candidate {id} body is not ready"));
        }
    }
}

pub(super) fn scan_sources(
    root: &Root,
    dir: &RelativePath,
    members: Vec<SourceMember>,
) -> Result<ScannedDecisions, CheckError> {
    let mut scan = SourceScan::default();
    for entry in members {
        scan.observe(root, dir, entry)?;
    }
    let SourceScan {
        source_proofs,
        states,
        revisions,
        all_ids,
        candidate_count,
        body_ready_candidates,
        activation_paths,
        scaffold_candidates,
        summary_states,
        warnings,
        diagnostics,
    } = scan;
    let formal_count = states.len();
    let summary = summarize(&summary_states, scaffold_candidates, body_ready_candidates);
    let mut checked_ids: Vec<_> = all_ids.into_iter().collect();
    checked_ids.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    if !diagnostics.is_empty() {
        let errors = diagnostics
            .iter()
            .map(|e| format!("{}: {}", e.path, e.message))
            .collect();
        let partial = CheckResult {
            scope: "partial",
            checked_ids,
            formal_count,
            candidate_count,
            index_state: "not-checked",
            warnings,
            index_path: dir
                .as_path()
                .join("decision-index.json")
                .to_string_lossy()
                .replace('\\', "/"),
            errors,
            summary: Some(summary),
            available_report_count: None,
            selected_report_count: None,
            index_checked: Some(false),
        };
        return Err(aggregate(diagnostics, partial));
    }
    Ok(ScannedDecisions {
        source_proofs,
        states,
        revisions,
        candidate_count,
        activation_paths,
        warnings,
        summary,
        checked_ids,
    })
}

fn summarize(
    summary_states: &[(String, Option<String>)],
    scaffold_candidates: usize,
    body_ready_candidates: usize,
) -> DecisionSummary {
    DecisionSummary {
        active_count: summary_states
            .iter()
            .filter(|(status, _)| status == "active")
            .count(),
        aligned_count: summary_states
            .iter()
            .filter(|(status, alignment)| {
                status == "active" && alignment.as_deref() == Some("aligned")
            })
            .count(),
        archived_count: summary_states
            .iter()
            .filter(|(status, _)| status == "archived")
            .count(),
        decision_count: summary_states.len(),
        scaffold_candidate_count: scaffold_candidates,
        activation_candidate_count: body_ready_candidates,
        body_ready_candidate_count: body_ready_candidates,
        unaligned_count: summary_states
            .iter()
            .filter(|(status, alignment)| {
                status == "active" && alignment.as_deref() == Some("unaligned")
            })
            .count(),
    }
}
