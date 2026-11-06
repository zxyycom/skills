//! Whole-file writes through an already verified or exclusively created handle.
use std::{
    fs::File,
    io::{self, Write},
};

/// The caller positions the handle at zero and must journal a partial failure as unknown.
pub(super) fn write_synced(file: &mut File, bytes: &[u8]) -> io::Result<()> {
    file.write_all(bytes)?;
    file.set_len(bytes.len() as u64)?;
    file.sync_all()
}
