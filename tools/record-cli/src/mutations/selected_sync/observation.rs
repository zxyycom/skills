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
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::mutations) enum Observation {
    Present(FileProof),
    Missing(MissingFact),
}
impl Observation {
    pub(in crate::mutations) fn equivalent(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Present(a), Self::Present(b)) => a.equivalent(b),
            (Self::Missing(a), Self::Missing(b)) => a.path == b.path,
            _ => false,
        }
    }
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
            source::capture_missing(root, path).map_err(|e| fail("source-read", e.to_string()))?;
            Ok(Observation::Missing(MissingFact { path: path.clone() }))
        }
    }
}
pub(in crate::mutations) fn observed_expected(
    root: &Root,
    expected: &Observation,
) -> Result<ExpectedFile, TxError> {
    let current = observe(root, expected.path())?;
    if !current.equivalent(expected) {
        return Err(fail(
            "source-changed",
            "selected source changed during preparation",
        ));
    }
    let captured =
        source::capture(root, expected.path()).map_err(|e| fail("source-read", e.to_string()))?;
    match (&captured, expected) {
        (ExpectedFile::Present(actual), Observation::Present(proof))
            if FileProof::from(actual).equivalent(proof) =>
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

pub(in crate::mutations) fn same_observations(a: &[Observation], b: &[Observation]) -> bool {
    a.len() == b.len() && a.iter().zip(b).all(|(a, b)| a.equivalent(b))
}
