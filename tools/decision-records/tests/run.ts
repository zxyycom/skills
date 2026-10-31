await import("./records/metadata.test.ts");
await import("./records/body-field-validation.test.ts");
await import("./records/type-path-invariants.test.ts");
await import("./records/layout-index.test.ts");
await import("./queries/list-facets.test.ts");
await import("./queries/queries.test.ts");
await import("./lifecycle/first-establishment.test.ts");
await import("./records/state-snapshot.test.ts");
await import("./records/source-discovery.test.ts");
await import("./records/record-guards.test.ts");
await import("./cli/configured-decision-directory.test.ts");
await import("./cli/cli-args.test.ts");
await import("./queries/index-maintenance.test.ts");
await import("./candidates/candidate-lifecycle.test.ts");
await import("./candidates/candidate-scaffold.test.ts");
await import("./lifecycle/activation-archive.test.ts");
await import("./records/relation-validation.test.ts");
await import("./records/trace-event-admission.test.ts");
await import("./cli/cli-output-trace.test.ts");
await import("./lifecycle/evolution.test.ts");
await import("./lifecycle/unrecorded-history.test.ts");
await import("./lifecycle/lifecycle-relations.test.ts");
await import("./relations/relation-maintenance.test.ts");
await import("./transactions/transaction-recovery.test.ts");
await import("./rename/rename.test.ts");
await import("./transactions/filesystem-boundaries.test.ts");
await import("./staging/stage.test.ts");
await import("./distribution/generated-artifacts.test.ts");

await import("./queries/search/search-info.test.ts");

await import("./queries/query-snapshot.test.ts");
await import("./queries/query-loaded-snapshot.test.ts");

await import("./records/trace-admission-complexity.test.ts");

await import("./queries/relation-filter-complexity.test.ts");

await import("./queries/batch-lookup.test.ts");
await import("./queries/batch-lookup-cost.test.ts");
await import("./relations/reallocation-member-complexity.test.ts");

await import("./cli/cli-stage-contract.test.ts");

await import("./cli/cli-batch-selection.test.ts");
await import("./cli/cli-query-parity.test.ts");
await import("./cli/cli-reallocation.test.ts");

await import("./queries/index-schema.test.ts");

await import("./queries/search/search-relations.test.ts");
await import("./queries/search/search-modes.test.ts");
await import("./queries/search/search-metadata.test.ts");

await import("./queries/lazy-relation-graph/context.test.ts");
await import("./queries/lazy-relation-graph/queries.test.ts");

await import("./records/scan-index-reuse.test.ts");

await import("./queries/search/search-metadata-window.test.ts");

await import("./cli/cli-search-metadata-window.test.ts");

await import("./transactions/local-operation-contracts.test.ts");

await import("./queries/discovery-dependencies.test.ts");

await import("./candidates/candidate-operations.test.ts");

await import("./transactions/transaction-boundaries.test.ts");

await import("./queries/acquisition-safety.test.ts");

await import("./transactions/record-shared-transactions.test.ts");
await import("./queries/sync-preflight-lock.test.ts");

await import("./candidates/candidate-transaction-boundaries.test.ts");

await import("./transactions/transaction-creation-modes.test.ts");

await import("./transactions/transaction-strict-preparation.test.ts");

await import("./queries/selected-local-contract.test.ts");

await import("./transactions/localize-record-operations/identity.test.ts");
await import("./transactions/localize-record-operations/publication.test.ts");
await import("./transactions/localize-record-operations/history.test.ts");
await import("./transactions/localize-record-operations/rename-noop.test.ts");
await import("./transactions/localize-record-operations/stage.test.ts");
await import("./cli/cli-node-protocol.test.ts");
await import("./records/source-frontmatter-reuse.test.ts");

await import("./queries/canonical-sync-cost.test.ts");
