await import("../queries/index-maintenance.test.ts");
await import("../queries/list-facets.test.ts");
await import("../queries/queries.test.ts");
await import("../cli/cli-output-trace.test.ts");

await import("../queries/query-snapshot.test.ts");
await import("../queries/sync-preflight-lock.test.ts");
await import("../queries/query-loaded-snapshot.test.ts");

await import("../queries/relation-filter-complexity.test.ts");

await import("../queries/index-schema.test.ts");

await import("../queries/lazy-relation-graph/context.test.ts");
await import("../queries/lazy-relation-graph/queries.test.ts");

await import("../queries/search/search-metadata-window.test.ts");

await import("../queries/discovery-dependencies.test.ts");

await import("../queries/acquisition-safety.test.ts");

await import("../queries/selected-local-contract.test.ts");

await import("../queries/canonical-sync-cost.test.ts");
