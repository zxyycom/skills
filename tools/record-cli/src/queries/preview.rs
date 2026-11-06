//! Physical-line previews, bounded in JavaScript UTF-16 code units.
use super::matcher::{MatchRange, Matcher};
use serde::Serialize;
use serde_json::value::RawValue;
#[derive(Serialize)]
pub struct Preview {
    pub column: Option<usize>,
    pub line: usize,
    pub preview: Box<RawValue>,
    pub ranges: Vec<MatchRange>,
}
pub struct PreviewResult {
    pub matched: bool,
    pub previews: Vec<Preview>,
    pub characters: usize,
    pub matches_truncated: bool,
    pub characters_truncated: bool,
}
fn raw_utf16(units: &[u16]) -> Result<Box<RawValue>, String> {
    use std::fmt::Write;
    let mut json = String::from("\"");
    // JSON escapes preserve even a deliberately sliced unpaired surrogate.
    for unit in units {
        write!(&mut json, "\\u{unit:04x}").map_err(|e| e.to_string())?;
    }
    json.push('"');
    RawValue::from_string(json).map_err(|e| e.to_string())
}
pub fn has_match(content: &str, matcher: &Matcher) -> bool {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let mut lines: Vec<_> = normalized.split('\n').collect();
    if normalized.ends_with('\n') {
        lines.pop();
    }
    !matcher.matching_segments(&lines).is_empty()
}
pub fn build(
    content: &str,
    matcher: &Matcher,
    max_matches: usize,
    available: usize,
) -> Result<PreviewResult, String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let mut lines: Vec<_> = normalized.split('\n').collect();
    if normalized.ends_with('\n') {
        lines.pop();
    }
    let hits = matcher.matching_segments(&lines);
    if hits.is_empty() {
        return Ok(PreviewResult {
            matched: false,
            previews: vec![],
            characters: 0,
            matches_truncated: false,
            characters_truncated: false,
        });
    }
    let selection = select_lines(&lines, hits, matcher, max_matches);
    let rendered = render_lines(&lines, selection.lines, available)?;
    Ok(PreviewResult {
        matched: true,
        previews: rendered.previews,
        characters: rendered.characters,
        matches_truncated: selection.matches_truncated,
        characters_truncated: rendered.truncated,
    })
}

struct LineSelection {
    lines: Vec<(usize, Vec<MatchRange>)>,
    matches_truncated: bool,
}

fn select_lines(
    lines: &[&str],
    hits: Vec<usize>,
    matcher: &Matcher,
    max_matches: usize,
) -> LineSelection {
    let mut ranges_by_line = std::collections::BTreeMap::<usize, Vec<MatchRange>>::new();
    let mut used = 0;
    let mut matches_truncated = false;
    for line in hits {
        let (ranges, truncated) = matcher.limited_ranges(lines[line], max_matches - used);
        used += ranges.len();
        if !ranges.is_empty() {
            ranges_by_line.insert(line, ranges);
        }
        if truncated {
            matches_truncated = true;
            break;
        }
    }
    let mut selected = std::collections::BTreeSet::new();
    for &line in ranges_by_line.keys() {
        for n in line.saturating_sub(1)..=(line + 1).min(lines.len().saturating_sub(1)) {
            selected.insert(n);
        }
    }
    let mut matching = Vec::new();
    let mut context = Vec::new();
    for line in selected {
        let ranges = ranges_by_line.remove(&line).unwrap_or_default();
        if ranges.is_empty() {
            context.push((line, ranges));
        } else {
            matching.push((line, ranges));
        }
    }
    LineSelection {
        lines: matching.into_iter().chain(context).collect(),
        matches_truncated,
    }
}

struct RenderedLines {
    previews: Vec<Preview>,
    characters: usize,
    truncated: bool,
}

struct RenderedLine {
    preview: Preview,
    characters: usize,
    truncated: bool,
}

fn render_lines(
    lines: &[&str],
    selected: Vec<(usize, Vec<MatchRange>)>,
    available: usize,
) -> Result<RenderedLines, String> {
    let mut remaining = available;
    let mut previews = Vec::new();
    let mut truncated = false;
    for (line, ranges) in selected {
        if remaining == 0 {
            truncated = true;
            continue;
        }
        let rendered = render_line(lines[line], line, ranges, remaining)?;
        previews.push(rendered.preview);
        remaining -= rendered.characters;
        truncated |= rendered.truncated;
    }
    previews.sort_by_key(|p| p.line);
    Ok(RenderedLines {
        previews,
        characters: available - remaining,
        truncated,
    })
}
fn render_line(
    text: &str,
    line: usize,
    ranges: Vec<MatchRange>,
    remaining: usize,
) -> Result<RenderedLine, String> {
    let units: Vec<u16> = text.encode_utf16().collect();
    let (start, end) = if units.len() <= remaining {
        (0, units.len())
    } else {
        if let Some(first) = ranges.first() {
            let start = if first.end - first.start >= remaining {
                first.start
            } else {
                first.start.min(units.len() - remaining)
            };
            (start, start + remaining)
        } else {
            (0, remaining)
        }
    };
    let clipped: Vec<_> = ranges
        .into_iter()
        .filter_map(|range| {
            let a = range.start.max(start);
            let b = range.end.min(end);
            (a < b).then_some(MatchRange {
                start: a - start,
                end: b - start,
            })
        })
        .collect();
    let preview = Preview {
        column: clipped.first().map(|r| r.start + 1),
        line: line + 1,
        preview: raw_utf16(&units[start..end])?,
        ranges: clipped,
    };
    Ok(RenderedLine {
        preview,
        characters: end - start,
        truncated: units.len() > remaining,
    })
}
#[cfg(test)]
mod tests {
    use super::super::matcher::MatchMode;
    use super::*;
    #[test]
    fn preview_clips_utf16_without_replacing_unpaired_surrogates() {
        let matcher = Matcher::new("x", MatchMode::Any).unwrap();
        let result = build("x😀z", &matcher, 3, 2).unwrap();
        let json = serde_json::to_string(&result.previews).unwrap();
        assert!(json.contains("\\ud83d"));
        assert!(result.characters_truncated);
    }
}
