//! Ordered execution of domain plans. Partial effects are reported, not rolled back.
use crate::{
    protocol::Diagnostic,
    source::{ExpectedFile, RelativePath, Root},
};
use std::io;

mod filesystem;
mod validation;
use filesystem::{apply_resource, apply_write, resource_effects};
use validation::validate;

#[derive(Debug)]
pub struct WriteIntent {
    pub path: RelativePath,
    pub before: ExpectedFile,
    pub after: Option<Vec<u8>>,
}
#[derive(Debug)]
pub enum CommitPoint {
    NoCommit,
    Created(RelativePath),
    Updated(RelativePath),
    Exited(RelativePath),
    Renamed {
        old: RelativePath,
        new: RelativePath,
    },
    PublishedIndex(RelativePath),
}
#[derive(Debug)]
pub enum ResourceIntent {
    CreateDirectory {
        path: RelativePath,
    },
    MoveDirectory {
        source: RelativePath,
        destination: RelativePath,
    },
    RemoveFile {
        path: RelativePath,
    },
    RemoveDirectory {
        path: RelativePath,
    },
}
#[derive(Debug)]
pub struct Plan<T> {
    pub value: T,
    pub writes: Vec<WriteIntent>,
    pub resources: Vec<ResourceIntent>,
    pub commit_point: CommitPoint,
}
#[derive(Debug)]
pub struct TransactionOutcome<T> {
    pub status: TxStatus,
    pub value: Option<T>,
    pub planned_value: Option<T>,
    pub changed: bool,
    pub committed: bool,
    pub written_paths: Vec<RelativePath>,
    pub unknown_paths: Vec<RelativePath>,
    pub errors: Vec<Diagnostic>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TxStatus {
    Ok,
    Error,
}
#[derive(Debug)]
pub struct TxError {
    pub code: String,
    pub message: String,
    pub diagnostics: Vec<Diagnostic>,
}
impl TxError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            diagnostics: Vec::new(),
        }
    }
    pub fn with_diagnostics(mut self, diagnostics: Vec<Diagnostic>) -> Self {
        self.diagnostics = diagnostics;
        self
    }
}
impl std::fmt::Display for TxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for TxError {}
pub trait TransactionOperation<T> {
    fn prepare(&mut self, root: &Root) -> Result<Plan<T>, TxError>;
}
pub fn preflight<T, O: TransactionOperation<T>>(
    root: &Root,
    operation: &mut O,
) -> Result<Plan<T>, TxError> {
    operation.prepare(root)
}

pub fn run_transaction<T, O: TransactionOperation<T>>(
    root: &Root,
    operation: &mut O,
) -> TransactionOutcome<T> {
    let mut result = TransactionOutcome {
        status: TxStatus::Error,
        value: None,
        planned_value: None,
        changed: false,
        committed: false,
        written_paths: Vec::new(),
        unknown_paths: Vec::new(),
        errors: Vec::new(),
    };
    let plan = match operation.prepare(root) {
        Ok(plan) => plan,
        Err(error) => {
            append_error(&mut result.errors, error);
            return result;
        }
    };
    if let Err(error) = validate(&plan) {
        append_error(&mut result.errors, error);
        result.planned_value = Some(plan.value);
        return result;
    }
    if let Some(error) = apply_plan(root, &plan, &mut result) {
        result.errors.push(error);
        result.planned_value = Some(plan.value);
        return result;
    }
    result.status = TxStatus::Ok;
    result.value = Some(plan.value);
    result
}
fn apply_plan<T>(
    root: &Root,
    plan: &Plan<T>,
    result: &mut TransactionOutcome<T>,
) -> Option<Diagnostic> {
    for resource in &plan.resources {
        if let Err((step, path, error)) = apply_resource(root, resource) {
            return Some(failure(step, &path, error));
        }
        for path in resource_effects(resource) {
            result.changed = true;
            result.written_paths.push(path.clone());
        }
    }
    for write in &plan.writes {
        if !write_changes(write) {
            continue;
        }
        if let Err((error, unknown)) = apply_write(root, write) {
            if unknown {
                result.changed = true;
                result.written_paths.push(write.path.clone());
                result.unknown_paths.push(write.path.clone());
            }
            return Some(failure("write", &write.path, error));
        }
        result.changed = true;
        result.written_paths.push(write.path.clone());
        result.committed = commit_reached(&plan.commit_point, &result.written_paths);
    }
    result.committed = commit_reached(&plan.commit_point, &result.written_paths);
    None
}
fn write_changes(w: &WriteIntent) -> bool {
    match (&w.before, &w.after) {
        (ExpectedFile::Missing, None) => false,
        (ExpectedFile::Present(before), Some(after)) => before.bytes != *after,
        _ => true,
    }
}
fn commit_reached(commit: &CommitPoint, written: &[RelativePath]) -> bool {
    match commit {
        CommitPoint::NoCommit => false,
        CommitPoint::Created(p)
        | CommitPoint::Updated(p)
        | CommitPoint::Exited(p)
        | CommitPoint::PublishedIndex(p) => written.contains(p),
        CommitPoint::Renamed { old, new } => written.contains(old) && written.contains(new),
    }
}
fn failure(step: &str, path: &RelativePath, error: io::Error) -> Diagnostic {
    Diagnostic {
        code: "filesystem-error".into(),
        message: error.to_string(),
        path: Some(path.as_path().to_string_lossy().into_owned()),
        target: None,
        cause_category: None,
        operation: Some(step.into()),
        detail: None,
        reason: None,
        recovery: None,
    }
}
fn append_error(diagnostics: &mut Vec<Diagnostic>, error: TxError) {
    if error.diagnostics.is_empty() {
        diagnostics.push(Diagnostic {
            code: error.code,
            message: error.message,
            path: None,
            target: None,
            cause_category: None,
            operation: Some("prepare".into()),
            detail: None,
            reason: None,
            recovery: None,
        });
    } else {
        diagnostics.extend(error.diagnostics);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::{self, SourceSnapshot};

    struct Operation(Option<Plan<()>>);
    impl TransactionOperation<()> for Operation {
        fn prepare(&mut self, _: &Root) -> Result<Plan<()>, TxError> {
            Ok(self.0.take().unwrap())
        }
    }
    fn rel(path: &str) -> RelativePath {
        RelativePath::new(path).unwrap()
    }
    fn present(path: &str, bytes: &[u8]) -> ExpectedFile {
        ExpectedFile::Present(SourceSnapshot {
            path: rel(path),
            bytes: bytes.to_vec(),
        })
    }
    fn execute(
        root: &Root,
        writes: Vec<WriteIntent>,
        resources: Vec<ResourceIntent>,
        commit_point: CommitPoint,
    ) -> TransactionOutcome<()> {
        run_transaction(
            root,
            &mut Operation(Some(Plan {
                value: (),
                writes,
                resources,
                commit_point,
            })),
        )
    }
    #[test]
    fn replaces_existing_file_and_reports_commit() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("a"), b"old").unwrap();
        let root = source::open_root(temp.path()).unwrap();
        let result = execute(
            &root,
            vec![WriteIntent {
                path: rel("a"),
                before: present("a", b"old"),
                after: Some(b"new".to_vec()),
            }],
            vec![],
            CommitPoint::Updated(rel("a")),
        );
        assert_eq!(result.status, TxStatus::Ok);
        assert!(result.changed && result.committed);
        assert_eq!(result.written_paths, vec![rel("a")]);
        assert_eq!(std::fs::read(temp.path().join("a")).unwrap(), b"new");
    }
    #[test]
    fn create_conflict_preserves_existing_file() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("a"), b"other").unwrap();
        let root = source::open_root(temp.path()).unwrap();
        let result = execute(
            &root,
            vec![WriteIntent {
                path: rel("a"),
                before: ExpectedFile::Missing,
                after: Some(b"new".to_vec()),
            }],
            vec![],
            CommitPoint::Created(rel("a")),
        );
        assert_eq!(result.status, TxStatus::Error);
        assert!(!result.changed && !result.committed);
        assert_eq!(std::fs::read(temp.path().join("a")).unwrap(), b"other");
    }
    #[test]
    fn reports_partial_effects_when_later_write_fails() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("b"), b"other").unwrap();
        let root = source::open_root(temp.path()).unwrap();
        let writes = vec![
            WriteIntent {
                path: rel("a"),
                before: ExpectedFile::Missing,
                after: Some(b"new".to_vec()),
            },
            WriteIntent {
                path: rel("b"),
                before: ExpectedFile::Missing,
                after: Some(b"new".to_vec()),
            },
        ];
        let result = execute(&root, writes, vec![], CommitPoint::Created(rel("a")));
        assert_eq!(result.status, TxStatus::Error);
        assert!(result.changed && result.committed);
        assert_eq!(result.written_paths, vec![rel("a")]);
        assert_eq!(result.errors[0].operation.as_deref(), Some("write"));
        assert_eq!(std::fs::read(temp.path().join("a")).unwrap(), b"new");
        assert_eq!(std::fs::read(temp.path().join("b")).unwrap(), b"other");
    }
    #[test]
    fn moves_resource_directory_before_writing_reference() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join("old")).unwrap();
        std::fs::write(temp.path().join("old/data"), b"payload").unwrap();
        let root = source::open_root(temp.path()).unwrap();
        let result = execute(
            &root,
            vec![WriteIntent {
                path: rel("ref"),
                before: ExpectedFile::Missing,
                after: Some(b"new".to_vec()),
            }],
            vec![ResourceIntent::MoveDirectory {
                source: rel("old"),
                destination: rel("new"),
            }],
            CommitPoint::Created(rel("ref")),
        );
        assert_eq!(result.status, TxStatus::Ok);
        assert_eq!(
            result.written_paths,
            vec![rel("old"), rel("new"), rel("ref")]
        );
        assert_eq!(
            std::fs::read(temp.path().join("new/data")).unwrap(),
            b"payload"
        );
        assert!(!temp.path().join("old").exists());
    }
}
