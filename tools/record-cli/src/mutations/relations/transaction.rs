use crate::{
    index::{self, DomainDefinition},
    source::{self, ExpectedFile, RelativePath, Root},
    transaction::{Guard, TxError, WriteIntent},
};
fn fail(code: &str, message: impl Into<String>) -> TxError {
    TxError::new(code, message)
}

pub(in crate::mutations) fn verify_recovered(
    root: &Root,
    writes: &[WriteIntent],
    guards: &[Guard],
) -> Result<(), TxError> {
    for write in writes {
        let actual =
            source::capture(root, &write.path).map_err(|e| fail("recovery", e.to_string()))?;
        match (&write.before, actual) {
            (ExpectedFile::Present(before), ExpectedFile::Present(actual))
                if before.bytes == actual.bytes && before.identity.mode == actual.identity.mode => {
            }
            _ => return Err(fail("recovery", "original source was not restored")),
        }
    }
    for guard in guards {
        if !crate::source::equivalent_file(
            &source::capture(root, &guard.path).map_err(|e| fail("recovery", e.to_string()))?,
            &guard.before,
        ) {
            return Err(fail("recovery", "guard changed"));
        }
    }
    Ok(())
}

pub(in crate::mutations) fn verify_index<D: DomainDefinition>(
    root: &Root,
    path: &RelativePath,
    definition: &D,
) -> Result<(), TxError> {
    let ExpectedFile::Present(index) =
        source::capture(root, path).map_err(|e| fail("postverify", e.to_string()))?
    else {
        return Err(fail("postverify", "index missing"));
    };
    let parsed = index::parse_index(&index.bytes, definition)
        .map_err(|e| fail("postverify", e.to_string()))?;
    index::QuerySnapshot::new(parsed)
        .graph(definition)
        .map_err(|e| fail("postverify", e.to_string()))?;
    Ok(())
}

/// Compare only the source and guard facts carried by relation operations.
pub(in crate::mutations) fn same_plan(
    left_writes: &[WriteIntent],
    right_writes: &[WriteIntent],
    left_guards: &[Guard],
    right_guards: &[Guard],
) -> bool {
    left_writes.len() == right_writes.len()
        && left_writes.iter().zip(right_writes).all(|(a, b)| {
            a.path == b.path
                && crate::source::equivalent_file(&a.before, &b.before)
                && a.after == b.after
                && a.mode.is_none()
                && b.mode.is_none()
        })
        && left_guards.len() == right_guards.len()
        && left_guards
            .iter()
            .zip(right_guards)
            .all(|(a, b)| a.path == b.path && crate::source::equivalent_file(&a.before, &b.before))
}
