use super::*;

pub(super) struct ProjectionInput<'a, D: crate::index::DomainDefinition> {
    pub(super) definition: &'a D,
    pub(super) domain: Domain,
    pub(super) states: BTreeMap<String, D::State>,
    pub(super) revisions: BTreeMap<String, String>,
    pub(super) directory: &'a str,
    pub(super) partial: &'a CheckResult,
}
impl<D: crate::index::DomainDefinition> ProjectionInput<'_, D>
where
    D::State: Clone,
{
    pub(super) fn validate(self) -> Result<crate::index::ValidatedIndex<D::State>, CheckError> {
        let Self {
            definition,
            domain,
            states,
            revisions,
            directory,
            partial,
        } = self;
        let projection = IndexV4 {
            schema_version: 4,
            namespace: definition.namespace().into(),
            definition_version: definition.definition_version(),
            metadata: serde_json::json!({}),
            source_revision: Revision {
                metadata: source_revision::metadata_fingerprint(domain),
                entries: revisions,
            },
            entries: states,
        };
        let expected = crate::index::build_index(projection, definition).map_err(|e| {
            attach_partial(
                error("collection-invalid", directory, e.to_string()),
                partial.clone(),
            )
        })?;
        crate::index::QuerySnapshot::new(expected.clone())
            .graph(definition)
            .map_err(|e| {
                attach_partial(
                    error("graph-invalid", directory, e.to_string()),
                    partial.clone(),
                )
            })?;
        Ok(expected)
    }
}

pub(super) struct IndexObservation<'a> {
    pub(super) root: &'a Root,
    pub(super) dir: &'a RelativePath,
    pub(super) directory: &'a str,
    pub(super) identity: &'a Option<source::FileIdentity>,
    pub(super) index_name: &'a str,
}
impl IndexObservation<'_> {
    pub(super) fn capture(
        &self,
        partial: &CheckResult,
    ) -> Result<(RelativePath, ExpectedFile), CheckError> {
        let Self {
            root,
            dir,
            directory,
            identity: index_identity,
            index_name,
        } = *self;
        let index_path = RelativePath::new(dir.as_path().join(index_name))
            .map_err(|e| error("path-invalid", directory, e.to_string()))?;
        let existing = source::capture(root, &index_path).map_err(|e| {
            attach_partial(
                error("index-read", directory, e.to_string()),
                partial.clone(),
            )
        })?;
        match (index_identity, &existing) {
            (None, ExpectedFile::Missing) => {}
            (Some(expected), ExpectedFile::Present(actual))
                if expected.mode == actual.identity.mode => {}
            _ => {
                return Err(attach_partial(
                    error(
                        "source-changed",
                        index_name,
                        "index mode or membership changed during collection",
                    ),
                    partial.clone(),
                ));
            }
        }
        Ok((index_path, existing))
    }
}

pub(super) struct IndexPolicy {
    pub(super) index_name: &'static str,
    pub(super) empty_message: &'static str,
    pub(super) missing_message: &'static str,
    pub(super) allow_first_candidate: bool,
}

pub(super) struct IndexComparison<'a, D: crate::index::DomainDefinition> {
    pub(super) definition: &'a D,
    pub(super) policy: IndexPolicy,
    pub(super) expected: &'a crate::index::ValidatedIndex<D::State>,
    pub(super) existing: &'a ExpectedFile,
    pub(super) formal_count: usize,
    pub(super) partial: &'a CheckResult,
}
impl<D: crate::index::DomainDefinition> IndexComparison<'_, D> {
    pub(super) fn decide(&self, rebuild: bool) -> Result<(&'static str, bool), CheckError> {
        if rebuild { self.sync() } else { self.check() }
    }

    fn finish(
        self,
        index_path: RelativePath,
        target: Vec<u8>,
        rebuild: bool,
    ) -> Result<IndexCheck, CheckError> {
        let (index_state, needs_write) = self.decide(rebuild)?;
        let index_proof = match self.existing {
            ExpectedFile::Missing => None,
            ExpectedFile::Present(file) => Some(FileProof::from(file)),
        };
        Ok(IndexCheck {
            index_path,
            index_proof,
            target,
            index_state,
            needs_write,
        })
    }

    fn sync(&self) -> Result<(&'static str, bool), CheckError> {
        let name = self.policy.index_name;
        if self.formal_count == 0 && matches!(self.existing, ExpectedFile::Missing) {
            return Err(attach_partial(
                error("empty-collection", name, self.policy.empty_message),
                self.partial.clone(),
            ));
        }
        let current = match self.existing {
            ExpectedFile::Missing => None,
            ExpectedFile::Present(file) => Some(file.bytes.as_slice()),
        };
        let disposition = crate::mutations::full_sync::compare(
            self.expected,
            self.definition,
            current,
            crate::mutations::full_sync::Mode::Write,
        )
        .map_err(|e| {
            attach_partial(
                error("index-invalid", name, format!("{e:?}")),
                self.partial.clone(),
            )
        })?;
        match disposition {
            crate::mutations::full_sync::Disposition::Unchanged => Ok(("unchanged", false)),
            crate::mutations::full_sync::Disposition::NeedsWrite(_) => Ok(("previewed", true)),
            _ => Err(attach_partial(
                error("index-invalid", name, "unexpected sync state"),
                self.partial.clone(),
            )),
        }
    }

    fn check(&self) -> Result<(&'static str, bool), CheckError> {
        let name = self.policy.index_name;
        let state = match self.existing {
            ExpectedFile::Missing
                if self.formal_count == 0 && self.policy.allow_first_candidate =>
            {
                "first-candidate-collection"
            }
            ExpectedFile::Missing if self.formal_count == 0 => {
                return Err(attach_partial(
                    error("empty-collection", name, self.policy.empty_message),
                    self.partial.clone(),
                ));
            }
            ExpectedFile::Missing => {
                return Err(attach_partial(
                    error("index-missing", name, self.policy.missing_message),
                    self.partial.clone(),
                ));
            }
            ExpectedFile::Present(file) => {
                crate::mutations::full_sync::compare(
                    self.expected,
                    self.definition,
                    Some(&file.bytes),
                    crate::mutations::full_sync::Mode::Check,
                )
                .map_err(|e| {
                    attach_partial(
                        error("index-not-current", name, format!("{e:?}")),
                        self.partial.clone(),
                    )
                })?;
                "current"
            }
        };
        Ok((state, false))
    }
}

pub(super) struct IndexInput<'a, D: crate::index::DomainDefinition> {
    pub(super) definition: &'a D,
    pub(super) domain: Domain,
    pub(super) policy: IndexPolicy,
    pub(super) root: &'a Root,
    pub(super) dir: &'a RelativePath,
    pub(super) directory: &'a str,
    pub(super) index_identity: Option<source::FileIdentity>,
    pub(super) states: BTreeMap<String, D::State>,
    pub(super) revisions: BTreeMap<String, String>,
    pub(super) formal_count: usize,
    pub(super) partial: CheckResult,
    pub(super) rebuild: bool,
}
pub(super) struct IndexCheck {
    pub(super) index_path: RelativePath,
    pub(super) index_proof: Option<FileProof>,
    pub(super) target: Vec<u8>,
    pub(super) index_state: &'static str,
    pub(super) needs_write: bool,
}

impl<D: crate::index::DomainDefinition> IndexInput<'_, D>
where
    D::State: Clone,
{
    pub fn verify(self) -> Result<IndexCheck, CheckError> {
        let Self {
            definition,
            domain,
            policy,
            root,
            dir,
            directory,
            index_identity,
            states,
            revisions,
            formal_count,
            partial,
            rebuild,
        } = self;
        let expected = ProjectionInput {
            definition,
            domain,
            states,
            revisions,
            directory,
            partial: &partial,
        }
        .validate()?;
        let (index_path, existing) = IndexObservation {
            root,
            dir,
            directory,
            identity: &index_identity,
            index_name: policy.index_name,
        }
        .capture(&partial)?;
        let target = crate::index::serialize_index(&expected, definition).map_err(|e| {
            attach_partial(
                error("index-serialize", directory, e.to_string()),
                partial.clone(),
            )
        })?;
        IndexComparison {
            expected: &expected,
            definition,
            policy,
            existing: &existing,
            formal_count,
            partial: &partial,
        }
        .finish(index_path, target, rebuild)
    }
}
