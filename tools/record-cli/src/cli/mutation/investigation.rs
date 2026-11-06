use super::*;

mod services;

pub(super) fn run(context: MutationContext<'_>, operation: InvestigationCommand) -> i32 {
    match operation {
        InvestigationCommand::Stage { selectors, scope } => {
            services::stage(context, selectors, scope)
        }
        InvestigationCommand::New {
            selector,
            title,
            question,
            tags,
            relations,
            formed_at,
        } => {
            let input = crate::mutations::authoring::NewInput::Investigation {
                title,
                question,
                tags,
                relations,
                formed_at,
            };
            author_new(context, selector, input, None)
        }
        InvestigationCommand::SyncIndex {
            selectors,
            preflight,
        } => services::sync_index(context, selectors, preflight),
        InvestigationCommand::Publish {
            selectors,
            preflight,
        } => services::publish(context, selectors, preflight),
        intent @ (InvestigationCommand::Rename { .. } | InvestigationCommand::Discard { .. }) => {
            services::identity(context, intent)
        }
        InvestigationCommand::SetRelations { groups, preflight } => {
            services::set_relations(context, groups, preflight)
        }
        _ => unsupported_mutation(context),
    }
}
