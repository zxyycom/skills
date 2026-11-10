//! Domain-owned formats. Candidate and published documents are distinct.
mod candidate_header;
pub mod decision;
pub(crate) use candidate_header::candidate_header_fields;
mod graph;
pub mod investigation;
use graph::build_graph;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Relation {
    #[serde(rename = "type")]
    pub relation_type: String,
    pub target: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present_string"
    )]
    pub summary: Option<String>,
}
fn present_string<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<String>, D::Error> {
    String::deserialize(deserializer).map(Some)
}
#[derive(Clone, Debug)]
pub struct Readiness {
    pub scaffold_valid: bool,
    pub body_ready: bool,
    pub resource_ready: Option<bool>,
}
#[derive(Clone, Debug)]
pub struct CandidateDocument<S> {
    pub markdown: String,
    pub state: Option<S>,
    pub resource_ids: Vec<String>,
    pub readiness: Readiness,
    pub diagnostics: Vec<String>,
}
#[derive(Clone, Debug)]
pub struct EstablishedDocument<S> {
    pub markdown: String,
    pub state: S,
}

/// ECMAScript String.prototype.trim whitespace, deliberately distinct from Rust's Unicode whitespace.
pub(crate) trait JsTrim {
    fn js_trim(&self) -> &str;
}
pub(crate) fn is_js_whitespace(c: char) -> bool {
    matches!(c, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}
impl JsTrim for str {
    fn js_trim(&self) -> &str {
        self.trim_matches(is_js_whitespace)
    }
}
pub fn is_kebab(value: &str) -> bool {
    !value.is_empty()
        && value.split('-').all(|segment| {
            !segment.is_empty()
                && segment
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
}

pub(crate) fn valid_timestamp(s: &str) -> bool {
    let b = s.as_bytes();
    if !(b.len() == 20 || b.len() == 25)
        || b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b'T'
        || b[13] != b':'
        || b[16] != b':'
    {
        return false;
    }
    if (b.len() == 20 && b[19] != b'Z')
        || (b.len() == 25 && (!matches!(b[19], b'+' | b'-') || b[22] != b':'))
    {
        return false;
    }
    let number = |start: usize, end: usize| -> Option<u32> {
        let x = &s[start..end];
        if x.bytes().all(|c| c.is_ascii_digit()) {
            x.parse().ok()
        } else {
            None
        }
    };
    if !b
        .iter()
        .enumerate()
        .all(|(i, c)| [4, 7, 10, 13, 16, 19, 22].contains(&i) || c.is_ascii_digit())
    {
        return false;
    }
    let (Some(y), Some(m), Some(d), Some(h), Some(min), Some(sec)) = (
        number(0, 4),
        number(5, 7),
        number(8, 10),
        number(11, 13),
        number(14, 16),
        number(17, 19),
    ) else {
        return false;
    };
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let days = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => 0,
    };
    y >= 100
        && d > 0
        && d <= days
        && h < 24
        && min < 60
        && sec < 60
        && (b.len() == 20
            || (number(20, 22).is_some_and(|x| x < 24) && number(23, 25).is_some_and(|x| x < 60)))
}
pub fn name_from_id(id: &str) -> &str {
    let b = id.as_bytes();
    if b.len() > 7 && b[6] == b'-' && b[..6].iter().all(u8::is_ascii_digit) {
        let date = format!("20{}-{}-{}T00:00:00Z", &id[..2], &id[2..4], &id[4..6]);
        if valid_timestamp(&date) {
            return &id[7..];
        }
    }
    id
}
pub(crate) fn valid_fingerprint(s: &str) -> bool {
    s.len() == 71
        && s.starts_with("sha256:")
        && s[7..]
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
pub(crate) fn common_index<S>(
    index: &crate::index::IndexV4<S>,
) -> Result<(), crate::index::IndexError> {
    if index.metadata.as_object().is_none_or(|m| !m.is_empty())
        || !valid_fingerprint(&index.source_revision.metadata)
        || index
            .source_revision
            .entries
            .values()
            .any(|v| !valid_fingerprint(v))
    {
        return Err(crate::index::IndexError::Domain(
            "invalid metadata or source revision fingerprint".into(),
        ));
    }
    Ok(())
}
pub(crate) fn sorted(values: &[String]) -> bool {
    values
        .windows(2)
        .all(|w| w[0].encode_utf16().cmp(w[1].encode_utf16()).is_lt())
}
pub(crate) fn path_name(path: &str) -> bool {
    path.strip_suffix(".md").is_some_and(is_kebab)
}
pub(crate) fn single_line(s: &str) -> bool {
    !s.is_empty() && s.js_trim() == s && !s.contains('\n')
}

#[cfg(test)]
#[path = "tests/tests.rs"]
mod tests;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SelectorError {
    NotFound,
    Ambiguous(Vec<String>),
}
/// Per-snapshot name lookup for operations resolving several selectors.
pub(crate) struct SelectorIndex<'a, S> {
    entries: &'a std::collections::BTreeMap<String, S>,
    names: std::collections::HashMap<&'a str, Vec<&'a str>>,
}

impl<'a, S> SelectorIndex<'a, S> {
    pub(crate) fn new(
        entries: &'a std::collections::BTreeMap<String, S>,
        name: impl Fn(&S) -> &str,
    ) -> Self {
        let mut names: std::collections::HashMap<&str, Vec<&str>> =
            std::collections::HashMap::new();
        for (id, state) in entries {
            names.entry(name(state)).or_default().push(id);
        }
        Self { entries, names }
    }

    pub(crate) fn resolve(&self, selector: &str) -> Result<(&'a str, &'a S), SelectorError> {
        let normalized = normalize_selector(selector);
        if name_from_id(normalized) != normalized {
            return self
                .entries
                .get_key_value(normalized)
                .map(|(id, state)| (id.as_str(), state))
                .ok_or(SelectorError::NotFound);
        }
        match self
            .names
            .get(normalized)
            .map(Vec::as_slice)
            .unwrap_or_default()
        {
            [] => Err(SelectorError::NotFound),
            [id] => Ok((*id, &self.entries[*id])),
            ids => Err(SelectorError::Ambiguous(
                ids.iter().map(|id| (*id).to_owned()).collect(),
            )),
        }
    }
}

fn normalize_selector(selector: &str) -> &str {
    if selector
        .get(selector.len().saturating_sub(3)..)
        .is_some_and(|suffix| suffix.eq_ignore_ascii_case(".md"))
    {
        &selector[..selector.len() - 3]
    } else {
        selector
    }
}

/// A dated selector identifies exactly one ID; all other inputs match projected names.
pub fn resolve_selector<'a, S>(
    entries: &'a std::collections::BTreeMap<String, S>,
    selector: &str,
    name: impl Fn(&S) -> &str,
) -> Result<(&'a str, &'a S), SelectorError> {
    let normalized = normalize_selector(selector);
    if name_from_id(normalized) != normalized {
        return entries
            .get_key_value(normalized)
            .map(|(id, s)| (id.as_str(), s))
            .ok_or(SelectorError::NotFound);
    }
    let matches: Vec<_> = entries
        .iter()
        .filter(|(_, s)| name(s) == normalized)
        .collect();
    match matches.as_slice() {
        [] => Err(SelectorError::NotFound),
        [(id, s)] => Ok((id.as_str(), *s)),
        _ => Err(SelectorError::Ambiguous(
            matches.into_iter().map(|(id, _)| id.clone()).collect(),
        )),
    }
}

#[cfg(test)]
#[path = "tests/index_tests.rs"]
mod index_tests;
