//! Normalized, segment-aware selection shared by metadata and content search.
use std::{
    cmp::Reverse,
    collections::{BinaryHeap, HashSet, binary_heap::PeekMut},
};
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MatchMode {
    All,
    Any,
    Phrase,
}
#[derive(Clone, Debug)]
pub struct Matcher {
    mode: MatchMode,
    phrase: String,
    terms: Vec<String>,
}

fn normalize(text: &str) -> String {
    let lower = text.nfkc().collect::<String>().to_lowercase();
    lower.split_whitespace().collect::<Vec<_>>().join(" ")
}
impl Matcher {
    pub fn new(text: &str, mode: MatchMode) -> Result<Self, &'static str> {
        let phrase = normalize(text)
            .trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
            .to_owned();
        if phrase.is_empty() {
            return Err("Text search query text must not be empty.");
        }
        let mut seen = HashSet::new();
        let terms = phrase
            .split(' ')
            .filter(|term| seen.insert((*term).to_owned()))
            .map(str::to_owned)
            .collect();
        Ok(Self {
            mode,
            phrase,
            terms,
        })
    }
    /// `all` may match terms across segments; a phrase cannot cross segments.
    pub fn matching_segments(&self, segments: &[&str]) -> Vec<usize> {
        let mut found = HashSet::new();
        let mut matches = Vec::new();
        for (index, segment) in segments.iter().enumerate() {
            let text = normalize(segment);
            let matched = if self.mode == MatchMode::Phrase {
                text.contains(&self.phrase)
            } else {
                let mut matched = false;
                for term in &self.terms {
                    if text.contains(term) {
                        found.insert(term);
                        matched = true;
                    }
                }
                matched
            };
            if matched {
                matches.push(index);
            }
        }
        if self.mode == MatchMode::All && found.len() != self.terms.len() {
            Vec::new()
        } else {
            matches
        }
    }
}
/// Original UTF-16 offsets of a merged normalized match.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, serde::Serialize)]
pub struct MatchRange {
    pub start: usize,
    pub end: usize,
}

// Field order preserves original UTF-16 range priority and equal-range term order.
#[derive(Clone, Copy, Eq, Ord, PartialEq, PartialOrd)]
struct MatchHead {
    range: MatchRange,
    needle_index: usize,
    normalized_byte_offset: usize,
}

impl MatchHead {
    // Advance one normalized character so overlapping occurrences remain visible.
    fn next_match(self, mapped: &MappedText, needles: &[&str]) -> Option<Self> {
        let next = self.normalized_byte_offset
            + mapped.content[self.normalized_byte_offset..]
                .chars()
                .next()
                .map_or(1, char::len_utf8);
        let (at, range) = mapped.find(needles[self.needle_index], next)?;
        Some(Self {
            range,
            needle_index: self.needle_index,
            normalized_byte_offset: at,
        })
    }
}

impl Matcher {
    /// Map matches through grapheme-wise normalization to original UTF-16
    /// offsets. The scan remains active after `maximum` until the first omitted
    /// range, so an exactly full budget is not reported as truncated.
    pub fn limited_ranges(&self, text: &str, maximum: usize) -> (Vec<MatchRange>, bool) {
        let mapped = MappedText::new(text);
        let needles: Vec<&str> = if self.mode == MatchMode::Phrase {
            vec![&self.phrase]
        } else {
            self.terms.iter().map(String::as_str).collect()
        };
        // A one-term queue has one element and needs no heap comparisons.
        let mut heads: BinaryHeap<_> = needles
            .iter()
            .enumerate()
            .filter_map(|(needle_index, needle)| {
                let (at, range) = mapped.find(needle, 0)?;
                Some(Reverse(MatchHead {
                    range,
                    needle_index,
                    normalized_byte_offset: at,
                }))
            })
            .collect();
        let mut merged: Vec<MatchRange> = Vec::new();
        while let Some(mut head) = heads.peek_mut() {
            let Reverse(current) = *head;
            let range = current.range;
            if let Some(previous) = merged
                .last_mut()
                .filter(|previous| range.start <= previous.end)
            {
                previous.end = previous.end.max(range.end);
            } else if merged.len() == maximum {
                return (merged, true);
            } else {
                merged.push(range);
            }
            if let Some(next) = current.next_match(&mapped, &needles) {
                *head = Reverse(next);
            } else {
                PeekMut::pop(head);
            }
        }
        (merged, false)
    }
}
// Carries normalized bytes and their corresponding original UTF-16 spans.
struct MappedText {
    content: String,
    spans: Vec<MatchRange>,
}
impl MappedText {
    fn new(text: &str) -> Self {
        let normalized = text.nfkc().collect::<String>().to_lowercase();
        let mut offset = 0;
        let mut original_offset = 0;
        let mut mapped: Vec<(char, MatchRange)> = Vec::new();
        for grapheme in text.graphemes(true) {
            let length = grapheme.encode_utf16().count();
            let span = MatchRange {
                start: original_offset,
                end: original_offset + length,
            };
            original_offset += length;
            let expected = grapheme.nfkc().collect::<String>().to_lowercase();
            let remaining = &normalized[offset..];
            let matched_len = if remaining.starts_with(&expected) {
                expected.len()
            } else {
                remaining.chars().next().map_or(0, char::len_utf8)
            };
            for ch in remaining[..matched_len].chars() {
                append_mapped(&mut mapped, ch, span);
            }
            offset += matched_len;
        }
        let last = mapped.last().map(|(_, span)| *span).unwrap_or(MatchRange {
            start: 0,
            end: original_offset,
        });
        for ch in normalized[offset..].chars() {
            append_mapped(&mut mapped, ch, last);
        }
        Self::from_character_spans(&mapped)
    }

    // Trim normalized whitespace and expand character provenance to UTF-8 bytes.
    fn from_character_spans(mapped: &[(char, MatchRange)]) -> Self {
        let start = mapped
            .iter()
            .position(|(c, _)| *c != ' ')
            .unwrap_or(mapped.len());
        let end = mapped
            .iter()
            .rposition(|(c, _)| *c != ' ')
            .map_or(start, |i| i + 1);
        let mapped = &mapped[start..end];
        let content: String = mapped.iter().map(|(c, _)| c).collect();
        let mut spans = Vec::new();
        for (ch, span) in mapped {
            spans.extend(std::iter::repeat_n(*span, ch.len_utf8()));
        }
        Self { content, spans }
    }

    fn find(&self, needle: &str, from: usize) -> Option<(usize, MatchRange)> {
        if from >= self.content.len() {
            return None;
        }
        let at = from + self.content[from..].find(needle)?;
        Some((
            at,
            MatchRange {
                start: self.spans[at].start,
                end: self.spans[at + needle.len() - 1].end,
            },
        ))
    }
}
fn append_mapped(mapped: &mut Vec<(char, MatchRange)>, character: char, span: MatchRange) {
    let character = if character.is_whitespace() {
        ' '
    } else {
        character
    };
    if character == ' '
        && let Some((_, previous)) = mapped.last_mut().filter(|(c, _)| *c == ' ')
    {
        previous.end = span.end;
    } else {
        mapped.push((character, span));
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_terms_may_span_segments_but_phrase_may_not() {
        let all = Matcher::new("ALPHA beta", MatchMode::All).unwrap();
        assert_eq!(all.matching_segments(&["Alpha", "ＢＥＴＡ"]), vec![0, 1]);
        assert!(all.matching_segments(&["Alpha", "gamma"]).is_empty());
        assert!(
            Matcher::new("alpha beta", MatchMode::Phrase)
                .unwrap()
                .matching_segments(&["alpha", "beta"])
                .is_empty()
        );
    }
    #[test]
    fn whitespace_and_empty_query_are_normalized() {
        assert!(Matcher::new(" \u{2003}\t", MatchMode::Any).is_err());
        assert_eq!(
            Matcher::new("x y", MatchMode::Phrase)
                .unwrap()
                .matching_segments(&["X\u{2003} Y"]),
            vec![0]
        );
    }
    #[test]
    fn lowercase_preserves_context_and_expansion() {
        let sigma = Matcher::new("ος", MatchMode::Phrase).unwrap();
        assert_eq!(sigma.matching_segments(&["ΟΣ"]), vec![0]);
        let dotted = Matcher::new("i\u{0307}", MatchMode::Phrase).unwrap();
        assert_eq!(dotted.matching_segments(&["İ"]), vec![0]);
    }
    #[test]
    fn preview_ranges_are_original_utf16_after_nfkc() {
        let matcher = Matcher::new("ffi", MatchMode::Phrase).unwrap();
        assert_eq!(
            matcher.limited_ranges("😀 ﬃ!", 1),
            (vec![MatchRange { start: 3, end: 4 }], false)
        );
        assert_eq!(
            matcher.limited_ranges("ﬃ ﬃ", 1),
            (vec![MatchRange { start: 0, end: 1 }], true)
        );
    }

    #[test]
    fn multi_term_preview_merges_ranges_before_applying_budget() {
        for (query, text, maximum, expected, truncated) in [
            ("ab cd", "cdab", 1, vec![(0, 4)], false),
            ("aaa aa a", "aaaa xx aaaa", 1, vec![(0, 4)], true),
            ("aaa aa a", "aaaa xx aaaa", 2, vec![(0, 4), (8, 12)], false),
            ("aaa aa a", "aaaa", 0, vec![], true),
            ("a b", "xyz", 0, vec![], false),
        ] {
            let matcher = Matcher::new(query, MatchMode::Any).unwrap();
            let ranges = expected
                .into_iter()
                .map(|(start, end)| MatchRange { start, end })
                .collect();
            assert_eq!(
                matcher.limited_ranges(text, maximum),
                (ranges, truncated),
                "query={query:?}, text={text:?}, maximum={maximum}"
            );
        }
    }

    #[test]
    fn multi_term_preview_preserves_utf16_when_normalized_matches_tie() {
        let matcher = Matcher::new("f ff ffi", MatchMode::Any).unwrap();
        let text = "😀 ﬃ ff";
        assert_eq!(
            matcher.limited_ranges(text, 2),
            (
                vec![
                    MatchRange { start: 3, end: 4 },
                    MatchRange { start: 5, end: 7 },
                ],
                false,
            )
        );
    }
}
