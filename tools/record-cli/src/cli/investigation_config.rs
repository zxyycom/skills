#[path = "investigation_config_help.rs"]
mod config_help;
#[path = "investigation_config_graph.rs"]
mod graph;
pub(super) use config_help::HelpSelection;
// One investigation configuration, layered by workspace rather than command.
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
    sources: Option<BTreeMap<String, serde_json::Value>>,
    resources: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Selection {
    Group(Vec<Member>),
    Single(ConfiguredSource),
}
#[derive(Deserialize)]
#[serde(untagged)]
enum Member {
    Reference(String),
    Source(ConfiguredSource),
}
enum ResolvedMember {
    Reference(String),
    Source(Source),
}

#[derive(Deserialize)]
#[serde(try_from = "serde_json::Value")]
struct ConfiguredSource {
    root: String,
    investigations_dir: String,
}

impl TryFrom<serde_json::Value> for ConfiguredSource {
    type Error = String;
    fn try_from(value: serde_json::Value) -> Result<Self, Self::Error> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct Fields {
            root: String,
            investigations_dir: String,
        }
        if !value.is_object() {
            return Err("source must be an object".into());
        }
        let fields: Fields = serde_json::from_value(value).map_err(|error| error.to_string())?;
        Ok(Self {
            root: fields.root,
            investigations_dir: fields.investigations_dir,
        })
    }
}

#[derive(Clone, Eq, Ord, PartialEq, PartialOrd)]
struct SourceIdentity {
    root: PathBuf,
    directory: PathBuf,
}

struct SourceGroup {
    defined_in: PathBuf,
    kind: GroupKind,
    members: Vec<ResolvedMember>,
}

enum GroupKind {
    Single,
    Composite,
}

#[derive(Clone)]
pub(super) struct Source {
    pub root: PathBuf,
    pub directory: String,
    identity: SourceIdentity,
}

pub(super) struct Config {
    pub policy: Policy,
    default_key: Option<String>,
    groups: BTreeMap<String, SourceGroup>,
    paths: Vec<PathBuf>,
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
}

pub(super) fn load(root: &Path, explicit: Option<&str>) -> Result<Config, CommandError> {
    let cwd = std::env::current_dir().map_err(|e| error(e.to_string()))?;
    let root = cwd.join(root);
    let paths = config_paths(&root, &cwd, explicit);
    let mut config = Config {
        policy: Policy::default(),
        default_key: None,
        groups: BTreeMap::new(),
        paths: paths.clone(),
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
    config.validate_references()?;
    Ok(config)
}

fn config_paths(root: &Path, cwd: &Path, explicit: Option<&str>) -> Vec<PathBuf> {
    explicit.map_or_else(
        || {
            vec![
                root.join(".investigation-report.json"),
                root.join(".local/.investigation-report.local.json"),
            ]
        },
        |path| vec![cwd.join(path)],
    )
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
        apply_sources(config, groups, path)?;
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

fn apply_sources(
    config: &mut Config,
    groups: BTreeMap<String, serde_json::Value>,
    path: &Path,
) -> Result<(), CommandError> {
    let parent = path.parent().unwrap_or(Path::new("."));
    for (key, value) in groups {
        let selection: Selection = serde_json::from_value(value).map_err(|e| {
            error(format!("{}: sources.{key}: expected a source object or an array of source objects and key references: {e}", path.display()))
        })?;
        let (kind, group) = match selection {
            Selection::Single(source) => (GroupKind::Single, vec![Member::Source(source)]),
            Selection::Group(group) => (GroupKind::Composite, group),
        };
        if key.is_empty() || group.is_empty() {
            return Err(error(format!(
                "{}: sources require nonempty keys and groups",
                path.display()
            )));
        }
        let members = group
            .into_iter()
            .map(|member| match member {
                Member::Reference(name) if !name.is_empty() => Ok(ResolvedMember::Reference(name)),
                Member::Reference(_) => Err(error("source reference must not be empty")),
                Member::Source(source) => {
                    resolve_source(source, parent).map(ResolvedMember::Source)
                }
            })
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| error(format!("{}: sources.{key}: {}", path.display(), e.message)))?;
        config.groups.insert(
            key,
            SourceGroup {
                defined_in: path.to_path_buf(),
                kind,
                members,
            },
        );
    }
    Ok(())
}

fn resolve_source(source: ConfiguredSource, parent: &Path) -> Result<Source, CommandError> {
    if source.root.is_empty() {
        return Err(error("source root must not be empty"));
    }
    let directory = crate::source::RelativePath::new(&source.investigations_dir)
        .map_err(|e| error(format!("source investigationsDir: {e}")))?;
    let root = parent.join(source.root);
    let identity = SourceIdentity {
        root: std::fs::canonicalize(&root).unwrap_or_else(|_| root.clone()),
        directory: directory.as_path().to_path_buf(),
    };
    Ok(Source {
        root,
        directory: source.investigations_dir,
        identity,
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
#[path = "investigation_config_tests.rs"]
mod tests;
