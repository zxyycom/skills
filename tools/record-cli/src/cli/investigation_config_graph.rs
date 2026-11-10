//! Resolve read/write selections and validate configured source-reference graphs.
use super::{Config, ResolvedMember, SelectedSources, Source, SourceAccess, error};
use crate::protocol::CommandError;
use std::collections::BTreeSet;

impl Config {
    pub(super) fn validate_references(&self) -> Result<(), CommandError> {
        let mut visited = BTreeSet::new();
        for key in self.groups.keys() {
            self.expand(key, &mut visited, &mut Vec::new())?;
        }
        Ok(())
    }
    pub fn select_sources(
        &self,
        key: Option<&str>,
        access: SourceAccess,
    ) -> Result<Option<SelectedSources>, CommandError> {
        let default = match access {
            SourceAccess::Read => self.default_key.as_deref(),
            SourceAccess::Write => self.default_write_key.as_deref(),
        };
        let Some(selected) = key.or(default) else {
            return Ok(None);
        };
        let mut sources = Vec::new();
        self.expand(selected, &mut BTreeSet::new(), &mut sources)?;
        if matches!(access, SourceAccess::Write) && sources.len() != 1 {
            return Err(error("write requires exactly one source"));
        }
        Ok(Some(SelectedSources {
            key: selected.to_owned(),
            sources,
        }))
    }
    fn expand(
        &self,
        key: &str,
        visited: &mut BTreeSet<String>,
        sources: &mut Vec<Source>,
    ) -> Result<(), CommandError> {
        let mut stack = Vec::new();
        let mut active = BTreeSet::new();
        let mut identities = BTreeSet::new();
        self.push_key(key, visited, &mut active, &mut stack)?;
        while let Some((name, index)) = stack.last_mut() {
            let members = &self.groups[name].members;
            if *index == members.len() {
                let (finished, _) = stack.pop().expect("nonempty stack");
                active.remove(&finished);
                visited.insert(finished);
                continue;
            }
            let member = &members[*index];
            *index += 1;
            match member {
                ResolvedMember::Reference(next) => {
                    self.push_key(next, visited, &mut active, &mut stack)?
                }
                ResolvedMember::Source(source) => {
                    if identities.insert(source.identity.clone()) {
                        sources.push(source.clone());
                    }
                }
            }
        }
        Ok(())
    }
    fn push_key(
        &self,
        key: &str,
        visited: &BTreeSet<String>,
        active: &mut BTreeSet<String>,
        stack: &mut Vec<(String, usize)>,
    ) -> Result<(), CommandError> {
        if active.contains(key) {
            return Err(self.reference_error(stack, format!("source reference cycle at: {key}")));
        }
        if visited.contains(key) {
            return Ok(());
        }
        if !self.groups.contains_key(key) {
            return Err(self.reference_error(stack, format!("unknown source key: {key}")));
        }
        active.insert(key.to_owned());
        stack.push((key.to_owned(), 0));
        Ok(())
    }

    fn reference_error(&self, stack: &[(String, usize)], message: String) -> CommandError {
        match stack
            .last()
            .and_then(|(key, _)| self.groups.get(key).map(|group| (key, group)))
        {
            Some((key, group)) => error(format!(
                "{}: sources.{key}: {message}",
                group.defined_in.display()
            )),
            None => error(message),
        }
    }
}
