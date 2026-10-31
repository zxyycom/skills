await import("../transactions/transaction.test.ts");
await import("../relations/relation-review.test.ts");
await import("../transactions/transaction-recovery.test.ts");
await import("../transactions/transaction-sync.test.ts");
await import("../discard/discard.test.ts");
await import("../publication/publish.test.ts");
await import("../rename/rename.test.ts");
await import("../rename/rename-drift.test.ts");
await import("../rename/rename-recovery.test.ts");
await import("../rename/rename-validation.test.ts");

await import("../candidates/candidate-discard-transaction.test.ts");

await import("../transactions/transaction-boundaries.test.ts");

await import("../transactions/transaction-domain-boundaries.test.ts");
await import("../transactions/transaction-file-writer.test.ts");

await import("../transactions/transaction-creation-modes.test.ts");

await import("../transactions/strict-preparation.test.ts");

await import("../transactions/execution-entry-contract.test.ts");

await import("../rename/rename-phase-verification.test.ts");
await import("../discard/discard-phase-verification.test.ts");
await import("../resources/phases/resource-phase-verification.test.ts");

await import("../publication/local-publication.test.ts");

await import("../transactions/transaction-member-scan.test.ts");
