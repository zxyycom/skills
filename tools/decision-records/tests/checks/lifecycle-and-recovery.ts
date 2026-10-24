await import("../activation-archive.test.ts");
await import("../candidate-lifecycle.test.ts");
await import("../candidate-scaffold.test.ts");
await import("../evolution.test.ts");
await import("../lifecycle-relations.test.ts");
await import("../relation-maintenance.test.ts");
await import("../rename.test.ts");
await import("../transaction-recovery.test.ts");
await import("../unrecorded-history.test.ts");

await import("../filesystem-boundaries.test.ts");
await import("../batch-lookup.test.ts");
await import("../first-establishment.test.ts");
await import("../reallocation-member-complexity.test.ts");

await import("../local-operation-contracts.test.ts");

await import("../candidate-operations.test.ts");

await import("../transaction-boundaries.test.ts");

await import("../record-shared-transactions.test.ts");

await import("../candidate-transaction-boundaries.test.ts");

await import("../transaction-creation-modes.test.ts");

await import("../transaction-strict-preparation.test.ts");

await import("../../../record-operations/tests/reader-batch.test.ts");
await import("../../../record-operations/tests/reader-snapshot.test.ts");
await import("../../../record-operations/tests/reader-worker-runtime.test.ts");

await import("../localize-record-operations/identity.test.ts");
await import("../localize-record-operations/publication.test.ts");
await import("../localize-record-operations/history.test.ts");
await import("../localize-record-operations/rename-noop.test.ts");
await import("../localize-record-operations/stage.test.ts");
