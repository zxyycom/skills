use crate::{
    mutations::check::FileProof,
    source::{self, ExpectedFile, RelativePath, Root},
    transaction::TxError,
};

fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::mutations) struct MissingFact {
    path: RelativePath,
    parents: Vec<source::FileIdentity>,
    parent_paths: Vec<RelativePath>,
    remaining: usize,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::mutations) enum Observation {
    Present(FileProof),
    Missing(MissingFact),
}
impl Observation {
    pub(in crate::mutations) fn path(&self) -> &RelativePath {
        match self {
            Self::Present(file) => &file.path,
            Self::Missing(missing) => &missing.path,
        }
    }
}
pub(in crate::mutations) fn observe(
    root: &Root,
    path: &RelativePath,
) -> Result<Observation, TxError> {
    match source::capture(root, path).map_err(|e| fail("source-read", e.to_string()))? {
        ExpectedFile::Present(file) => Ok(Observation::Present(FileProof::from(&file))),
        ExpectedFile::Missing => {
            let missing = source::capture_missing(root, path)
                .map_err(|e| fail("source-read", e.to_string()))?;
            Ok(Observation::Missing(MissingFact {
                path: path.clone(),
                parents: missing.parents().to_vec(),
                parent_paths: missing.parent_paths().to_vec(),
                remaining: missing.remaining_components(),
            }))
        }
    }
}
pub(in crate::mutations) fn observed_expected(
    root: &Root,
    expected: &Observation,
) -> Result<ExpectedFile, TxError> {
    let current = observe(root, expected.path())?;
    if &current != expected {
        return Err(fail(
            "source-changed",
            "selected source changed during preparation",
        ));
    }
    let captured =
        source::capture(root, expected.path()).map_err(|e| fail("source-read", e.to_string()))?;
    match (&captured, expected) {
        (ExpectedFile::Present(actual), Observation::Present(proof))
            if FileProof::from(actual) == *proof =>
        {
            Ok(captured)
        }
        (ExpectedFile::Missing, Observation::Missing(_)) => Ok(captured),
        _ => Err(fail(
            "source-changed",
            "selected source changed during capture",
        )),
    }
}
