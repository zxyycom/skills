use super::flow::rewrite_flow_fields;
use super::*;

/// The requested lifecycle metadata and optional replacement relation set.
pub struct MetadataUpdate<'a> {
    pub status: &'a str,
    pub alignment: Option<&'a str>,
    pub created_at: Option<&'a str>,
    pub relations: Option<&'a [Relation]>,
}

/// Replace lifecycle metadata and optionally the full relation set, preserving unselected source bytes.
pub fn replace_metadata(
    bytes: &[u8],
    id: &str,
    update: MetadataUpdate<'_>,
) -> Result<String, String> {
    let MetadataUpdate {
        status,
        alignment,
        created_at,
        relations,
    } = update;
    let before = parse_frontmatter(bytes, id)?;
    let mut after = before.clone();
    after.status = status.to_owned();
    after.alignment = alignment.map(str::to_owned);
    after.created_at = created_at.map(str::to_owned);
    if let Some(relations) = relations {
        after.relations = relations.to_vec();
    }
    rewrite_selected_fields(bytes, &before, &after)
}

/// Rewrite only an ID and direct relationship targets; other source bytes remain untouched.
pub fn replace_identity(
    bytes: &[u8],
    document_id: &str,
    old_id: &str,
    next_id: &str,
) -> Result<String, String> {
    if !is_kebab(old_id) || !is_kebab(next_id) {
        return Err("invalid decision ID".into());
    }
    let before = parse_frontmatter(bytes, document_id)?;
    let mut after = before.clone();
    if before.id == old_id {
        after.id = next_id.to_owned();
    }
    for relation in &mut after.relations {
        if relation.target == old_id {
            relation.target = next_id.to_owned();
        }
    }
    rewrite_selected_fields(bytes, &before, &after)
}

fn rewrite_selected_fields(
    bytes: &[u8],
    before: &Frontmatter,
    after: &Frontmatter,
) -> Result<String, String> {
    let original = std::str::from_utf8(bytes).map_err(|_| "invalid UTF-8")?;
    let newline = if original.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let changes = selected_changes(before, after, newline)?;
    if changes.is_empty() {
        return Ok(original.to_owned());
    }
    let layout = SourceLayout::parse(original)?;
    if let Some(result) = rewrite_flow_fields(
        original,
        layout.starts[1],
        layout.starts[layout.end],
        &changes,
        after,
    ) {
        return result;
    }
    let edits = block_edits(&layout, &changes, newline)?;
    apply_block_edits(original, edits, after)
}

// Apply edits back-to-front, then reparse to prove no unselected semantic changed.
fn apply_block_edits(
    original: &str,
    mut edits: Vec<BlockEdit>,
    after: &Frontmatter,
) -> Result<String, String> {
    edits.sort_by_key(|edit| std::cmp::Reverse(edit.start));
    let mut output = original.to_owned();
    for edit in edits {
        output.replace_range(edit.start..edit.end, &edit.replacement);
    }
    let parsed = parse_frontmatter(output.as_bytes(), &after.id)?;
    if &parsed != after {
        return Err("local YAML rewrite changed unselected semantics".into());
    }
    Ok(output)
}

// Determine which fields actually change before touching source bytes.
fn selected_changes(
    before: &Frontmatter,
    after: &Frontmatter,
    newline: &str,
) -> Result<Vec<(&'static str, String)>, String> {
    let mut changes: Vec<(&'static str, String)> = Vec::new();
    let quote = |s: &str| serde_json::to_string(s).map_err(|e| e.to_string());
    if before.id != after.id {
        changes.push(("id", quote(&after.id)?));
    }
    if before.status != after.status {
        changes.push(("status", after.status.clone()));
    }
    if before.alignment != after.alignment {
        changes.push((
            "alignment",
            after.alignment.clone().unwrap_or_else(|| "null".into()),
        ));
    }
    if before.created_at != after.created_at {
        changes.push((
            "createdAt",
            after.created_at.clone().unwrap_or_else(|| "null".into()),
        ));
    }
    if before.relations != after.relations {
        changes.push((
            "relations",
            render_relation_value(&after.relations, newline)?,
        ));
    }
    Ok(changes)
}

struct SourceLayout<'a> {
    lines: Vec<&'a str>,
    starts: Vec<usize>,
    end: usize,
}
impl<'a> SourceLayout<'a> {
    fn parse(original: &'a str) -> Result<Self, String> {
        let lines: Vec<&'a str> = original.split_inclusive('\n').collect();
        let mut starts = Vec::new();
        let mut offset = 0;
        for line in &lines {
            starts.push(offset);
            offset += line.len();
        }
        let first = lines
            .first()
            .ok_or("missing frontmatter")?
            .trim_start_matches('\u{feff}')
            .trim_end_matches(['\r', '\n']);
        if first != "---" {
            return Err("missing frontmatter".into());
        }
        let end = lines
            .iter()
            .enumerate()
            .skip(1)
            .find_map(|(i, line)| (line.trim_end_matches(['\r', '\n']) == "---").then_some(i))
            .ok_or("missing frontmatter end")?;
        Ok(Self { lines, starts, end })
    }
}

struct BlockEdit {
    start: usize,
    end: usize,
    replacement: String,
}
fn block_edits(
    layout: &SourceLayout<'_>,
    changes: &[(&str, String)],
    newline: &str,
) -> Result<Vec<BlockEdit>, String> {
    let SourceLayout { lines, starts, end } = layout;
    let end = *end;
    let fields = block_fields(lines, end)?;
    let mut edits = Vec::new();
    for (key, value) in changes {
        let i = fields
            .iter()
            .position(|field| field.key == *key)
            .ok_or("missing YAML field")?;
        let field = &fields[i];
        let line_no = field.line_no;
        let colon_end = field.colon_end;
        let end_line = fields.get(i + 1).map_or(end, |next| next.line_no);
        let replacement = block_replacement(
            lines,
            FieldSpan {
                line_no,
                colon_end,
                end_line,
            },
            value,
            newline,
        );
        edits.push(BlockEdit {
            start: starts[line_no],
            end: starts[end_line],
            replacement,
        });
    }
    Ok(edits)
}

// Locate ordered top-level keys without touching nested YAML values.
struct BlockField {
    key: &'static str,
    line_no: usize,
    colon_end: usize,
}
fn block_fields(lines: &[&str], end: usize) -> Result<Vec<BlockField>, String> {
    let keys = [
        "title",
        "id",
        "status",
        "alignment",
        "createdAt",
        "purpose",
        "background",
        "decision",
        "tags",
        "relations",
    ];
    let mut fields = Vec::new();
    for (line_no, line) in lines.iter().enumerate().take(end).skip(1) {
        let content = line.trim_end_matches(['\r', '\n']);
        for key in keys {
            let forms = [key.to_owned(), format!("\"{key}\""), format!("'{key}'")];
            let colon_end = forms.iter().find_map(|form| {
                let suffix = content.strip_prefix(form.as_str())?;
                let spaced = suffix.trim_start_matches([' ', '\t']);
                spaced
                    .starts_with(':')
                    .then_some(form.len() + suffix.len() - spaced.len() + 1)
            });
            if let Some(colon_end) = colon_end {
                fields.push(BlockField {
                    key,
                    line_no,
                    colon_end,
                });
                break;
            }
        }
    }
    if fields.len() != keys.len() || !fields.iter().zip(keys).all(|(field, key)| field.key == key) {
        return Err("cannot safely locate YAML top-level fields for local replacement".into());
    }
    Ok(fields)
}

struct FieldSpan {
    line_no: usize,
    colon_end: usize,
    end_line: usize,
}
fn block_replacement(lines: &[&str], span: FieldSpan, value: &str, newline: &str) -> String {
    let FieldSpan {
        line_no,
        colon_end,
        end_line,
    } = span;
    let line = lines[line_no];
    let content = line.trim_end_matches(['\r', '\n']);
    let inline = yaml_inline_comment(&content[colon_end..]);
    let (first_value, remaining) = value
        .split_once(newline)
        .map_or((value, None), |(head, tail)| (head, Some(tail)));
    let mut replacement = format!("{} {}", &content[..colon_end], first_value);
    if let Some(comment) = inline {
        replacement.push_str(comment);
    }
    if let Some(rest) = remaining {
        replacement.push_str(newline);
        replacement.push_str(rest);
    }
    replacement.push_str(line_ending(line));
    for old in &lines[line_no + 1..end_line] {
        let trimmed = old.trim_start_matches([' ', '\t']);
        if trimmed.starts_with('#') || trimmed.trim_end_matches(['\r', '\n']).is_empty() {
            replacement.push_str(old);
        } else if let Some(comment) = yaml_inline_comment(old.trim_end_matches(['\r', '\n'])) {
            replacement.push_str(comment);
            replacement.push_str(line_ending(old));
        }
    }
    replacement
}

// Retain each source line's original newline form during local rewrites.
fn line_ending(line: &str) -> &'static str {
    if line.ends_with("\r\n") {
        "\r\n"
    } else if line.ends_with('\n') {
        "\n"
    } else {
        ""
    }
}

fn yaml_inline_comment(value: &str) -> Option<&str> {
    let mut quote: Option<InlineQuote> = None;
    for (index, c) in value.char_indices() {
        if let Some(active) = &mut quote {
            if active.consume(c) {
                quote = None;
            }
        } else if c == '\"' || c == '\'' {
            quote = Some(InlineQuote {
                delimiter: c,
                escaped: false,
            });
        } else if c == '#' && (index == 0 || value.as_bytes()[index - 1].is_ascii_whitespace()) {
            let start = value[..index].trim_end_matches([' ', '\t']).len();
            return Some(&value[start..]);
        }
    }
    None
}

struct InlineQuote {
    delimiter: char,
    escaped: bool,
}
impl InlineQuote {
    // A backslash escapes one character only inside double-quoted YAML scalars.
    fn consume(&mut self, c: char) -> bool {
        if self.delimiter == '\"' && self.escaped {
            self.escaped = false;
            return false;
        }
        if self.delimiter == '\"' && c == '\\' {
            self.escaped = true;
            return false;
        }
        c == self.delimiter
    }
}

fn render_relation_value(relations: &[Relation], newline: &str) -> Result<String, String> {
    if relations.is_empty() {
        return Ok("[]".into());
    }
    let quote = |s: &str| serde_json::to_string(s).map_err(|e| e.to_string());
    let mut lines = Vec::new();
    for relation in relations {
        lines.push(format!("  - type: {}", quote(&relation.relation_type)?));
        lines.push(format!("    target: {}", quote(&relation.target)?));
        if let Some(summary) = &relation.summary {
            lines.push(format!("    summary: {}", quote(summary)?));
        }
    }
    Ok(format!("{newline}{}", lines.join(newline)))
}
