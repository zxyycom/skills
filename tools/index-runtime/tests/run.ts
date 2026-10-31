await import("./materialization/materialization-order.test.ts");
await import("./materialization/materialization-sync.test.ts");
await import("./materialization/materialization-lifecycle.test.ts");
await import("./materialization/materialization-path.test.ts");
await import("./protocol/protocol-definition.test.ts");
await import("./protocol/protocol-snapshot.test.ts");
await import("./protocol/protocol-query.test.ts");
await import("./query/query-data-proof.test.ts");
await import("./query/query.test.ts");
await import("./runtime/runtime-schema.test.ts");
await import("./runtime/runtime-reader.test.ts");
await import("./runtime/reader-load.test.ts");
await import("./runtime/runtime-refresh.test.ts");
await import("./runtime/runtime-selected-sync.test.ts");
await import("./staging/staging-selection.test.ts");
await import("./staging/staging-errors.test.ts");
await import("./staging/staging-transaction.test.ts");
await import("./staging/staging-conflicts.test.ts");

await import("./storage/exact-membership.test.ts");

await import("./storage/preview.test.ts");

await import("./staging/record-staging.test.ts");

await import("./storage/storage-source.test.ts");

await import("./prepared/prepared.test.ts");
await import("./prepared/prepared-sync.test.ts");
await import("./prepared/prepared-baseline-source.test.ts");
await import("./storage/full-sync-index-source.test.ts");
await import("./storage/owned-envelope-seal.test.ts");

await import("./storage/canonical-eligibility.test.ts");
