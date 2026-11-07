//! Pure comparison after a complete source projection has been built.
mod transaction;
pub(super) use transaction::{Input, WriteSet};

use crate::index::{DomainDefinition, IndexError, ValidatedIndex, parse_index, serialize_index};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Check,
    Preview,
    Write,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Disposition {
    Current,
    Unchanged,
    Previewed,
    NeedsWrite(Vec<u8>),
}
#[derive(Debug)]
pub enum ComparisonError {
    Missing,
    Invalid(IndexError),
    Stale,
    Serialization(IndexError),
}

/// `current` is the actually observed index bytes or proven absence. A failed
/// read must never be converted to `None`. Source and index freshness is not
/// established by this comparison; no value here reports a committed write.
pub fn compare<D: DomainDefinition>(
    expected: &ValidatedIndex<D::State>,
    domain: &D,
    current: Option<&[u8]>,
    mode: Mode,
) -> Result<Disposition, ComparisonError> {
    let expected = serialize_index(expected, domain).map_err(ComparisonError::Serialization)?;
    if let Some(bytes) = current
        && let Ok(text) = std::str::from_utf8(bytes)
        && text.replace("\r\n", "\n").as_bytes() == expected
    {
        return Ok(if mode == Mode::Check {
            Disposition::Current
        } else {
            Disposition::Unchanged
        });
    }
    compare_mismatch(current, domain, expected, mode)
}

fn compare_mismatch<D: DomainDefinition>(
    current: Option<&[u8]>,
    domain: &D,
    expected: Vec<u8>,
    mode: Mode,
) -> Result<Disposition, ComparisonError> {
    if mode == Mode::Check {
        return match current {
            None => Err(ComparisonError::Missing),
            Some(bytes) => match parse_index(bytes, domain) {
                Err(error) => Err(ComparisonError::Invalid(error)),
                Ok(_) => Err(ComparisonError::Stale),
            },
        };
    }
    Ok(match mode {
        Mode::Preview => Disposition::Previewed,
        Mode::Write => Disposition::NeedsWrite(expected),
        Mode::Check => unreachable!(),
    })
}

#[cfg(test)]
mod tests;
