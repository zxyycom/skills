//! Header-bounded reading without consuming unselected body bytes.
use super::*;

// Byte reads intentionally avoid buffered I/O fetching any well-formed body.
pub(super) fn read_header(file: &mut File) -> Result<Vec<u8>, SourceError> {
    use std::io::Read;
    let mut bytes = Vec::new();
    let mut line_start = 0;
    let mut lines = 0;
    let mut byte = [0u8; 1];
    while file.read(&mut byte)? != 0 {
        bytes.push(byte[0]);
        if byte[0] != b'\n' && byte[0] != b'\r' {
            continue;
        }
        let line = &bytes[line_start..bytes.len() - 1];
        let line = header_line(line, lines);
        if !line.is_empty() || lines == 0 {
            if header_line_ends_read(line, lines) {
                // A trailing CR is unnecessary for parsing; do not read the following LF.
                if lines > 0 && byte[0] == b'\r' {
                    bytes.pop();
                }
                break;
            }
            lines += 1;
        }
        line_start = bytes.len();
    }
    Ok(bytes)
}
// The UTF-8 BOM is meaningful only at the start of the first header line.
fn header_line(line: &[u8], previous_lines: usize) -> &[u8] {
    if previous_lines == 0 {
        line.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(line)
    } else {
        line
    }
}
fn header_line_ends_read(line: &[u8], previous_lines: usize) -> bool {
    if previous_lines == 0 {
        line != b"---"
    } else {
        line == b"---"
    }
}
