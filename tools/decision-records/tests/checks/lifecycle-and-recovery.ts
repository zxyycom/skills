await import("../lifecycle/activation-archive.test.ts");
await import("../candidates/candidate-lifecycle.test.ts");
await import("../candidates/candidate-scaffold.test.ts");
await import("../lifecycle/evolution.test.ts");
await import("../lifecycle/lifecycle-relations.test.ts");
await import("../relations/relation-maintenance.test.ts");
await import("../rename/rename.test.ts");
await import("../transactions/transaction-recovery.test.ts");
await import("../lifecycle/unrecorded-history.test.ts");

await import("../transactions/filesystem-boundaries.test.ts");
await import("../queries/batch-lookup.test.ts");
await import("../queries/batch-lookup-cost.test.ts");
await import("../lifecycle/first-establishment.test.ts");
await import("../relations/reallocation-member-complexity.test.ts");

await import("../transactions/local-operation-contracts.test.ts");

await import("../candidates/candidate-operations.test.ts");

await import("../transactions/transaction-boundaries.test.ts");

await import("../transactions/record-shared-transactions.test.ts");

await import("../candidates/candidate-transaction-boundaries.test.ts");

await import("../transactions/transaction-creation-modes.test.ts");

await import("../transactions/transaction-strict-preparation.test.ts");

await import("../transactions/localize-record-operations/identity.test.ts");
await import("../transactions/localize-record-operations/publication.test.ts");
await import("../transactions/localize-record-operations/history.test.ts");
await import("../transactions/localize-record-operations/rename-noop.test.ts");
await import("../transactions/localize-record-operations/stage.test.ts");
