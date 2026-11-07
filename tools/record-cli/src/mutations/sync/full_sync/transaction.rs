use crate::{
    source::{ExpectedFile, RelativePath, Root},
    transaction::{CommitPoint, TxError, WriteIntent},
};

pub(in crate::mutations) struct WriteSet {
    pub writes: Vec<WriteIntent>,
    pub commit_point: CommitPoint,
}
pub(in crate::mutations) struct Input<'a> {
    pub index_path: &'a str,
    pub index_before: ExpectedFile,
    pub target: &'a [u8],
    pub needs_write: bool,
}
impl Input<'_> {
    pub fn prepare(self, _root: &Root) -> Result<WriteSet, TxError> {
        let path = RelativePath::new(self.index_path)
            .map_err(|e| TxError::new("index-path", e.to_string()))?;
        if !self.needs_write {
            return Ok(WriteSet {
                writes: vec![],
                commit_point: CommitPoint::NoCommit,
            });
        }
        Ok(WriteSet {
            writes: vec![WriteIntent {
                path: path.clone(),
                before: self.index_before,
                after: Some(self.target.to_vec()),
            }],
            commit_point: CommitPoint::PublishedIndex(path),
        })
    }
}
