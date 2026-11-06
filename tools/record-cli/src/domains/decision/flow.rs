use super::*;

/// Use the YAML scanner to delimit top-level flow entries without guessing at
/// commas or brackets embedded in quoted and nested values.
pub(super) fn rewrite_flow_fields(
    original: &str,
    yaml_start: usize,
    yaml_end: usize,
    changes: &[(&str, String)],
    after: &Frontmatter,
) -> Option<Result<String, String>> {
    let yaml = &original[yaml_start..yaml_end];
    let spans = flow_field_spans(yaml)?;
    Some((|| {
        let mut edits = flow_edits(yaml, &spans, changes, after)?;
        edits.sort_by_key(|edit| std::cmp::Reverse(edit.start));
        let mut output = original.to_owned();
        for edit in edits {
            output.replace_range(yaml_start + edit.start..yaml_start + edit.end, &edit.value);
        }
        let parsed = parse_frontmatter(output.as_bytes(), &after.id)?;
        if &parsed != after {
            return Err("local flow YAML rewrite changed unselected semantics".into());
        }
        Ok(output)
    })())
}

struct FlowEdit {
    start: usize,
    end: usize,
    value: String,
}
fn flow_edits(
    yaml: &str,
    spans: &[(String, usize, usize)],
    changes: &[(&str, String)],
    after: &Frontmatter,
) -> Result<Vec<FlowEdit>, String> {
    let mut byte_offsets: Vec<usize> = yaml.char_indices().map(|(i, _)| i).collect();
    byte_offsets.push(yaml.len());
    let offset = |n: usize| {
        byte_offsets
            .get(n)
            .copied()
            .ok_or_else(|| "invalid YAML token offset".to_owned())
    };
    let mut edits = Vec::new();
    for (name, rendered) in changes {
        let (_, start, end) = spans
            .iter()
            .find(|(key, _, _)| key == name)
            .ok_or_else(|| format!("cannot safely locate flow YAML field {name}"))?;
        let start = offset(*start)?;
        let end = offset(*end)?;
        let segment = yaml.get(start..end).ok_or("invalid YAML field span")?;
        edits.push(render_flow_value(segment, name, rendered, after, start)?);
    }
    Ok(edits)
}

// Render one selected field while retaining comments outside nested values.
fn render_flow_value(
    segment: &str,
    name: &str,
    rendered: &str,
    after: &Frontmatter,
    start: usize,
) -> Result<FlowEdit, String> {
    let (value_end, comments) = if segment.is_empty() {
        (0, Vec::new())
    } else {
        flow_value_extent(segment)?
    };
    let replacement = if name == "relations" {
        serde_json::to_string(&after.relations).map_err(|e| e.to_string())?
    } else {
        rendered.to_owned()
    };
    let mut value = replacement;
    for comment in comments {
        value.push(' ');
        value.push_str(comment);
        if !comment.ends_with('\n') {
            value.push('\n');
        }
    }
    Ok(FlowEdit {
        start,
        end: start + value_end,
        value,
    })
}

// Scan only top-level flow members; character offsets are converted at edit time.
fn flow_field_spans(yaml: &str) -> Option<Vec<(String, usize, usize)>> {
    use yaml_rust2::scanner::{Scanner, TokenType};
    let tokens: Vec<_> = Scanner::new(yaml.chars()).collect();
    let root = tokens.iter().find(|token| {
        !matches!(
            token.1,
            TokenType::StreamStart(_) | TokenType::Tag(..) | TokenType::Anchor(_)
        )
    })?;
    if !matches!(root.1, TokenType::FlowMappingStart) {
        return None;
    }
    let mut fields = FlowFields::default();
    for token in tokens {
        fields.consume(token.0.index(), token.1);
    }
    Some(fields.spans)
}

#[derive(Default)]
struct FlowFields {
    depth: usize,
    key: Option<String>,
    expect_key: bool,
    expect_value: bool,
    start: Option<usize>,
    spans: Vec<(String, usize, usize)>,
}
impl FlowFields {
    fn consume(&mut self, mark: usize, token: yaml_rust2::scanner::TokenType) {
        use yaml_rust2::scanner::TokenType;
        if self.expect_value && self.start.is_none() && !matches!(token, TokenType::Value) {
            self.start = Some(mark);
            self.expect_value = false;
        }
        self.handle_token(mark, token);
    }
    fn handle_token(&mut self, mark: usize, token: yaml_rust2::scanner::TokenType) {
        use yaml_rust2::scanner::TokenType;
        match token {
            TokenType::FlowMappingStart | TokenType::FlowSequenceStart => self.depth += 1,
            TokenType::FlowMappingEnd | TokenType::FlowSequenceEnd => {
                if self.depth == 1 {
                    self.close_field(mark);
                }
                self.depth = self.depth.saturating_sub(1);
            }
            token if self.depth == 1 => self.top_level(mark, token),
            _ => (),
        }
    }
    fn top_level(&mut self, mark: usize, token: yaml_rust2::scanner::TokenType) {
        use yaml_rust2::scanner::TokenType;
        match token {
            TokenType::Key => self.expect_key = true,
            TokenType::Scalar(_, value) if self.expect_key => {
                self.key = Some(value);
                self.expect_key = false;
            }
            TokenType::Value => self.expect_value = true,
            TokenType::FlowEntry => self.close_field(mark),
            _ => (),
        }
    }
    fn close_field(&mut self, mark: usize) {
        if let (Some(key), Some(start)) = (self.key.take(), self.start.take()) {
            self.spans.push((key, start, mark));
        }
    }
}

/// Find the last non-comment token while preserving trailing whitespace and comments.
fn flow_value_extent(segment: &str) -> Result<(usize, Vec<&str>), String> {
    use yaml_rust2::scanner::{Scanner, TScalarStyle, TokenType};
    let offsets: Vec<_> = segment.char_indices().map(|(index, _)| index).collect();
    let quoted: std::collections::HashSet<usize> = Scanner::new(segment.chars())
        .filter_map(|token| match token.1 {
            TokenType::Scalar(TScalarStyle::SingleQuoted | TScalarStyle::DoubleQuoted, _) => {
                offsets.get(token.0.index()).copied()
            }
            _ => None,
        })
        .collect();
    let mut scan = ValueScan::default();
    for (index, character) in segment.char_indices() {
        scan.consume(segment, &quoted, index, character);
    }
    scan.finish(segment)
}

#[derive(Default)]
enum ValueMode {
    #[default]
    Plain,
    Quoted {
        delimiter: char,
        escaped: bool,
    },
    Comment {
        start: usize,
    },
}
#[derive(Default)]
struct ValueScan {
    mode: ValueMode,
    comments: Vec<(usize, usize)>,
    last: usize,
}
impl ValueScan {
    fn consume(
        &mut self,
        text: &str,
        quoted: &std::collections::HashSet<usize>,
        index: usize,
        c: char,
    ) {
        let mode = std::mem::take(&mut self.mode);
        self.mode = match mode {
            ValueMode::Comment { start } => {
                if c == '\n' {
                    self.comments.push((start, index + 1));
                    ValueMode::Plain
                } else {
                    ValueMode::Comment { start }
                }
            }
            ValueMode::Quoted { delimiter, escaped } => {
                self.last = index + c.len_utf8();
                quoted_mode(text, index, c, delimiter, escaped)
            }
            ValueMode::Plain => self.consume_plain(text, quoted, index, c),
        };
    }
    fn consume_plain(
        &mut self,
        text: &str,
        quoted: &std::collections::HashSet<usize>,
        index: usize,
        c: char,
    ) -> ValueMode {
        if quoted.contains(&index) && (c == '\"' || c == '\'') {
            self.last = index + c.len_utf8();
            return ValueMode::Quoted {
                delimiter: c,
                escaped: false,
            };
        }
        if c == '#' && (index == 0 || text.as_bytes()[index - 1].is_ascii_whitespace()) {
            return ValueMode::Comment { start: index };
        }
        if !c.is_ascii_whitespace() {
            self.last = index + c.len_utf8();
        }
        ValueMode::Plain
    }
    fn finish(mut self, text: &str) -> Result<(usize, Vec<&str>), String> {
        if let ValueMode::Comment { start } = self.mode {
            self.comments.push((start, text.len()));
        }
        if matches!(self.mode, ValueMode::Quoted { .. }) || self.last == 0 {
            return Err("cannot safely locate flow YAML value".into());
        }
        Ok((
            self.last,
            self.comments
                .into_iter()
                .filter(|(start, _)| *start < self.last)
                .map(|(start, end)| &text[start..end])
                .collect(),
        ))
    }
}
fn quoted_mode(text: &str, index: usize, c: char, delimiter: char, escaped: bool) -> ValueMode {
    if escaped {
        return ValueMode::Quoted {
            delimiter,
            escaped: false,
        };
    }
    let escape = (delimiter == '\"' && c == '\\')
        || (delimiter == '\'' && c == '\'' && text[index + 1..].starts_with('\''));
    if escape {
        ValueMode::Quoted {
            delimiter,
            escaped: true,
        }
    } else if c == delimiter {
        ValueMode::Plain
    } else {
        ValueMode::Quoted {
            delimiter,
            escaped: false,
        }
    }
}
