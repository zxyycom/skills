await import("./candidates/candidate.test.ts");
await import("./candidates/candidate-timestamp.test.ts");
await import("./candidates/candidate-read-context.test.ts");
await import("./cli/cli-generated.test.ts");
await import("./cli/cli-location-contract.test.ts");
await import("./cli/cli-index.test.ts");
await import("./cli/staging/cli-stage.test.ts");
await import("./discard/discard.test.ts");
await import("./query/index/index-query.test.ts");
await import("./query/index/index-relations.test.ts");
await import("./query/index/index-search.test.ts");
await import("./query/index/index-reader.test.ts");
await import("./query/index/index-selectors.test.ts");
await import("./query/index/index-state.test.ts");
await import("./query/current-index.test.ts");
await import("./query/list-facets.test.ts");
await import("./collection/parsing-directory.test.ts");
await import("./publication/publish.test.ts");
await import("./resources/resources.test.ts");
await import("./staging/staging.test.ts");
await import("./staging/staging-domain.test.ts");
await import("./staging/staging-representation.test.ts");
await import("./staging/staging-source-path.test.ts");
await import("./relations/relations.test.ts");
await import("./relations/relation-context.test.ts");
await import("./relations/relation-dedup.test.ts");
await import("./relations/relation-order.test.ts");
await import("./relations/relation-review.test.ts");
await import("./transactions/transaction.test.ts");
await import("./transactions/transaction-sync.test.ts");
await import("./transactions/transaction-recovery.test.ts");
await import("./rename/rename.test.ts");
await import("./rename/rename-validation.test.ts");
await import("./rename/rename-recovery.test.ts");
await import("./rename/rename-drift.test.ts");
await import("./transactions/strict-preparation.test.ts");

await import("./query/search-info.test.ts");

await import("./collection/acquisition-contract.test.ts");
await import("./collection/identity-membership.test.ts");
await import("./candidates/candidate-read-failure.test.ts");
await import("./query/snapshot-check-contract.test.ts");
await import("./staging/local-stage-contract.test.ts");
await import("./staging/staging-resource-safety.test.ts");

await import("./staging/phase-facts-contract.test.ts");

await import("./collection/history-prefix-contract.test.ts");
await import("./collection/history-pathspec-batching.test.ts");
await import("./resources/resource-identity-contract.test.ts");

await import("./resources/resource-failure-contract.test.ts");

await import("./staging/batch-stage-selectors.test.ts");
await import("./collection/batch-source-discovery.test.ts");

await import("./query/trace-output.test.ts");

await import("./cli/cli-boundaries.test.ts");

await import("./cli/cli-sync-preflight.test.ts");

await import("./cli/cli-candidate-workflows.test.ts");
await import("./cli/cli-relation-review.test.ts");
await import("./cli/cli-rename.test.ts");
await import("./cli/cli-relation-input.test.ts");
await import("./cli/staging/cli-stage-source-failure.test.ts");
await import("./cli/cli-publish.test.ts");

await import("./cli/staging/cli-stage-resource-failure.test.ts");
await import("./cli/search/cli-search-summary.test.ts");

await import("./cli/search/cli-search-defaults.test.ts");

await import("./candidates/candidate-discard-transaction.test.ts");
await import("./staging/staging-pending-refresh.test.ts");
await import("./staging/staging-pending-deletion.test.ts");

await import("./staging/staging-index-payload.test.ts");

await import("./transactions/result-integrity.test.ts");
await import("./transactions/transaction-boundaries.test.ts");

await import("./collection/discovery-dependencies.test.ts");

await import("./candidates/candidate-operations.test.ts");

await import("./transactions/transaction-domain-boundaries.test.ts");
await import("./transactions/transaction-file-writer.test.ts");

await import("./transactions/transaction-creation-modes.test.ts");

await import("./query/selected-local-contract.test.ts");

await import("./transactions/execution-entry-contract.test.ts");

await import("./rename/rename-phase-verification.test.ts");
await import("./discard/discard-phase-verification.test.ts");
await import("./resources/phases/resource-phase-verification.test.ts");

await import("./publication/local-publication.test.ts");

await import("./transactions/transaction-member-scan.test.ts");

await import("./query/selector-batch-cost.test.ts");

import "./candidates/candidate-resource-root.test.ts";
