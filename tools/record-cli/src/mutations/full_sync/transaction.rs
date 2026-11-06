use crate::{
    mutations::check::FileProof,
    source::{ExpectedFile, RelativePath, Root, capture},
    transaction::{CommitPoint, Guard, TxError, WriteIntent, WriteMode},
};

fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}
fn capture_matching(root: &Root, expected: &FileProof) -> Result<ExpectedFile, TxError> {
    let current = capture(root, &expected.path).map_err(|e| fail("source-read", e.to_string()))?;
    match &current {
        ExpectedFile::Present(actual) if FileProof::from(actual) == *expected => Ok(current),
        _ => Err(fail(
            "source-changed",
            format!("source changed: {}", expected.path.as_path().display()),
        )),
    }
}

pub(in crate::mutations) struct WriteSet {
    pub writes: Vec<WriteIntent>,
    pub guards: Vec<Guard>,
    pub commit_point: CommitPoint,
}
pub(in crate::mutations) struct Input<'a> {
    pub index_path: &'a str,
    pub sources: &'a [FileProof],
    pub index: &'a Option<FileProof>,
    pub target: &'a [u8],
    pub needs_write: bool,
}
impl Input<'_> {
    pub fn prepare(self, root: &Root) -> Result<WriteSet, TxError> {
        let Self {
            index_path,
            sources,
            index,
            target,
            needs_write,
        } = self;
        let index_path =
            RelativePath::new(index_path).map_err(|e| fail("index-path", e.to_string()))?;
        let mut guards = Vec::with_capacity(sources.len() + 1);
        for source in sources {
            guards.push(Guard {
                path: source.path.clone(),
                before: capture_matching(root, source)?,
            });
        }
        let index_before = capture_index(root, &index_path, index)?;
        let mut writes = Vec::new();
        let commit_point = if needs_write {
            let mode = if matches!(index_before, ExpectedFile::Missing) {
                Some(WriteMode::Native(0o666))
            } else {
                None
            };
            writes.push(WriteIntent {
                path: index_path.clone(),
                before: index_before,
                after: Some(target.to_vec()),
                mode,
            });
            CommitPoint::PublishedIndex(index_path)
        } else {
            guards.push(Guard {
                path: index_path,
                before: index_before,
            });
            CommitPoint::NoCommit
        };
        Ok(WriteSet {
            writes,
            guards,
            commit_point,
        })
    }
}

fn capture_index(
    root: &Root,
    index_path: &RelativePath,
    index: &Option<FileProof>,
) -> Result<ExpectedFile, TxError> {
    let index_before = match index {
        Some(proof) => capture_matching(root, proof)?,
        None => {
            let actual =
                capture(root, index_path).map_err(|e| fail("index-read", e.to_string()))?;
            if !matches!(actual, ExpectedFile::Missing) {
                return Err(fail("index-changed", "index appeared during preparation"));
            }
            actual
        }
    };
    Ok(index_before)
}
