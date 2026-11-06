use super::*;

/// Result of the line-level body contract; resource file existence remains an IO responsibility.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BodyAssessment {
    pub body_errors: Vec<String>,
    pub resource_errors: Vec<String>,
    pub resource_ids: Vec<String>,
}

pub fn assess_body(
    bytes: &[u8],
    frontmatter_end: usize,
    allow_empty_core: bool,
) -> Result<BodyAssessment, String> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| "invalid UTF-8")?
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    let lines: Vec<_> = text.split('\n').collect();
    if frontmatter_end >= lines.len() {
        return Err("frontmatter end is out of bounds".into());
    }
    Ok(assess_lines(&lines, frontmatter_end, allow_empty_core))
}

fn assess_lines(lines: &[&str], frontmatter_end: usize, allow_empty_core: bool) -> BodyAssessment {
    let (headings, h1) = scan_headings(lines, frontmatter_end);
    let mut body_errors = fixed_heading_errors(&headings, frontmatter_end, h1);
    let mut resource_errors = Vec::new();
    let mut resource_ids = Vec::new();
    if let Some((first, _)) = headings.first()
        && *first > frontmatter_end
        && has_semantic_content(lines, frontmatter_end + 1, *first)
    {
        body_errors.push("body must begin with fixed sections".into());
    }
    for (i, (start, title)) in headings.iter().enumerate() {
        let end = headings.get(i + 1).map_or(lines.len(), |h| h.0);
        if (!allow_empty_core || !CORE_HEADINGS.contains(title))
            && !has_semantic_content(lines, start + 1, end)
        {
            body_errors.push(format!("empty section: {title}"));
        }
        if *title == "随附资源" && *start > frontmatter_end {
            parse_resources(
                &lines[start + 1..end],
                &mut resource_ids,
                &mut resource_errors,
            );
        }
    }
    BodyAssessment {
        body_errors,
        resource_errors,
        resource_ids,
    }
}

const CORE_HEADINGS: [&str; 4] = ["形成时背景", "调查目的", "调查范围与依据", "调查结果与边界"];

fn fixed_heading_errors(
    headings: &[(usize, &str)],
    frontmatter_end: usize,
    h1: bool,
) -> Vec<String> {
    let mut body_errors = Vec::new();
    if h1 {
        body_errors.push("body must not repeat an H1".into());
    }
    for (i, title) in CORE_HEADINGS.iter().enumerate() {
        if headings
            .get(i)
            .is_none_or(|(line, t)| *line <= frontmatter_end || t != title)
            || headings.iter().filter(|(_, t)| t == title).count() != 1
        {
            body_errors.push(format!("missing or misplaced section: {title}"));
        }
    }
    if invalid_resource_heading(headings) {
        body_errors.push("invalid resource heading position".into());
    }
    body_errors
}

fn invalid_resource_heading(headings: &[(usize, &str)]) -> bool {
    let count = headings
        .iter()
        .filter(|(_, title)| *title == "随附资源")
        .count();
    count > 1
        || (count == 1
            && headings
                .get(4)
                .is_none_or(|(_, title)| *title != "随附资源"))
        || headings
            .iter()
            .any(|(_, title)| *title != "随附资源" && title.js_trim() == "随附资源")
}

fn scan_headings<'a>(lines: &[&'a str], frontmatter_end: usize) -> (Vec<(usize, &'a str)>, bool) {
    let mut headings: Vec<(usize, &str)> = Vec::new();
    let mut h1 = false;
    let mut fence = FenceState::default();
    for (i, line) in lines.iter().enumerate() {
        if fence.consume(line) {
            continue;
        }
        if i > frontmatter_end && (*line == "#" || line.starts_with("# ")) {
            h1 = true;
        }
        if let Some(title) = line.strip_prefix("## ").filter(|s| !s.is_empty()) {
            headings.push((i, title));
        }
    }
    (headings, h1)
}

#[derive(Default)]
struct FenceState {
    open: Option<(char, usize)>,
}
impl FenceState {
    // Fence delimiters and fenced lines never contribute headings.
    fn consume(&mut self, line: &str) -> bool {
        let indent = line
            .bytes()
            .take_while(|c| *c == b' ' || *c == b'\t')
            .count();
        let rest = &line[indent..];
        let marker = rest.chars().next().filter(|c| *c == '`' || *c == '~');
        let length = marker.map_or(0, |c| rest.chars().take_while(|v| *v == c).count());
        if self.open.is_some() {
            if let (Some((kind, min)), Some(c)) = (self.open, marker)
                && indent <= 3
                && c == kind
                && length >= min
            {
                self.open = None;
            }
            return true;
        }
        if indent <= 3 && length >= 3 {
            self.open = marker.map(|c| (c, length));
            return true;
        }
        false
    }
}

fn has_semantic_content(lines: &[&str], start: usize, end: usize) -> bool {
    lines[start..end].iter().any(|line| {
        let t = line.js_trim();
        if t.is_empty() {
            return false;
        }
        let hashes = t.bytes().take_while(|c| *c == b'#').count();
        !(1..=6).contains(&hashes)
            || t[hashes..]
                .chars()
                .next()
                .is_some_and(|c| !super::super::is_js_whitespace(c))
    })
}

fn parse_resources(
    lines: &[&str],
    resource_ids: &mut Vec<String>,
    resource_errors: &mut Vec<String>,
) {
    for line in lines {
        if line.js_trim().is_empty() {
            continue;
        }
        let target = line
            .strip_prefix("- [")
            .and_then(|v| v.split_once("]("))
            .filter(|(label, _)| !label.is_empty() && !label.contains(']'))
            .and_then(|(_, v)| v.strip_suffix(')'))
            .and_then(|v| v.strip_prefix("./_resources/"));
        match target {
            Some(id) if valid_resource_id(id) => resource_ids.push(id.to_owned()),
            _ => resource_errors.push("invalid attached resource link".into()),
        }
    }
    if resource_ids.is_empty() || !super::super::sorted(resource_ids) {
        resource_errors.push("resource IDs must be non-empty, unique and sorted".into());
    }
}
