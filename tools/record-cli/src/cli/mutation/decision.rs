use super::*;

mod lifecycle;
mod services;

pub(super) fn run(context: MutationContext<'_>, operation: DecisionCommand) -> i32 {
    match operation {
        DecisionCommand::Stage { selectors, scope } => services::stage(context, selectors, scope),
        DecisionCommand::New {
            selector,
            title,
            purpose,
            background,
            decision,
            tags,
            relations,
            preflight_alignment,
        } => {
            let input = crate::mutations::authoring::NewInput::Decision {
                title,
                purpose,
                background,
                decision,
                tags,
                relations,
                preflight_alignment,
            };
            author_new(context, selector, input, preflight_alignment)
        }
        DecisionCommand::SyncIndex {
            selectors,
            preflight,
        } => services::sync_index(context, selectors, preflight),
        operation @ (DecisionCommand::Publish { .. } | DecisionCommand::Evolve { .. }) => {
            services::evolution(context, operation)
        }
        intent @ (DecisionCommand::Rename { .. } | DecisionCommand::Discard { .. }) => {
            services::identity(context, intent)
        }
        intent @ (DecisionCommand::Reactivate { .. }
        | DecisionCommand::Archive { .. }
        | DecisionCommand::MarkAligned { .. }) => lifecycle::run(context, intent),
        DecisionCommand::SetRelations { groups, preflight } => {
            services::set_relations(context, groups, preflight)
        }
        _ => unsupported_mutation(context),
    }
}
