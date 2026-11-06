//! Exact spelling and case-folded alias detection in a directory capability.
use super::*;

// Exact spelling is a namespace fact; a case-folded alias is not absence.
pub(super) fn has_exact_resource_name(
    parent: &cap_std::fs::Dir,
    name: &std::ffi::OsStr,
    invalid_path: &Path,
    alias_path: &Path,
) -> Result<bool, SourceError> {
    // Inspect names only: casefold aliases are not absence even on Linux.
    let expected = name
        .to_str()
        .ok_or_else(|| SourceError::InvalidPath(invalid_path.to_path_buf()))?;
    let mut alias = None;
    for entry in parent.entries()? {
        let candidate = entry?.file_name();
        if candidate == name {
            return Ok(true);
        }
        if let Some(text) = candidate.to_str()
            && text.to_lowercase() == expected.to_lowercase()
        {
            alias = Some(text.to_owned());
        }
    }
    match alias {
        Some(actual) => Err(SourceError::CaseMismatch {
            path: alias_path.to_path_buf(),
            actual,
        }),
        None => Ok(false),
    }
}
