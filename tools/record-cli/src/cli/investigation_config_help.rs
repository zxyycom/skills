use super::*;

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
            println!("  Key: {name} ({kind}{default})");
        }
    }
    fn describe_selection(&self, selection: HelpSelection<'_>) {
        let workspace_write = selection.write && selection.key.is_none() && !selection.explicit;
        if selection.explicit || workspace_write {
            let name = if workspace_write {
                "workspace"
            } else {
                "explicit location"
            };
            println!(
                "  Selected: {name}\n  Source: {} / {}",
                selection.root.display(),
                selection.directory
            );
        } else {
            self.describe_selected_key(selection);
        }
    }
    fn describe_selected_key(&self, selection: HelpSelection<'_>) {
        match self.take_sources(selection.key) {
            Ok(Some(selected)) => {
                if selection.write && selected.sources.len() != 1 {
                    println!("  Source diagnostic: write requires exactly one source");
                    return;
                }
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
