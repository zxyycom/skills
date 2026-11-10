//! Candidate header identity discovery without full-document validation.
use yaml_rust2::{
    Yaml, YamlLoader,
    parser::{Event, EventReceiver, MarkedEventReceiver, Parser},
    scanner::{Marker, TScalarStyle},
};

pub(crate) struct CandidateHeaderFields {
    pub keys: Vec<String>,
    pub document: Yaml,
}

/// Discovery only: top-level declarations preserve duplicate identity keys.
pub(crate) fn candidate_header_fields(text: &str) -> Result<Option<CandidateHeaderFields>, String> {
    Ok(parse_header(text, false)?.header)
}

/// Parse classification events and a full YAML document in the same pass.
/// An unavailable document means the loader rejected it; callers can recover
/// the precise loader error through the independent frontmatter entry point.
pub(crate) fn header_and_document(text: &str) -> Result<ParsedHeader, String> {
    parse_header(text, true)
}

pub(crate) struct ParsedHeader {
    pub header: Option<CandidateHeaderFields>,
    pub document: Option<ParsedDocument>,
}

pub(crate) struct ParsedDocument {
    pub yaml: Yaml,
    pub body: String,
}

fn parse_header(text: &str, with_document: bool) -> Result<ParsedHeader, String> {
    let text = text
        .strip_prefix('\u{feff}')
        .unwrap_or(text)
        .replace("\r\n", "\n");
    let Some(after) = text.strip_prefix("---\n") else {
        return Ok(ParsedHeader {
            header: None,
            document: None,
        });
    };
    let Some((yaml, body)) = after
        .find("\n---\n")
        .map(|i| (&after[..i], &after[i + 5..]))
        .or_else(|| after.strip_suffix("\n---").map(|yaml| (yaml, "")))
    else {
        return Ok(ParsedHeader {
            header: None,
            document: None,
        });
    };
    let mut receiver = HeaderAndDocument {
        header: HeaderEvents::default(),
        loader: with_document.then(YamlLoader::default),
        documents_started: 0,
    };
    if Parser::new_from_str(yaml)
        .load(&mut receiver, true)
        .is_err()
        || !receiver.header.root_mapping
    {
        return Ok(ParsedHeader {
            header: None,
            document: None,
        });
    }
    receiver.finish(body)
}

struct HeaderAndDocument {
    header: HeaderEvents,
    loader: Option<YamlLoader>,
    documents_started: usize,
}
impl HeaderAndDocument {
    /// Preserve discovery errors independently of full-document decoding.
    fn finish(self, body: &str) -> Result<ParsedHeader, String> {
        let header = self.header;
        if header
            .keys
            .iter()
            .filter(|key| key.as_str() == "id")
            .count()
            > 1
        {
            return Err(
                "candidate header has ambiguous duplicate frontmatter id declarations".into(),
            );
        }
        let document = (self.documents_started == 1)
            .then_some(self.loader)
            .flatten()
            .and_then(|loader| {
                let docs = loader.documents();
                (docs.len() == 1).then(|| docs[0].clone())
            });
        Ok(ParsedHeader {
            header: Some(CandidateHeaderFields {
                keys: header.keys,
                document: Yaml::Hash(header.fields),
            }),
            document: document.map(|yaml| ParsedDocument {
                yaml,
                body: body.trim_start_matches('\n').to_owned(),
            }),
        })
    }
}
impl MarkedEventReceiver for HeaderAndDocument {
    fn on_event(&mut self, event: Event, mark: Marker) {
        if matches!(event, Event::DocumentStart) {
            self.documents_started += 1;
        }
        if let Some(loader) = &mut self.loader {
            loader.on_event(event.clone(), mark);
        }
        EventReceiver::on_event(&mut self.header, event);
    }
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
