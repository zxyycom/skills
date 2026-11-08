//! Load exactly one validated published-index snapshot per query operation.
use crate::{
    index::{self, DomainDefinition, QuerySnapshot},
    protocol::CommandError,
    source::{self, ExpectedFile, RelativePath, Root},
};
pub fn snapshot<D: DomainDefinition>(
    root: &Root,
    directory: &str,
    index_name: &str,
    definition: &D,
) -> Result<QuerySnapshot<D::State>, CommandError> {
    let path = RelativePath::new(std::path::Path::new(directory).join(index_name))
        .map_err(|e| CommandError::new("invalid-path", e.to_string()))?;
    let source = source::capture(root, &path)
        .map_err(|e| CommandError::new("index-read-failed", e.to_string()))?;
    let ExpectedFile::Present(source) = source else {
        let mut error = CommandError::new(
            "index-not-found",
            format!("published index not found: {}", path.as_path().display()),
        );
        error.path = Some(
            path.as_path()
                .to_string_lossy()
                .into_owned()
                .into_boxed_str(),
        );
        error.recovery =
            Some("Run check, then sync-index explicitly after resolving reported issues.".into());
        return Err(error);
    };
    let index =
        index::parse_index(&source.bytes, definition).map_err(|error| index_error(&path, error))?;
    Ok(QuerySnapshot::new(index))
}

pub fn index_error(path: &RelativePath, error: index::IndexError) -> CommandError {
    if matches!(error, index::IndexError::UnsupportedSurrogate) {
        let mut result = CommandError::new("unsupported-unpaired-surrogate", error.to_string());
        result.path = Some(
            path.as_path()
                .to_string_lossy()
                .into_owned()
                .into_boxed_str(),
        );
        result.recovery = Some(
            "Replace the unpaired surrogate with valid Unicode, then resynchronize the index."
                .into(),
        );
        result
    } else {
        CommandError::new("invalid-index", error.to_string())
    }
}

/// Capture and identify exactly the source addressed by a validated snapshot.
pub fn selected_text(
    root: &Root,
    directory: &str,
    source_path: &str,
    id: &str,
    identity: impl FnOnce(&str) -> Option<String>,
) -> Result<String, CommandError> {
    let collection = RelativePath::new(directory)
        .map_err(|e| CommandError::new("invalid-path", e.to_string()))?;
    let member = RelativePath::new(source_path)
        .map_err(|e| CommandError::new("invalid-path", e.to_string()))?;
    let path = RelativePath::new(collection.as_path().join(member.as_path()))
        .map_err(|e| CommandError::new("invalid-path", e.to_string()))?;
    let captured = source::capture(root, &path)
        .map_err(|e| CommandError::new("source-read-failed", e.to_string()))?;
    let ExpectedFile::Present(captured) = captured else {
        return Err(CommandError::new(
            "source-not-found",
            format!("selected source not found: {}", path.as_path().display()),
        ));
    };
    let text = source::strict_text(&captured)
        .map_err(|e| CommandError::new("source-invalid-utf8", e.to_string()))?;
    if identity(text).as_deref() != Some(id) {
        return Err(CommandError::new(
            "source-identity-mismatch",
            format!("source identity does not match selected ID: {id}"),
        ));
    }
    Ok(text.to_owned())
}

/// Compare the selected current source with its published fingerprint.
pub(super) fn selected_is_stale<S>(
    snapshot: &crate::index::QuerySnapshot<S>,
    id: &str,
    path: &str,
    text: &str,
    domain: crate::source_revision::Domain,
) -> Result<bool, crate::protocol::CommandError> {
    let expected = snapshot
        .index()
        .index()
        .source_revision
        .entries
        .get(id)
        .ok_or_else(|| {
            crate::protocol::CommandError::new("invalid-index", "selected revision is missing")
        })?;
    let actual = crate::source_revision::fingerprint(domain, id, path, text);
    Ok(*expected != actual)
}

/// Present the index path used by a query without reading or resolving it.
pub(super) fn display_index_path(
    root: &crate::source::Root,
    directory: &str,
    name: &str,
) -> String {
    root.path().join(directory).join(name).display().to_string()
}
