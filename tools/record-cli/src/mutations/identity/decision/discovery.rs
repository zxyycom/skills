use super::*;

pub(super) struct Discovery {
    pub(super) listing: source::DirectorySnapshot,
    pub(super) archive: Option<source::DirectorySnapshot>,
    pub(super) headers: Vec<source::HeaderSnapshot>,
    pub(super) locators: BTreeMap<String, (String, bool)>,
    pub(super) occupied: HashSet<String>,
}

impl super::super::IdentityDiscovery for Discovery {
    fn locators(&self) -> &BTreeMap<String, (String, bool)> {
        &self.locators
    }
}

struct Scanner<'a> {
    operation: &'a DecisionIdentityOperation,
    root: &'a Root,
    baseline: &'a crate::index::ValidatedIndex<decision::DecisionState>,
    missing_index: bool,
    headers: Vec<source::HeaderSnapshot>,
    locators: BTreeMap<String, (String, bool)>,
    occupied: HashSet<String>,
}

impl Scanner<'_> {
    fn observe(&mut self, prefix: &str, member: &source::DirectoryMember) -> Result<(), TxError> {
        let path = format!("{prefix}{}", member.name);
        self.occupied.insert(path.clone());
        if !member.name.ends_with(".md")
            || self
                .baseline
                .index()
                .entries
                .values()
                .any(|s| s.source_path == path)
        {
            return Ok(());
        }
        if member.kind != source::MemberKind::File {
            return Err(fail("collection", format!("unsafe source {path}")));
        }
        self.capture_candidate(&path)
    }

    fn capture_candidate(&mut self, path: &str) -> Result<(), TxError> {
        let header =
            source::capture_header(self.root, &relative(&self.operation.collection, path)?)
                .map_err(|e| fail("header", e))?
                .ok_or_else(|| fail("header", "source disappeared"))?;
        let text = std::str::from_utf8(&header.bytes).map_err(|e| fail("header", e))?;
        let (id, candidate) =
            decision::candidate_header(text, path).map_err(|e| fail("header", e))?;
        if self.missing_index && !candidate {
            return Err(fail(
                "index-missing",
                "published Decision source exists without an index",
            ));
        }
        self.insert_candidate(path, id, candidate)?;
        self.headers.push(header);
        Ok(())
    }
    fn insert_candidate(
        &mut self,
        path: &str,
        id: Option<String>,
        candidate: bool,
    ) -> Result<(), TxError> {
        if candidate
            && let Some(id) = id
            && self
                .locators
                .insert(id.clone(), (path.into(), true))
                .is_some()
        {
            return Err(fail("duplicate-id", id));
        }
        Ok(())
    }
}

impl DecisionIdentityOperation {
    pub(super) fn discover(
        &self,
        root: &Root,
        baseline: &crate::index::ValidatedIndex<decision::DecisionState>,
        missing_index: bool,
    ) -> Result<Discovery, TxError> {
        let listing = source::enumerate_directory(root, &self.collection)
            .map_err(|e| fail("collection", e))?;
        let archive_path = relative(&self.collection, "archive")?;
        let archive = if listing.members.iter().any(|m| m.name == "archive") {
            Some(source::enumerate_directory(root, &archive_path).map_err(|e| fail("archive", e))?)
        } else {
            None
        };
        let mut scanner = Scanner {
            operation: self,
            root,
            baseline,
            missing_index,
            headers: Vec::new(),
            occupied: HashSet::new(),
            locators: baseline
                .index()
                .entries
                .iter()
                .map(|(id, s)| (id.clone(), (s.source_path.clone(), false)))
                .collect(),
        };
        for (prefix, members) in [("", Some(&listing)), ("archive/", archive.as_ref())] {
            if let Some(members) = members {
                for member in &members.members {
                    scanner.observe(prefix, member)?;
                }
            }
        }
        Ok(Discovery {
            listing,
            archive,
            headers: scanner.headers,
            locators: scanner.locators,
            occupied: scanner.occupied,
        })
    }
}
