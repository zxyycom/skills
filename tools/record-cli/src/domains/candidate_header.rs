//! Candidate header identity discovery without full-document validation.
use yaml_rust2::{
    Yaml, YamlLoader,
    parser::{Event, EventReceiver, Parser},
    scanner::TScalarStyle,
};

pub(crate) struct CandidateHeaderFields {
    pub keys: Vec<String>,
    pub document: Yaml,
}

/// Discovery only: top-level declarations preserve duplicate identity keys.
pub(crate) fn candidate_header_fields(text: &str) -> Result<Option<CandidateHeaderFields>, String> {
    let text = text
        .strip_prefix('\u{feff}')
        .unwrap_or(text)
        .replace("\r\n", "\n");
    let Some(after) = text.strip_prefix("---\n") else {
        return Ok(None);
    };
    let Some(yaml) = after
        .find("\n---\n")
        .map(|i| &after[..i])
        .or_else(|| after.strip_suffix("\n---"))
    else {
        return Ok(None);
    };
    let mut header = HeaderEvents::default();
    if Parser::new_from_str(yaml).load(&mut header, true).is_err() || !header.root_mapping {
        return Ok(None);
    }
    if header
        .keys
        .iter()
        .filter(|key| key.as_str() == "id")
        .count()
        > 1
    {
        return Err("candidate header has ambiguous duplicate frontmatter id declarations".into());
    }
    Ok(Some(CandidateHeaderFields {
        keys: header.keys,
        document: Yaml::Hash(header.fields),
    }))
}

#[derive(Default)]
struct HeaderEvents {
    depth: usize,
    phase: u8,
    keys: Vec<String>,
    current_key: Option<String>,
    fields: yaml_rust2::yaml::Hash,
    root_mapping: bool,
}
impl EventReceiver for HeaderEvents {
    fn on_event(&mut self, event: Event) {
        match event {
            Event::MappingStart(..) | Event::SequenceStart(..) => {
                if self.depth == 0 {
                    self.root_mapping = matches!(event, Event::MappingStart(..));
                }
                self.depth += 1;
            }
            Event::MappingEnd | Event::SequenceEnd => {
                self.depth = self.depth.saturating_sub(1);
                if self.depth == 1 {
                    self.phase ^= 1;
                }
            }
            Event::Scalar(value, style, _, tag) if self.depth == 1 => {
                let is_string = style != TScalarStyle::Plain
                    || tag.as_ref().is_some_and(|tag| tag.suffix == "str");
                self.scalar(value, is_string);
            }
            Event::Alias(..) if self.depth == 1 => self.phase ^= 1,
            _ => {}
        }
    }
}

impl HeaderEvents {
    fn scalar(&mut self, value: String, is_string: bool) {
        if self.phase == 0 {
            self.current_key = Some(value.clone());
            self.keys.push(value);
        } else if let Some(key) = self
            .current_key
            .take()
            .filter(|key| key == "id" || key == "status")
        {
            let parsed = if is_string {
                Yaml::String(value)
            } else {
                YamlLoader::load_from_str(&value)
                    .ok()
                    .and_then(|docs| docs.into_iter().next())
                    .unwrap_or(Yaml::BadValue)
            };
            self.fields.insert(Yaml::String(key), parsed);
        }
        self.phase ^= 1;
    }
}
