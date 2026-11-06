use super::*;

#[derive(Default)]
pub(super) struct ScannedSources {
    pub source_proofs: Vec<FileProof>,
    pub states: BTreeMap<String, domains::investigation::InvestigationState>,
    pub revisions: BTreeMap<String, String>,
    pub all_ids: HashSet<String>,
    pub candidate_count: usize,
    pub available_formal_count: usize,
    pub diagnostics: Vec<CheckError>,
    pub candidate_refs: HashSet<String>,
    pub candidate_owners: BTreeMap<String, Vec<String>>,
    pub warnings: Vec<String>,
}

pub(super) fn scan(
    root: &Root,
    dir: &RelativePath,
    members: Vec<DirectoryMember>,
) -> Result<ScannedSources, CheckError> {
    let mut scan = ScannedSources::default();
    for member in members {
        scan.observe(root, dir, member)?;
    }
    Ok(scan)
}

fn candidate_member(member: &DirectoryMember) -> Result<bool, CheckError> {
    let candidate = member.name.strip_prefix("_candidate.");
    let legal = match candidate {
        Some(locator) => domains::is_kebab(locator),
        None => member
            .name
            .strip_suffix(".md")
            .is_some_and(domains::is_kebab),
    };
    if member.kind != MemberKind::File || !legal {
        return Err(error(
            "member-invalid",
            &member.name,
            "expected a safe Investigation member",
        ));
    }
    Ok(candidate.is_some())
}

impl ScannedSources {
    fn observe(
        &mut self,
        root: &Root,
        dir: &RelativePath,
        member: DirectoryMember,
    ) -> Result<(), CheckError> {
        let candidate = candidate_member(&member)?;
        if !candidate {
            self.available_formal_count += 1;
        }
        let file = super::super::capture_member(root, dir, &member.name, &member)?;
        self.source_proofs.push(FileProof::from(&file));
        let text = match source::strict_text(&file) {
            Ok(text) => text,
            Err(e) => {
                self.diagnostics
                    .push(error("source-encoding", &member.name, e.to_string()));
                return Ok(());
            }
        };
        let Some(id) = self.identity(text, &member.name, candidate) else {
            return Ok(());
        };
        if candidate {
            self.candidate(&id, &member.name, &file.bytes);
            return Ok(());
        }
        self.formal(&id, &member.name, &file.bytes, text);
        Ok(())
    }
    fn formal(&mut self, id: &str, path: &str, bytes: &[u8], text: &str) {
        let parsed = match domains::investigation::parse_established(bytes, id, path) {
            Ok(parsed) => parsed,
            Err(e) => {
                let code = if e.contains("unsupported-unpaired-surrogate") {
                    "unsupported-unpaired-surrogate"
                } else {
                    "source-invalid"
                };
                self.diagnostics.push(error(code, path, e));
                return;
            }
        };
        self.revisions.insert(
            id.to_owned(),
            source_revision::fingerprint(Domain::Investigation, id, path, text),
        );
        self.states.insert(id.to_owned(), parsed.state);
    }
    fn identity(&mut self, text: &str, path: &str, is_candidate: bool) -> Option<String> {
        if !is_candidate
            && matches!(domains::investigation::candidate_header(text), Err(ref message) if message == "unsupported-unpaired-surrogate")
        {
            self.diagnostics.push(error(
                "unsupported-unpaired-surrogate",
                path,
                "unpaired UTF-16 surrogate in Investigation frontmatter",
            ));
            return None;
        }
        let id = self.read_identity(text, path, is_candidate)?;
        let Some(id) = id else {
            if is_candidate {
                self.warnings
                    .push(format!("candidate {} has invalid identity", path));
                return None;
            }
            self.diagnostics.push(error(
                "source-invalid",
                path,
                "missing valid Investigation ID",
            ));
            return None;
        };
        if !self.all_ids.insert(id.clone()) {
            self.diagnostics.push(error("duplicate-id", path, id));
            return None;
        }
        Some(id)
    }

    fn read_identity(
        &mut self,
        text: &str,
        path: &str,
        is_candidate: bool,
    ) -> Option<Option<String>> {
        if is_candidate {
            match domains::investigation::candidate_header(text) {
                Ok(id) => Some(id),
                Err(message) => {
                    let code = if message == "unsupported-unpaired-surrogate" {
                        "unsupported-unpaired-surrogate"
                    } else {
                        "candidate-invalid"
                    };
                    self.diagnostics.push(error(code, path, message));
                    None
                }
            }
        } else {
            Some(domains::investigation::id_from_markdown(text))
        }
    }

    fn candidate(&mut self, id: &str, path: &str, bytes: &[u8]) {
        self.candidate_count += 1;
        match domains::investigation::parse_candidate(bytes, id, path) {
            Ok(candidate) => {
                self.candidate_refs
                    .extend(candidate.resource_ids.iter().cloned());
                self.candidate_owners
                    .insert(id.to_owned(), candidate.resource_ids);
                if !candidate.readiness.scaffold_valid || !candidate.readiness.body_ready {
                    self.warnings.push(format!("candidate {id} is not ready"));
                }
            }
            Err(message) => self.warnings.push(format!("candidate {id}: {message}")),
        }
    }
}
