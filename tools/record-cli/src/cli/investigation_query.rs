//! Investigation query composition: configuration, source routing and advisories.
use super::{ExecutionContext, investigation_config, multi_source, print_error, resource_review};
use crate::queries::investigation::{self, InvestigationQueryCommand};

pub(super) struct Settings<'a> {
    pub directory: &'a str,
    pub config: Option<&'a str>,
    pub key: Option<&'a str>,
    pub explicit_location: bool,
}

pub(super) fn dispatch(
    context: ExecutionContext<'_>,
    query: InvestigationQueryCommand,
    settings: Settings<'_>,
) -> i32 {
    let ExecutionContext {
        command,
        json,
        root,
    } = context;
    let config = match investigation_config::load(root.path(), settings.config) {
        Ok(config) => config,
        Err(error) => return print_error(command, json, error, 1),
    };
    if !settings.explicit_location {
        match config.select_sources(settings.key, investigation_config::SourceAccess::Read) {
            Ok(Some(sources)) => {
                return multi_source::dispatch(command, json, sources, query, &config.policy);
            }
            Ok(None) => {}
            Err(error) => return print_error(command, json, error, 1),
        }
    }
    match investigation::run(root, settings.directory, query) {
        Ok(value) => resource_review::emit(context, settings.directory, value, &config.policy),
        Err(error) => print_error(command, json, error, 1),
    }
}
