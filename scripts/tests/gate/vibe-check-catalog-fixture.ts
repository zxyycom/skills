export const expectedSemanticChecks: readonly (readonly [
  checkId: string,
  command: "bun" | "node" | "cargo",
  commandPath: string
])[] = [
  [
    "test:record-rust:delivery",
    "node",
    "./tools/record-cli/delivery/delivery.test.ts"
  ],
  [
    "test:record-rust:contracts",
    "node",
    "./tools/record-contracts/tests/schema.test.ts"
  ],
  [
    "test:record-rust:runtime",
    "node",
    "./scripts/lib/record-native/tests/runtime.test.ts"
  ],
  ["test:record-rust:format", "cargo", "--check"],
  ["test:record-rust:clippy", "cargo", "warnings"],
  ["test:record-rust:cargo", "cargo", "--include-ignored"],
  [
    "test:video-understanding:source-contracts",
    "bun",
    "./tools/video-understanding/tests/checks/source-contracts.ts"
  ],
  [
    "test:video-understanding:source-cli",
    "bun",
    "./tools/video-understanding/tests/checks/source-cli.ts"
  ],
  [
    "test:video-understanding:public-distribution",
    "bun",
    "./tools/video-understanding/tests/checks/public-distribution.ts"
  ],
  [
    "test:novel-cards:card-and-query-contract",
    "bun",
    "./tools/novel-cards/tests/checks/card-and-query-contract.ts"
  ],
  [
    "test:lightweight-judgment:request-and-response",
    "bun",
    "./tools/lightweight-judgment/tests/checks/request-and-response.ts"
  ],
  [
    "test:lightweight-judgment:public-distribution",
    "bun",
    "./tools/lightweight-judgment/tests/checks/public-distribution.ts"
  ],
  [
    "test:change-plan:artifact-and-active-plan-gates",
    "bun",
    "./tools/change-plan/tests/checks/artifact-and-active-plan-gates.ts"
  ],
  [
    "test:change-plan:lifecycle-finalize",
    "bun",
    "./tools/change-plan/tests/checks/lifecycle-finalize.ts"
  ],
  [
    "test:change-plan:public-distribution",
    "bun",
    "./tools/change-plan/tests/checks/public-distribution.ts"
  ],
  [
    "test:task-graph:index-and-projection",
    "bun",
    "./tools/task-graph/tests/checks/index-and-projection.ts"
  ],
  [
    "test:task-graph:task-lifecycle",
    "bun",
    "./tools/task-graph/tests/checks/task-lifecycle.ts"
  ],
  [
    "test:task-graph:runtime-and-store",
    "bun",
    "./tools/task-graph/tests/checks/runtime-and-store.ts"
  ],
  [
    "test:task-graph:native-store",
    "node",
    "./tools/task-graph/tests/store/native-store.test.ts"
  ],
  [
    "test:task-graph:cli-rendering",
    "bun",
    "./tools/task-graph/tests/checks/cli-rendering.ts"
  ],
  [
    "test:task-graph:pending-stage",
    "bun",
    "./tools/task-graph/tests/staging/staging.test.ts"
  ],
  [
    "test:task-graph:public-distribution",
    "bun",
    "./tools/task-graph/tests/checks/public-distribution.ts"
  ],
  [
    "test:task-graph:portable-build",
    "bun",
    "./tools/task-graph/tests/distribution/portable-build.test.ts"
  ],
  [
    "test:test-evidence:case-runtime",
    "bun",
    "./tools/test-evidence/tests/core.test.ts"
  ],
  [
    "test:test-evidence:public-boundary",
    "bun",
    "./tools/test-evidence/tests/public-boundary.test.ts"
  ],
  [
    "test:test-evidence:project-snapshot",
    "bun",
    "./scripts/test-evidence/snapshot/snapshot.test.ts"
  ],
  [
    "test:test-evidence:project-reference-check",
    "bun",
    "./scripts/test-evidence/check.test.ts"
  ],
  [
    "test:test-evidence:migration",
    "bun",
    "./scripts/test-evidence/migration/tests/migrate.test.ts"
  ],
  [
    "test:mcpshell:initializer",
    "bun",
    "./tools/mcpshell-workspace-bridge/tests/initializer/initializer.test.ts"
  ],
  [
    "test:mcpshell:runtime",
    "bun",
    "./tools/mcpshell-workspace-bridge/tests/runtime/runtime.test.ts"
  ],
  [
    "test:mcpshell:public-distribution",
    "bun",
    "./tools/mcpshell-workspace-bridge/tests/distribution/generated.test.ts"
  ]
] as const;

export const expectedSemanticPrerequisites: ReadonlyMap<
  string,
  readonly string[]
> = new Map([
  ["test:test-evidence:public-boundary", ["script:check:skill-updaters"]],
  [
    "test:lightweight-judgment:request-and-response",
    ["script:check:skill-updaters"]
  ],
  [
    "test:video-understanding:public-distribution",
    ["script:check:skill-updaters"]
  ],
  ["test:mcpshell:public-distribution", ["script:check:skill-updaters"]],
  ["test:novel-cards:card-and-query-contract", ["script:check:skill-updaters"]],
  [
    "test:lightweight-judgment:public-distribution",
    ["script:check:skill-updaters"]
  ],
  ["test:change-plan:public-distribution", ["script:check:skill-updaters"]],
  ["test:task-graph:public-distribution", ["script:check:skill-updaters"]]
]);
