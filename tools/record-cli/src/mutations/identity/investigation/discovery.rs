use super::*;

pub(super) struct Discovery {
    pub(super) listing: source::DirectorySnapshot,
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
    operation: &'a InvestigationIdentityOperation,
    root: &'a Root,
    missing: bool,
    headers: Vec<source::HeaderSnapshot>,
    locators: BTreeMap<String, (String, bool)>,
    occupied: HashSet<String>,
}

impl Scanner<'_> {
    fn observe(&mut self, member: &source::DirectoryMember) -> Result<(), TxError> {
        let path = &member.name;
        self.occupied.insert(path.clone());
        let candidate = path
            .strip_prefix("_candidate.")
            .is_some_and(domains::is_kebab);
        let formal = path.strip_suffix(".md").is_some_and(domains::is_kebab);
        if !candidate && !formal {
            return Ok(());
        }
        if member.kind != source::MemberKind::File {
            return Err(fail("collection", format!("unsafe source {path}")));
        }
        if formal && self.missing {
            return Err(fail(
                "index-missing",
                "formal source exists without published index",
            ));
        }
        if candidate {
            self.capture_candidate(path)?;
        }
        Ok(())
    }

    fn capture_candidate(&mut self, path: &str) -> Result<(), TxError> {
        let header = source::capture_header(self.root, &rel(&self.operation.collection, path)?)
            .map_err(|e| fail("header", e))?
            .ok_or_else(|| fail("header", "candidate disappeared"))?;
        let text = std::str::from_utf8(&header.bytes).map_err(|e| fail("header", e))?;
        if let Some(id) = investigation::candidate_header(text).map_err(|e| fail("header", e))?
            && self
                .locators
                .insert(id.clone(), (path.into(), true))
                .is_some()
        {
            return Err(fail("duplicate-id", id));
        }
        self.headers.push(header);
        Ok(())
    }
}

impl InvestigationIdentityOperation {
    pub(super) fn discover(
        &self,
        root: &Root,
        baseline: &crate::index::ValidatedIndex<investigation::InvestigationState>,
        missing: bool,
    ) -> Result<Discovery, TxError> {
        let listing = source::enumerate_directory(root, &self.collection)
            .map_err(|e| fail("collection", e))?;
        let mut scanner = Scanner {
            operation: self,
            root,
            missing,
            locators: baseline
                .index()
                .entries
                .iter()
                .map(|(id, s)| (id.clone(), (s.source_path.clone(), false)))
                .collect(),
            occupied: HashSet::new(),
            headers: Vec::new(),
        };
        for member in &listing.members {
            scanner.observe(member)?;
        }
        Ok(Discovery {
            listing,
            headers: scanner.headers,
            locators: scanner.locators,
            occupied: scanner.occupied,
        })
    }
}
