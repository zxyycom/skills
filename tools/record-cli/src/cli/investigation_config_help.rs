use super::{Config, GroupKind, SourceAccess};
use std::path::Path;

pub(in crate::cli) struct HelpSelection<'a> {
    pub key: Option<&'a str>,
    pub explicit: bool,
    pub root: &'a Path,
    pub directory: &'a str,
    pub write: bool,
}
impl Config {
    pub fn describe(&self, selection: HelpSelection<'_>) {
        for path in &self.paths {
            println!("  Config: {}", path.display());
        }
        self.describe_keys();
        self.describe_selection(selection);
    }
    fn describe_keys(&self) {
        for (name, group) in &self.groups {
            let kind = match group.kind {
                GroupKind::Single => "single",
                GroupKind::Composite => "composite",
            };
            let default = if self.default_key.as_deref() == Some(name) {
                ", default"
            } else {
                ""
            };
            let write_default = if self.default_write_key.as_deref() == Some(name) {
                ", default write"
            } else {
                ""
            };
            println!("  Key: {name} ({kind}{default}{write_default})");
        }
    }
    fn describe_selection(&self, selection: HelpSelection<'_>) {
        if selection.explicit {
            println!(
                "  Selected: explicit location\n  Source: {} / {}",
                selection.root.display(),
                selection.directory
            );
        } else {
            self.describe_selected_key(selection);
        }
    }
    fn describe_selected_key(&self, selection: HelpSelection<'_>) {
        let access = if selection.write {
            SourceAccess::Write
        } else {
            SourceAccess::Read
        };
        match self.select_sources(selection.key, access) {
            Ok(Some(selected)) => {
                println!("  Selected: {}", selected.key);
                for source in selected.sources {
                    println!("  Source: {} / {}", source.root.display(), source.directory);
                }
            }
            Ok(None) => println!(
                "  Selected: workspace\n  Source: {} / {}",
                selection.root.display(),
                selection.directory
            ),
            Err(error) => println!("  Source diagnostic: {}", error.message),
        }
    }
}
