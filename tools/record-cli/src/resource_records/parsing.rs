use super::model::{Record, validate_record};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use yaml_rust2::{
    Yaml, YamlLoader,
    parser::{Event, EventReceiver, Parser},
};

pub fn fingerprint(text: &str) -> String {
    format!(
        "sha256:{:x}",
        Sha256::digest(text.replace("\r\n", "\n").replace('\r', "\n").as_bytes())
    )
}
fn yaml_value(y: &Yaml) -> Result<Value, String> {
    Ok(match y {
        Yaml::Null => Value::Null,
        Yaml::Boolean(v) => json!(v),
        Yaml::Integer(v) => json!(v),
        Yaml::Real(v) => return serde_json::from_str(v).map_err(|_| "invalid YAML number".into()),
        Yaml::String(v) => json!(v),
        Yaml::Array(a) => Value::Array(a.iter().map(yaml_value).collect::<Result<_, _>>()?),
        Yaml::Hash(h) => yaml_mapping(h)?,
        _ => return Err("unsupported YAML value".into()),
    })
}
// yaml-rust2's loader overwrites duplicate mapping keys; inspect the event stream first.
#[derive(Default)]
struct MappingKeys {
    frames: Vec<Option<(bool, HashSet<String>)>>,
    error: Option<String>,
}
impl MappingKeys {
    fn complete_value(&mut self) {
        if let Some(Some((expect_key, _))) = self.frames.last_mut() {
            *expect_key = true;
        }
    }
    fn scalar(&mut self, value: String) {
        if let Some(Some((expect_key, keys))) = self.frames.last_mut() {
            if *expect_key {
                if !keys.insert(value.clone()) {
                    self.error = Some(format!("duplicate YAML key: {value}"));
                }
                *expect_key = false;
            } else {
                *expect_key = true;
            }
        }
    }
}
impl EventReceiver for MappingKeys {
    fn on_event(&mut self, event: Event) {
        match event {
            Event::MappingStart(..) | Event::SequenceStart(..) => {
                if matches!(self.frames.last(), Some(Some((true, _)))) {
                    self.error = Some("complex mapping key is invalid".into());
                }
                self.frames
                    .push(if matches!(event, Event::MappingStart(..)) {
                        Some((true, HashSet::new()))
                    } else {
                        None
                    });
            }
            Event::MappingEnd | Event::SequenceEnd => {
                self.frames.pop();
                self.complete_value();
            }
            Event::Scalar(value, ..) => self.scalar(value),
            Event::Alias(..) => {
                if matches!(self.frames.last(), Some(Some((true, _)))) {
                    self.error = Some("alias mapping key is invalid".into());
                } else {
                    self.complete_value();
                }
            }
            _ => {}
        }
    }
}
pub fn parse(text: &str) -> Result<(Record, String), String> {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let rest = normalized
        .strip_prefix("---\n")
        .ok_or("frontmatter must start with ---")?;
    let (header, body) = rest
        .split_once("\n---\n")
        .or_else(|| rest.strip_suffix("\n---").map(|h| (h, "")))
        .ok_or("frontmatter must end with ---")?;
    check_mapping_keys(header)?;
    let docs = YamlLoader::load_from_str(header).map_err(|e| e.to_string())?;
    if docs.len() != 1 {
        return Err("expected one YAML document".into());
    }
    let record: Record =
        serde_json::from_value(yaml_value(&docs[0])?).map_err(|e| e.to_string())?;
    validate_record(&record)?;
    Ok((record, body.to_owned()))
}

fn yaml_mapping(h: &yaml_rust2::yaml::Hash) -> Result<Value, String> {
    let mut m = serde_json::Map::new();
    for (k, v) in h {
        let key = k.as_str().ok_or("mapping key must be a string")?;
        m.insert(key.into(), yaml_value(v)?);
    }
    Ok(Value::Object(m))
}

fn check_mapping_keys(header: &str) -> Result<(), String> {
    let mut keys = MappingKeys::default();
    Parser::new_from_str(header)
        .load(&mut keys, true)
        .map_err(|e| e.to_string())?;
    if let Some(error) = keys.error {
        return Err(error);
    }
    Ok(())
}
