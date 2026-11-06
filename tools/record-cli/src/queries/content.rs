//! Bounded scan of selected current sources; each source is captured and identified.
use super::{
    matcher::Matcher,
    preview::{self, Preview},
    trace::compare_text,
};
use crate::source::{self, ExpectedFile, RelativePath, Root};
pub struct Hit {
    pub id: String,
    pub previews: Vec<Preview>,
}
pub struct Scan {
    pub hits: Vec<Hit>,
    pub matched: usize,
    pub scanned: usize,
    pub selected: usize,
    pub files_truncated: bool,
    pub matches_truncated: bool,
    pub characters_truncated: bool,
}
#[derive(Clone, Copy)]
pub struct Policy {
    pub max_candidate_files: usize,
    pub max_file_bytes: u64,
    pub max_total_bytes: u64,
    pub max_files: usize,
    pub max_matches: usize,
    pub max_characters: usize,
}
/// Paths and IDs are selected from one validated immutable index.
pub struct SourceSelection<'a> {
    pub directory: &'a str,
    pub entries: Vec<(&'a str, &'a str)>,
}

/// Budget failures remain errors, not empty hits.
pub fn scan(
    root: &Root,
    selection: SourceSelection<'_>,
    matcher: &Matcher,
    policy: Policy,
    identity: impl Fn(&str) -> Option<String>,
) -> Result<Scan, String> {
    let mut selected = selection.entries;
    if selected.len() > policy.max_candidate_files {
        return Err("candidate file budget exceeded".into());
    }
    selected.sort_by(|a, b| compare_text(a.1, b.1));
    let mut reader = SourceReader {
        root,
        collection: RelativePath::new(selection.directory).map_err(|e| e.to_string())?,
        policy,
        consumed: 0,
        identity,
    };
    let mut accumulator = Accumulator::new(selected.len());
    for (id, path) in selected {
        if reader.capture(id, path, |text| {
            accumulator.observe(id, text, matcher, policy)
        })? {
            break;
        }
    }
    Ok(accumulator.result)
}

// Capture, identity and byte accounting share one bounded source-reader lifecycle.
struct SourceReader<'a, F> {
    root: &'a Root,
    collection: RelativePath,
    policy: Policy,
    consumed: u64,
    identity: F,
}
impl<F: Fn(&str) -> Option<String>> SourceReader<'_, F> {
    fn capture<T>(
        &mut self,
        id: &str,
        member: &str,
        process: impl FnOnce(&str) -> Result<T, String>,
    ) -> Result<T, String> {
        let member = RelativePath::new(member).map_err(|e| e.to_string())?;
        let path = RelativePath::new(self.collection.as_path().join(member.as_path()))
            .map_err(|e| e.to_string())?;
        let captured = source::capture_bounded(
            self.root,
            &path,
            self.policy.max_file_bytes,
            self.policy.max_total_bytes - self.consumed,
        )
        .map_err(|e| e.to_string())?;
        let ExpectedFile::Present(captured) = captured else {
            return Err(format!(
                "selected source is missing: {}",
                path.as_path().display()
            ));
        };
        let text = source::strict_text(&captured).map_err(|e| e.to_string())?;
        if (self.identity)(text).as_deref() != Some(id) {
            return Err(format!(
                "source identity does not match published index: {id}"
            ));
        }
        self.consumed += captured.bytes.len() as u64;
        process(text)
    }
}

struct Accumulator {
    result: Scan,
    preview_characters: usize,
}
impl Accumulator {
    fn new(selected: usize) -> Self {
        Self {
            result: Scan {
                hits: vec![],
                matched: 0,
                scanned: 0,
                selected,
                files_truncated: false,
                matches_truncated: false,
                characters_truncated: false,
            },
            preview_characters: 0,
        }
    }
    // True stops only after observing the first matching source beyond the file limit.
    fn observe(
        &mut self,
        id: &str,
        text: &str,
        matcher: &Matcher,
        policy: Policy,
    ) -> Result<bool, String> {
        self.result.scanned += 1;
        if self.result.hits.len() >= policy.max_files {
            if preview::has_match(text, matcher) {
                self.result.matched += 1;
                self.result.files_truncated = true;
                return Ok(true);
            }
            return Ok(false);
        }
        let available = policy.max_characters - self.preview_characters;
        let preview = preview::build(text, matcher, policy.max_matches, available)?;
        if !preview.matched {
            return Ok(false);
        }
        self.result.matched += 1;
        self.preview_characters += preview.characters;
        self.result.matches_truncated |= preview.matches_truncated;
        self.result.characters_truncated |= preview.characters_truncated;
        self.result.hits.push(Hit {
            id: id.to_owned(),
            previews: preview.previews,
        });
        Ok(false)
    }
}
