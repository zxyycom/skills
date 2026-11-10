//! One investigation configuration, layered by workspace rather than command.
use crate::{protocol::CommandError, resource_review::policy::Policy};
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    io::Read,
    path::{Path, PathBuf},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Fragment {
    version: Option<u32>,
    default_key: Option<String>,
    sources: Option<BTreeMap<String, Vec<ConfiguredSource>>>,
    resources: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConfiguredSource {
    root: String,
    investigations_dir: String,
}

pub(super) struct Source {
    pub root: PathBuf,
    pub directory: String,
}

pub(super) struct Config {
    pub policy: Policy,
    default_key: Option<String>,
    groups: BTreeMap<String, Vec<Source>>,
}

impl Config {
    fn validate(&self) -> Result<(), CommandError> {
        self.policy.validate().map_err(error)?;
        if let Some(key) = &self.default_key {
            if key.is_empty() || !self.groups.contains_key(key) {
                return Err(error("defaultKey must name an existing source group"));
            }
        } else if !self.groups.is_empty() {
            return Err(error("source groups require defaultKey"));
        }
        Ok(())
    }
    pub fn take_sources(
        &mut self,
        key: Option<&str>,
    ) -> Result<Option<super::multi_source::Sources>, CommandError> {
        let Some(selected) = key.or(self.default_key.as_deref()) else {
            return Ok(None);
        };
        let sources = self
            .groups
            .remove(selected)
            .ok_or_else(|| error(format!("unknown source key: {selected}")))?;
        Ok(Some(super::multi_source::Sources {
            key: selected.to_owned(),
            sources,
        }))
    }
}

pub(super) fn load(root: &Path, explicit: Option<&str>) -> Result<Config, CommandError> {
    let cwd = std::env::current_dir().map_err(|e| error(e.to_string()))?;
    let root = cwd.join(root);
    let paths = explicit.map_or_else(
        || {
            vec![
                root.join(".investigation-report.json"),
                root.join(".local/.investigation-report.local.json"),
            ]
        },
        |path| vec![cwd.join(path)],
    );
    let mut config = Config {
        policy: Policy::default(),
        default_key: None,
        groups: BTreeMap::new(),
    };
    let mut resources = serde_json::to_value(&config.policy).map_err(|e| error(e.to_string()))?;
    for path in paths {
        if let Some(fragment) = read(&path, explicit.is_some())? {
            apply(&mut config, &mut resources, fragment, &path)?;
        }
    }
    config.policy =
        serde_json::from_value(resources).map_err(|e| error(format!("resources: {e}")))?;
    config.validate()?;
    Ok(config)
}

fn read(path: &Path, required: bool) -> Result<Option<Fragment>, CommandError> {
    let Some(file) = open(path, required)? else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    file.take(1_048_577)
        .read_to_end(&mut bytes)
        .map_err(|e| error(format!("{}: {e}", path.display())))?;
    if bytes.len() > 1_048_576 {
        return Err(error(format!(
            "{}: configuration exceeds 1 MiB",
            path.display()
        )));
    }
    parse(&bytes, path).map(Some)
}

fn open(path: &Path, required: bool) -> Result<Option<std::fs::File>, CommandError> {
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound && !required => return Ok(None),
        Err(e) => return Err(error(format!("{}: {e}", path.display()))),
    };
    if !metadata.is_file() {
        return Err(error(format!(
            "{}: configuration must be a regular file",
            path.display()
        )));
    }
    let file = std::fs::File::open(path).map_err(|e| error(format!("{}: {e}", path.display())))?;
    if !file
        .metadata()
        .map_err(|e| error(format!("{}: {e}", path.display())))?
        .is_file()
    {
        return Err(error(format!(
            "{}: configuration is no longer a regular file",
            path.display()
        )));
    }
    Ok(Some(file))
}

fn parse(bytes: &[u8], path: &Path) -> Result<Fragment, CommandError> {
    let value: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|e| error(format!("{}: {e}", path.display())))?;
    if contains_null(&value) {
        return Err(error(format!(
            "{}: null configuration values are not supported",
            path.display()
        )));
    }
    serde_json::from_value(value).map_err(|e| error(format!("{}: {e}", path.display())))
}

fn contains_null(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Null => true,
        serde_json::Value::Object(map) => map.values().any(contains_null),
        serde_json::Value::Array(items) => items.iter().any(contains_null),
        _ => false,
    }
}

fn apply(
    config: &mut Config,
    resources: &mut serde_json::Value,
    fragment: Fragment,
    path: &Path,
) -> Result<(), CommandError> {
    if fragment.version.is_some_and(|v| v != 1) {
        return Err(error(format!(
            "{}: unsupported configuration version",
            path.display()
        )));
    }
    if let Some(key) = fragment.default_key {
        config.default_key = Some(key);
    }
    if let Some(groups) = fragment.sources {
        let parent = path.parent().unwrap_or(Path::new("."));
        for (key, group) in groups {
            if key.is_empty() || group.is_empty() {
                return Err(error(format!(
                    "{}: sources require nonempty keys and groups",
                    path.display()
                )));
            }
            let sources = group
                .into_iter()
                .map(|s| {
                    resolve_source(s, parent)
                        .map_err(|e| error(format!("{}: {}", path.display(), e.message)))
                })
                .collect::<Result<Vec<_>, _>>()?;
            config.groups.insert(key, sources);
        }
    }
    if let Some(patch) = fragment.resources {
        merge(resources, patch);
    }
    // Validate each layer so a later override cannot conceal an invalid project policy.
    let policy: Policy = serde_json::from_value(resources.clone())
        .map_err(|e| error(format!("{}: resources: {e}", path.display())))?;
    policy
        .validate()
        .map_err(|e| error(format!("{}: resources: {e}", path.display())))
}

fn resolve_source(source: ConfiguredSource, parent: &Path) -> Result<Source, CommandError> {
    if source.root.is_empty() {
        return Err(error("source root must not be empty"));
    }
    crate::source::RelativePath::new(&source.investigations_dir)
        .map_err(|e| error(format!("source investigationsDir: {e}")))?;
    Ok(Source {
        root: parent.join(source.root),
        directory: source.investigations_dir,
    })
}

fn merge(base: &mut serde_json::Value, patch: serde_json::Value) {
    match (base, patch) {
        (serde_json::Value::Object(base), serde_json::Value::Object(patch)) => {
            for (key, value) in patch {
                match base.get_mut(&key) {
                    Some(old) => merge(old, value),
                    None => {
                        base.insert(key, value);
                    }
                }
            }
        }
        (base, patch) => *base = patch,
    }
}

fn error(message: impl Into<String>) -> CommandError {
    CommandError::new("config-error", message.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn invalid_layers_are_rejected_even_when_local_settings_override_them() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join(".local")).unwrap();
        std::fs::write(
            temp.path().join(".local/.investigation-report.local.json"),
            json!({
                "version": 1,
                "resources": {
                    "readBudgetBytes": 1024,
                    "compressibility": {"bands": [{"minBytes": 65536, "maxCompressedRatio": 0.1}]},
                    "binary": {"unknown": "warn"},
                    "enabled": true
                }
            })
            .to_string(),
        )
        .unwrap();
        for invalid in [
            json!({"resources":{"compressibility":{"bands":[]}}}),
            json!({"resources":{"readBudgetBytes":0}}),
            json!({"resources":{"binary":{"unknown":"error"}}}),
            json!({"resources":{"enabled":null}}),
            json!({"version":2}),
            json!({"resources":{"unexpected":true}}),
        ] {
            std::fs::write(
                temp.path().join(".investigation-report.json"),
                invalid.to_string(),
            )
            .unwrap();
            let error = match load(temp.path(), None) {
                Ok(_) => panic!("accepted invalid configuration: {invalid}"),
                Err(error) => error,
            };
            assert_eq!(error.code.as_ref(), "config-error");
            assert!(error.message.contains(".investigation-report.json"));
        }
    }
}
