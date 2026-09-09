import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import test from "node:test";
import "./lib/vibe-gate/impact.test.ts";
import "./lib/vibe-gate/release-test-batch.test.ts";
import "./vibe-check-proof-mode.test.ts";
import { fixtureGateWorkspaceSnapshot } from "./lib/vibe-gate/test-support.ts";
import {
  defineCheck,
  defineConfig,
  duplicateDetection,
  fileMetrics,
  functionMetrics,
  jsonSchemaValidation,
  jsonValidation,
  markdownLinkValidation,
  parseFileMetricsData,
  parseFunctionMetricsData,
  run,
  secretDetection
} from "@zxyycom/vibe-check";
import type {
  Check,
  ProjectDefinition,
  RunControls,
  RunResult
} from "@zxyycom/vibe-check";
import {
  automationCodeFiles,
  activationFlagForCheck,
  createGateDefinition,
  createVibeNativeChecks,
  gateResourceCapacities,
  gateCheckIds,
  historicalContentExclusions,
  investigationAuthoringDocumentExclusions,
  maintainedSecretFiles,
  productCodeFiles,
  releaseBunTestPackageFiles,
  releaseSnapshotCheckId,
  releaseTestBatchGroups,
  releaseTestBatchLeaderCheckId,
  releaseTestBatchResourceClaim,
  releaseGateResourceCapacities,
  releaseRequiredPackageScripts,
  releaseRequiredCheckIds,
  runGateCommand,
  semanticGateChecks,
  testCodeFiles,
  vibeNativeCheckIds,
  type GateCommandInvocation,
  type GateCommandRunner,
  type GateActivationPlan
} from "./lib/vibe-gate.ts";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease
} from "./lib/skill-package-release.ts";
import {
  createGateInvocationDirectory,
  gateInvocationOutputControls,
  resolveGateInvocation,
  runVibeCheck,
  type GateInvocation
} from "./vibe-check.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const aggregateOptions = {
  checks: "all",
  empty: "failed",
  mode: "all",
  notApplicable: "fail",
  unavailable: "fail"
} as const;

const noOutput = {
  diagnosticLogging: { enabled: false },
  machinePublication: { enabled: false },
  progressRendering: { enabled: false }
} as const;

function scriptForCommand(invocation: GateCommandInvocation): string | null {
  return invocation.command === "bun" && invocation.args[0] === "run"
    ? (invocation.args[1] ?? null)
    : null;
}

async function withTemporaryDirectory<T>(
  prefix: string,
  operation: (directory: string) => Promise<T>
): Promise<T> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(directory);
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
}

function runGit(directory: string, args: readonly string[]): void {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
}

function skillMarkdown(version: number, body: string): string {
  return [
    "---",
    "name: alpha",
    "metadata:",
    `  version: "${version}"`,
    "---",
    "",
    body,
    ""
  ].join("\n");
}

async function createReleaseRepository(
  directory: string,
  version: number = 1,
  body: string = "base"
): Promise<string> {
  const skillDirectory = path.join(directory, "skills", "alpha");
  await fs.mkdir(skillDirectory, { recursive: true });
  await fs.writeFile(
    path.join(skillDirectory, "SKILL.md"),
    skillMarkdown(version, body)
  );
  runGit(directory, ["init", "--quiet"]);
  runGit(directory, ["config", "user.email", "skills@example.test"]);
  runGit(directory, ["config", "user.name", "Skills Test"]);
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "--message", "base"]);
  return skillDirectory;
}

async function stageSkillMarkdown(
  directory: string,
  version: number,
  body: string
): Promise<void> {
  await fs.writeFile(
    path.join(directory, "skills", "alpha", "SKILL.md"),
    skillMarkdown(version, body)
  );
  runGit(directory, ["add", "skills/alpha/SKILL.md"]);
}

async function zipSkillMarkdown(directory: string): Promise<string> {
  return await zipSkillMarkdownFor(directory, "alpha");
}

async function zipSkillMarkdownFor(
  directory: string,
  skillName: string
): Promise<string> {
  const archive = unzipSync(
    await fs.readFile(path.join(directory, "dist", `${skillName}.zip`))
  );
  const contents = archive[`${skillName}/SKILL.md`];
  assert.ok(contents);
  return Buffer.from(contents).toString("utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!(await fileExists(filePath))) {
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for ${filePath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function completed(result: RunResult) {
  if (result.kind === "completed") {
    return result;
  }
  throw new Error("expected a completed Vibe result");
}

async function runDefinition(
  definition: ProjectDefinition,
  projectRoot: string,
  flags: readonly string[] = [],
  signal: AbortSignal = new AbortController().signal
) {
  return completed(
    await run(definition, {
      checkAggregation: { ...aggregateOptions, checks: "effective" },
      flags,
      outputs: noOutput,
      projectRoot,
      signal
    })
  );
}

function outcomeFor(result: ReturnType<typeof completed>, checkId: string) {
  const check = result.snapshot.checks.find(
    (candidate) => candidate.checkId === checkId
  );
  if (!check) {
    throw new Error(`missing Check outcome for ${checkId}`);
  }
  return check.outcome;
}

function releaseTerminalCheck(definition: ProjectDefinition): Check {
  const check = definition.checks.find(
    ({ checkId }) => checkId === "pack:skills"
  );
  if (!check) {
    throw new Error("missing release terminal Check");
  }
  return check;
}

function passingNativeChecks(): readonly Check[] {
  return vibeNativeCheckIds.map((checkId) =>
    defineCheck({
      checkId,
      displayName: checkId,
      execution() {
        return { status: "passed", data: { checkId } };
      }
    })
  );
}

function completedScript(exitCode = 0, output = ""): GateCommandRunner {
  return async () => ({ exitCode, output, status: "completed" });
}

type NativeBlockingCheckFixture = Readonly<{
  readonly check: Check;
  readonly introduceFinding: (directory: string) => Promise<void>;
  readonly prefix: string;
  readonly setup: (directory: string) => Promise<void>;
}>;

async function assertNativeBlockingCheckContract(
  fixture: NativeBlockingCheckFixture
): Promise<void> {
  await withTemporaryDirectory(fixture.prefix, async (directory) => {
    await fixture.setup(directory);
    runGit(directory, ["init"]);
    runGit(directory, ["add", "."]);
    const definition = defineConfig({
      checks: [fixture.check],
      outputs: noOutput
    });

    const passed = await runDefinition(definition, directory);
    assert.equal(passed.aggregate, "passed");
    assert.equal(passed.snapshot.checks[0]?.outcome.status, "passed");

    await fixture.introduceFinding(directory);
    runGit(directory, ["add", "."]);
    const failed = await runDefinition(definition, directory);
    assert.equal(failed.aggregate, "failed");
    assert.equal(failed.snapshot.checks[0]?.outcome.status, "failed");

    const unavailable = await runDefinition(
      definition,
      path.join(directory, "missing-root")
    );
    assert.equal(unavailable.aggregate, "failed");
    assert.equal(unavailable.snapshot.checks[0]?.outcome.status, "unavailable");
  });
}

const expectedSemanticGateChecks = [
  [
    undefined,
    "test:change-plan:artifact-and-active-plan-gates",
    "bun",
    [
      "./tools/change-plan/tests/markdown.test.ts",
      "./tools/change-plan/tests/metadata.test.ts",
      "./tools/change-plan/tests/check.test.ts",
      "./tools/change-plan/tests/git-distance.test.ts",
      "./tools/change-plan/tests/catalog.test.ts"
    ]
  ],
  [
    undefined,
    "test:change-plan:lifecycle-complete",
    "bun",
    [
      "./tools/change-plan/tests/lifecycle.test.ts",
      "./tools/change-plan/tests/complete.test.ts"
    ]
  ],
  [
    undefined,
    "test:change-plan:public-distribution",
    "bun",
    [
      "./tools/change-plan/tests/cli.test.ts",
      "./tools/change-plan/tests/generated-artifacts.test.ts"
    ]
  ],
  [
    undefined,
    "test:decision-records:record-and-established-graph",
    "bun",
    [
      "./tools/decision-records/tests/metadata.test.ts",
      "./tools/decision-records/tests/body-field-validation.test.ts",
      "./tools/decision-records/tests/type-path-invariants.test.ts",
      "./tools/decision-records/tests/record-guards.test.ts",
      "./tools/decision-records/tests/layout-index.test.ts",
      "./tools/decision-records/tests/relation-validation.test.ts",
      "./tools/decision-records/tests/state-snapshot.test.ts",
      "./tools/decision-records/tests/configured-decision-directory.test.ts",
      "./tools/decision-records/tests/filesystem-boundaries.test.ts"
    ]
  ],
  [
    undefined,
    "test:decision-records:query-and-index-projection",
    "bun",
    [
      "./tools/decision-records/tests/first-establishment.test.ts",
      "./tools/decision-records/tests/index-maintenance.test.ts",
      "./tools/decision-records/tests/list-facets.test.ts",
      "./tools/decision-records/tests/queries.test.ts"
    ]
  ],
  [
    undefined,
    "test:decision-records:lifecycle-and-recovery",
    "bun",
    [
      "./tools/decision-records/tests/activation-archive.test.ts",
      "./tools/decision-records/tests/candidate-lifecycle.test.ts",
      "./tools/decision-records/tests/candidate-scaffold.test.ts",
      "./tools/decision-records/tests/evolution.test.ts",
      "./tools/decision-records/tests/lifecycle-relations.test.ts",
      "./tools/decision-records/tests/rename.test.ts",
      "./tools/decision-records/tests/transaction-recovery.test.ts",
      "./tools/decision-records/tests/unrecorded-history.test.ts"
    ]
  ],
  [
    undefined,
    "test:decision-records:pending-stage",
    "bun",
    ["./tools/decision-records/tests/stage.test.ts"]
  ],
  [
    undefined,
    "test:decision-records:public-distribution",
    "bun",
    [
      "./tools/decision-records/tests/cli-args.test.ts",
      "./tools/decision-records/tests/generated-artifacts.test.ts"
    ]
  ],
  [
    undefined,
    "test:investigation-report:collection-and-resources",
    "bun",
    [
      "./tools/investigation-report/tests/candidate.test.ts",
      "./tools/investigation-report/tests/parsing-directory.test.ts",
      "./tools/investigation-report/tests/resources.test.ts",
      "./tools/investigation-report/tests/relations.test.ts"
    ]
  ],
  [
    undefined,
    "test:investigation-report:index-and-query",
    "bun",
    [
      "./tools/investigation-report/tests/index-query.test.ts",
      "./tools/investigation-report/tests/list-facets.test.ts"
    ]
  ],
  [
    undefined,
    "test:investigation-report:transactional-maintenance",
    "bun",
    [
      "./tools/investigation-report/tests/transaction.test.ts",
      "./tools/investigation-report/tests/discard.test.ts",
      "./tools/investigation-report/tests/publish.test.ts",
      "./tools/investigation-report/tests/rename.test.ts"
    ]
  ],
  [
    undefined,
    "test:investigation-report:pending-stage",
    "bun",
    ["./tools/investigation-report/tests/staging.test.ts"]
  ],
  [
    undefined,
    "test:investigation-report:cli-contract",
    "bun",
    ["./tools/investigation-report/tests/cli-generated.test.ts"]
  ],
  [
    undefined,
    "test:task-graph:index-and-projection",
    "bun",
    [
      "./tools/task-graph/tests/schema-index.test.ts",
      "./tools/task-graph/tests/graph-projection.test.ts"
    ]
  ],
  [
    undefined,
    "test:task-graph:task-lifecycle",
    "bun",
    [
      "./tools/task-graph/tests/lifecycle.test.ts",
      "./tools/task-graph/tests/task-removal.test.ts"
    ]
  ],
  [
    undefined,
    "test:task-graph:runtime-and-store",
    "bun",
    [
      "./tools/task-graph/tests/runtime.test.ts",
      "./tools/task-graph/tests/store.test.ts"
    ]
  ],
  [
    undefined,
    "test:task-graph:native-store",
    "node",
    ["./tools/task-graph/tests/native-store.test.ts"]
  ],
  [
    undefined,
    "test:task-graph:cli-rendering",
    "bun",
    [
      "./tools/task-graph/tests/cli.test.ts",
      "./tools/task-graph/tests/task-list-renderer.test.ts"
    ]
  ],
  [
    undefined,
    "test:task-graph:pending-stage",
    "bun",
    ["./tools/task-graph/tests/staging.test.ts"]
  ],
  [
    undefined,
    "test:task-graph:public-distribution",
    "bun",
    ["./tools/task-graph/tests/generated-artifacts.test.ts"]
  ],
  [
    undefined,
    "test:task-graph:portable-build",
    "bun",
    ["./tools/task-graph/tests/portable-build.test.ts"]
  ],
  [
    undefined,
    "test:test-evidence:case-runtime",
    "bun",
    ["./tools/test-evidence/tests/core.test.ts"]
  ],
  [
    undefined,
    "test:test-evidence:public-boundary",
    "bun",
    ["./tools/test-evidence/tests/public-boundary.test.ts"]
  ],
  [
    undefined,
    "test:test-evidence:project-snapshot",
    "bun",
    ["./scripts/test-evidence/snapshot.test.ts"]
  ],
  [
    undefined,
    "test:test-evidence:project-reference-check",
    "bun",
    ["./scripts/test-evidence/check.test.ts"]
  ],
  [
    undefined,
    "test:test-evidence:migration",
    "bun",
    ["./scripts/test-evidence/migrate.test.ts"]
  ]
] as const;

const expectedSemanticCommandPaths = new Map<string, string>([
  [
    "test:change-plan:artifact-and-active-plan-gates",
    "./tools/change-plan/tests/checks/artifact-and-active-plan-gates.ts"
  ],
  [
    "test:change-plan:lifecycle-complete",
    "./tools/change-plan/tests/checks/lifecycle-complete.ts"
  ],
  [
    "test:change-plan:public-distribution",
    "./tools/change-plan/tests/checks/public-distribution.ts"
  ],
  [
    "test:decision-records:record-and-established-graph",
    "./tools/decision-records/tests/checks/record-and-established-graph.ts"
  ],
  [
    "test:decision-records:query-and-index-projection",
    "./tools/decision-records/tests/checks/query-and-index-projection.ts"
  ],
  [
    "test:decision-records:lifecycle-and-recovery",
    "./tools/decision-records/tests/checks/lifecycle-and-recovery.ts"
  ],
  [
    "test:decision-records:pending-stage",
    "./tools/decision-records/tests/stage.test.ts"
  ],
  [
    "test:decision-records:public-distribution",
    "./tools/decision-records/tests/checks/public-distribution.ts"
  ],
  [
    "test:investigation-report:collection-and-resources",
    "./tools/investigation-report/tests/checks/collection-and-resources.ts"
  ],
  [
    "test:investigation-report:index-and-query",
    "./tools/investigation-report/tests/checks/index-and-query.ts"
  ],
  [
    "test:investigation-report:transactional-maintenance",
    "./tools/investigation-report/tests/checks/transactional-maintenance.ts"
  ],
  [
    "test:investigation-report:pending-stage",
    "./tools/investigation-report/tests/staging.test.ts"
  ],
  [
    "test:investigation-report:cli-contract",
    "./tools/investigation-report/tests/cli-generated.test.ts"
  ],
  [
    "test:task-graph:index-and-projection",
    "./tools/task-graph/tests/checks/index-and-projection.ts"
  ],
  [
    "test:task-graph:task-lifecycle",
    "./tools/task-graph/tests/checks/task-lifecycle.ts"
  ],
  [
    "test:task-graph:runtime-and-store",
    "./tools/task-graph/tests/checks/runtime-and-store.ts"
  ],
  [
    "test:task-graph:native-store",
    "./tools/task-graph/tests/native-store.test.ts"
  ],
  [
    "test:task-graph:cli-rendering",
    "./tools/task-graph/tests/checks/cli-rendering.ts"
  ],
  ["test:task-graph:pending-stage", "./tools/task-graph/tests/staging.test.ts"],
  [
    "test:task-graph:public-distribution",
    "./tools/task-graph/tests/generated-artifacts.test.ts"
  ],
  [
    "test:task-graph:portable-build",
    "./tools/task-graph/tests/portable-build.test.ts"
  ],
  [
    "test:test-evidence:case-runtime",
    "./tools/test-evidence/tests/core.test.ts"
  ],
  [
    "test:test-evidence:public-boundary",
    "./tools/test-evidence/tests/public-boundary.test.ts"
  ],
  [
    "test:test-evidence:project-snapshot",
    "./scripts/test-evidence/snapshot.test.ts"
  ],
  [
    "test:test-evidence:project-reference-check",
    "./scripts/test-evidence/check.test.ts"
  ],
  ["test:test-evidence:migration", "./scripts/test-evidence/migrate.test.ts"]
]);

const expectedSemanticPrerequisites = new Map<string, readonly string[]>([
  ["test:change-plan:public-distribution", ["script:check:change-plan-cli"]],
  [
    "test:decision-records:public-distribution",
    ["script:check:decision-records-cli"]
  ],
  ["test:task-graph:public-distribution", ["script:check:task-graph-cli"]]
]);

test("gate catalog keeps one complete Definition for base and release tags", async () => {
  const runner = completedScript();
  const nativeChecks = passingNativeChecks();
  const baseDefinition = createGateDefinition([], {
    nativeChecks,
    runCommand: runner
  });
  const releaseDefinition = createGateDefinition(["release"], {
    nativeChecks,
    runCommand: runner
  });
  const incrementalDefinition = createGateDefinition([], {
    activeCheckIds: ["secret-detection"],
    nativeChecks,
    runCommand: runner
  });
  const expectedSemanticCheckIds = expectedSemanticGateChecks.map(
    ([, checkId]) => checkId
  );
  const expectedCheckIds = [
    releaseSnapshotCheckId,
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map((script) => `script:${script}`),
    ...expectedSemanticCheckIds,
    "release:skill-version",
    "pack:skills"
  ];
  assert.deepEqual(
    baseDefinition.checks.map(({ checkId }) => checkId),
    expectedCheckIds
  );
  assert.deepEqual(
    releaseDefinition.checks.map(({ checkId }) => checkId),
    expectedCheckIds
  );
  assert.deepEqual(gateCheckIds(), expectedCheckIds);
  assert.deepEqual(
    incrementalDefinition.checks.find(
      ({ checkId }) => checkId === "secret-detection"
    )?.enabledByFlags,
    {
      flags: ["gate-activation:secret-detection"],
      mode: "all"
    }
  );
  assert.deepEqual(
    incrementalDefinition.checks.find(
      ({ checkId }) => checkId === "test:change-plan:public-distribution"
    )?.enabledByFlags,
    {
      flags: ["gate-activation:test:change-plan:public-distribution"],
      mode: "all",
      propagateDependsOn: true
    }
  );
  assert.throws(
    () =>
      createGateDefinition([], {
        activeCheckIds: ["release:skill-version"],
        nativeChecks,
        runCommand: runner
      }),
    /non-base Check/u
  );
  const incrementalResult = await runDefinition(
    incrementalDefinition,
    repositoryRoot,
    [activationFlagForCheck("secret-detection")]
  );
  assert.equal(
    outcomeFor(incrementalResult, "secret-detection").status,
    "passed"
  );
  assert.equal(
    outcomeFor(incrementalResult, "duplicate-detection").status,
    "not-applicable"
  );
  assert.equal(
    baseDefinition.checks.some(({ checkId }) => checkId === "pack:skills"),
    true
  );
  assert.equal(baseDefinition.scheduler.maxParallel, 4);
  assert.equal(baseDefinition.scheduler.admissionPolicy.kind, "custom");
  assert.deepEqual(
    baseDefinition.scheduler.resourceCapacities,
    gateResourceCapacities
  );
  assert.equal(releaseDefinition.scheduler.maxParallel, 4);
  assert.deepEqual(
    releaseDefinition.scheduler.resourceCapacities,
    releaseGateResourceCapacities
  );
  assert.deepEqual(baseDefinition.outputs, {
    diagnosticLogging: { enabled: false, directory: ".log/vibe-check" },
    machinePublication: {
      enabled: true,
      directory: ".log/vibe-check/publication"
    },
    progressRendering: {
      enabled: true,
      formatter: null,
      messagePreviewLimit: 5,
      recordPreviewLimit: 5,
      textPreviewCodePointLimit: 240
    }
  });
  assert.equal(releaseRequiredCheckIds.length, 59);
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === releaseSnapshotCheckId
    )?.dependsOn ?? [],
    []
  );
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === "release:skill-version"
    )?.dependsOn,
    [...releaseRequiredCheckIds, releaseSnapshotCheckId]
  );
  assert.deepEqual(releaseTerminalCheck(releaseDefinition).dependsOn, [
    "release:skill-version"
  ]);
  const releaseFlag = {
    flags: ["release"],
    mode: "all",
    propagateDependsOn: true
  };
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === "release:skill-version"
    )?.enabledByFlags,
    releaseFlag
  );
  assert.deepEqual(
    releaseTerminalCheck(releaseDefinition).enabledByFlags,
    releaseFlag
  );
  assert.deepEqual(
    releaseDefinition.checks.find(
      ({ checkId }) => checkId === releaseSnapshotCheckId
    )?.enabledByFlags,
    { flags: ["release"], mode: "all" }
  );
  assert.deepEqual(
    semanticGateChecks.map((check) => [
      check.requiredTag,
      check.checkId,
      check.command.command,
      check.command.args.at(-1),
      "dependsOn" in check ? check.dependsOn : []
    ]),
    expectedSemanticGateChecks.map(([requiredTag, checkId, command]) => [
      requiredTag,
      checkId,
      command,
      expectedSemanticCommandPaths.get(checkId),
      expectedSemanticPrerequisites.get(checkId) ?? []
    ])
  );
  assert.deepEqual(
    releaseDefinition.checks
      .filter(({ checkId }) => expectedSemanticPrerequisites.has(checkId))
      .map(({ checkId, dependsOn }) => [checkId, dependsOn]),
    [...expectedSemanticPrerequisites]
  );
  const batchedIds = new Set(
    releaseTestBatchGroups.map(({ checkId }) => checkId)
  );
  const batchLeader = releaseDefinition.checks.find(
    ({ checkId }) => checkId === releaseTestBatchLeaderCheckId
  );
  assert.deepEqual(batchLeader?.resourceClaims, releaseTestBatchResourceClaim);
  assert.equal(batchLeader?.observes, undefined);
  assert.ok(
    releaseDefinition.checks
      .filter(
        ({ checkId }) =>
          batchedIds.has(checkId) && checkId !== releaseTestBatchLeaderCheckId
      )
      .every(
        ({ observes, resourceClaims }) =>
          JSON.stringify(observes) ===
            JSON.stringify([releaseTestBatchLeaderCheckId]) &&
          resourceClaims === undefined
      )
  );
  assert.ok(
    releaseDefinition.checks
      .filter(
        ({ checkId }) =>
          (checkId.startsWith("script:") || checkId.startsWith("test:")) &&
          !batchedIds.has(checkId)
      )
      .every(
        ({ resourceClaims }) =>
          JSON.stringify(resourceClaims) ===
          JSON.stringify({ "external-process": 1, "cpu-work": 1 })
      )
  );
  assert.ok(
    baseDefinition.checks
      .filter(
        ({ checkId }) =>
          checkId.startsWith("script:") || checkId.startsWith("test:")
      )
      .every(
        ({ resourceClaims }) =>
          JSON.stringify(resourceClaims) ===
          JSON.stringify({ "external-process": 1 })
      )
  );
  for (const [, checkId, , files] of expectedSemanticGateChecks) {
    const commandPath = expectedSemanticCommandPaths.get(checkId);
    assert.ok(commandPath, `missing command path for ${checkId}`);
    if (commandPath?.includes("/checks/")) {
      const source = await fs.readFile(
        path.join(repositoryRoot, commandPath.slice(2)),
        "utf8"
      );
      const importedFiles = [
        ...source.matchAll(/await import\("(\.\.\/[^"\n]+)"\);/gu)
      ].map(
        ([, relativePath]) =>
          `./${path.posix.normalize(
            path.posix.join(
              path.posix.dirname(commandPath.slice(2)),
              relativePath
            )
          )}`
      );
      assert.deepEqual(importedFiles, files, checkId);
    } else {
      assert.deepEqual([commandPath], files, checkId);
    }
  }
  assert.deepEqual(
    [
      "change-plan",
      "decision-records",
      "investigation-report",
      "task-graph",
      "test-evidence"
    ].map(
      (tool) =>
        semanticGateChecks.filter(({ checkId }) =>
          checkId.startsWith(`test:${tool}:`)
        ).length
    ),
    [3, 5, 5, 8, 5]
  );
  const semanticFiles = expectedSemanticGateChecks.flatMap(
    ([, , , files]) => files
  );
  assert.equal(semanticFiles.length, 62);
  assert.equal(new Set(semanticFiles).size, semanticFiles.length);
  for (const tool of [
    "change-plan",
    "decision-records",
    "investigation-report",
    "task-graph",
    "test-evidence"
  ]) {
    const aggregatePath = `./tools/${tool}/tests/run.ts`;
    const aggregateSource = await fs.readFile(
      path.join(repositoryRoot, aggregatePath.slice(2)),
      "utf8"
    );
    const aggregateFiles = [
      ...aggregateSource.matchAll(/await import\("(\.\/[^"\n]+)"\);/gu)
    ]
      .map(
        ([, relativePath]) =>
          `./${path.posix.normalize(
            path.posix.join(
              path.posix.dirname(aggregatePath.slice(2)),
              relativePath
            )
          )}`
      )
      .sort();
    const expectedAggregateFiles = semanticFiles
      .filter(
        (file) =>
          file.startsWith(`./tools/${tool}/tests/`) &&
          file !== "./tools/task-graph/tests/native-store.test.ts"
      )
      .sort();
    assert.deepEqual(aggregateFiles, expectedAggregateFiles, aggregatePath);
  }
  assert.ok(
    semanticGateChecks
      .filter(({ command }) => command.command === "bun")
      .every(
        ({ command }) => command.args.length === 2 && command.args[0] === "test"
      )
  );
  assert.equal(
    semanticGateChecks.filter(({ command }) => command.command === "node")
      .length,
    1
  );
  assert.deepEqual(
    semanticGateChecks.find(({ command }) => command.command === "node")
      ?.command.args,
    ["--test", "./tools/task-graph/tests/native-store.test.ts"]
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "package.json"), "utf8")
  ) as { scripts: Readonly<Record<string, string>> };
  assert.equal(
    manifest.scripts["test:index-runtime-performance"],
    "bun test ./tools/index-runtime/tests/performance.test.ts"
  );
  assert.equal(
    new Set<string>(releaseRequiredPackageScripts).has(
      "test:index-runtime-performance"
    ),
    false
  );
  for (const [script, files] of Object.entries(releaseBunTestPackageFiles)) {
    assert.equal(manifest.scripts[script], `bun test ${files.join(" ")}`);
  }
  assert.deepEqual(
    releaseTestBatchGroups.map(({ checkId }) => checkId),
    [
      ...semanticGateChecks
        .filter(
          (check) => check.command.command === "bun" && !("dependsOn" in check)
        )
        .map(({ checkId }) => checkId),
      ...Object.keys(releaseBunTestPackageFiles).map(
        (script) => `script:${script}`
      )
    ]
  );
});

test("native flag selection keeps inactive release Checks visible without starting Check work", async () => {
  let originalPreflightCalls = 0;
  let releaseExecutionCalls = 0;
  const definition = defineConfig({
    checks: [
      defineCheck({
        checkId: "base",
        displayName: "base",
        execution: () => ({ status: "passed" as const, data: {} })
      }),
      defineCheck({
        checkId: "release",
        displayName: "release",
        enabledByFlags: { flags: ["release"], mode: "all" },
        preflight: () => {
          originalPreflightCalls += 1;
          return { status: "success" as const, preparedOptions: {} };
        },
        execution: () => {
          releaseExecutionCalls += 1;
          return { status: "passed" as const, data: {} };
        }
      })
    ],
    outputs: noOutput
  });
  const result = completed(
    await run(definition, {
      checkAggregation: { ...aggregateOptions, checks: "effective" },
      flags: [],
      outputs: noOutput,
      projectRoot: repositoryRoot
    })
  );
  assert.equal(result.aggregate, "passed");
  assert.equal(result.snapshot.checks.length, 2);
  assert.equal(outcomeFor(result, "release").status, "not-applicable");
  assert.equal(
    result.checkDurations.find(({ checkId }) => checkId === "release")
      ?.durationMs,
    null
  );
  assert.equal(originalPreflightCalls, 0);
  assert.equal(releaseExecutionCalls, 0);
  const releaseOutcome = outcomeFor(result, "release");
  if (releaseOutcome.status !== "not-applicable") {
    throw new Error("expected inactive release Check to be not-applicable");
  }
  assert.equal(releaseOutcome.reason?.code, "flag-condition-not-matched");
});

test("package script adapter maps terminal results and settles independent Checks", async () => {
  await withTemporaryDirectory("skills-vibe-adapter-", async (directory) => {
    const calls: GateCommandInvocation[] = [];
    const failedScript = "test:relation-graph";
    const failedOutput = [
      "omitted-1",
      "omitted-2",
      "detail-1",
      "detail-2",
      "detail-3",
      "detail-4"
    ].join("\n");
    const failedResult = await runDefinition(
      createGateDefinition([], {
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) => {
          calls.push(invocation);
          return {
            exitCode: scriptForCommand(invocation) === failedScript ? 1 : 0,
            output:
              scriptForCommand(invocation) === failedScript
                ? failedOutput
                : `${scriptForCommand(invocation)} output`,
            status: "completed"
          };
        }
      }),
      directory
    );

    assert.equal(failedResult.aggregate, "failed");
    assert.equal(
      outcomeFor(failedResult, `script:${failedScript}`).status,
      "failed"
    );
    assert.deepEqual(
      failedResult.checkMessages
        .filter(({ checkId }) => checkId === `script:${failedScript}`)
        .map(({ code, message }) => ({ code, message })),
      [
        {
          code: "package-script-exit-nonzero",
          message:
            "bun run test:relation-graph exited with code 1. Run bun run test:relation-graph directly for its full diagnostic."
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "…detail-1"
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "detail-2"
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "detail-3"
        },
        {
          code: "package-script-exit-nonzero-detail",
          message: "detail-4"
        }
      ]
    );
    assert.ok(
      failedResult.checkMessages.every(
        ({ message }) => !/[\n\r\u2028\u2029]/u.test(message)
      )
    );
    assert.equal(outcomeFor(failedResult, "script:lint").status, "passed");
    assert.ok(
      calls
        .filter((invocation) => scriptForCommand(invocation) !== null)
        .every(
          (invocation) =>
            invocation.command === "bun" &&
            invocation.args[0] === "run" &&
            invocation.args[1] === scriptForCommand(invocation)
        )
    );
    assert.ok(
      calls.some(
        (invocation) =>
          invocation.command === "bun" &&
          invocation.args[0] === "test" &&
          scriptForCommand(invocation) === null
      )
    );

    const unavailableResult = await runDefinition(
      createGateDefinition([], {
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) =>
          scriptForCommand(invocation) === failedScript
            ? {
                output: "Bun is unavailable",
                reason: "gate-command-start-failed",
                status: "unavailable"
              }
            : { exitCode: 0, output: "", status: "completed" }
      }),
      directory
    );

    assert.equal(unavailableResult.aggregate, "failed");
    assert.deepEqual(outcomeFor(unavailableResult, `script:${failedScript}`), {
      reason: { code: "package-script-start-failed" },
      status: "unavailable"
    });
    assert.equal(outcomeFor(unavailableResult, "script:lint").status, "passed");
  });
});

test("public distribution Checks require successful generation Checks", async () => {
  await withTemporaryDirectory(
    "skills-vibe-distribution-prerequisites-",
    async (directory) => {
      for (const [
        consumerCheckId,
        prerequisites
      ] of expectedSemanticPrerequisites) {
        const [prerequisite] = prerequisites;
        const consumerPath = expectedSemanticCommandPaths.get(consumerCheckId);
        if (consumerPath === undefined) {
          throw new Error(
            `missing consumer command path for ${consumerCheckId}`
          );
        }
        for (const behavior of ["passed", "failed", "unavailable"] as const) {
          const calls: GateCommandInvocation[] = [];
          const result = await runDefinition(
            createGateDefinition(["release"], {
              batchReleaseTests: false,
              nativeChecks: passingNativeChecks(),
              runCommand: async (invocation) => {
                calls.push(invocation);
                if (
                  scriptForCommand(invocation) !==
                  prerequisite.slice("script:".length)
                ) {
                  return { exitCode: 0, output: "", status: "completed" };
                }
                if (behavior === "failed") {
                  return {
                    exitCode: 1,
                    output: "generated artifact drift",
                    status: "completed"
                  };
                }
                if (behavior === "unavailable") {
                  return {
                    output: "generation command unavailable",
                    reason: "gate-command-start-failed",
                    status: "unavailable"
                  };
                }
                return {
                  exitCode: 0,
                  output: "",
                  status: "completed"
                };
              }
            }),
            directory,
            ["release"]
          );

          assert.equal(outcomeFor(result, prerequisite).status, behavior);
          assert.equal(
            outcomeFor(result, consumerCheckId).status,
            behavior === "passed" ? "passed" : "unavailable"
          );
          assert.equal(
            calls.filter(
              (invocation) =>
                scriptForCommand(invocation) ===
                prerequisite.slice("script:".length)
            ).length,
            1,
            prerequisite
          );
          assert.equal(
            calls.filter(
              (invocation) =>
                invocation.command === "bun" &&
                invocation.args[0] === "test" &&
                invocation.args[1] === consumerPath
            ).length,
            behavior === "passed" ? 1 : 0,
            `${consumerCheckId} execution after ${prerequisite} ${behavior}`
          );
        }
      }
    }
  );
});

test("package script runner waits for a cancelled child to close", async () => {
  await withTemporaryDirectory("skills-vibe-cancel-", async (directory) => {
    const marker = path.join(directory, "child-state.txt");
    const scriptPath = path.join(directory, "wait-for-cancellation.ts");
    await fs.writeFile(
      scriptPath,
      [
        'import { writeFileSync } from "node:fs";',
        `const marker = ${JSON.stringify(marker)};`,
        'writeFileSync(marker, "started\\n");',
        'process.on("SIGTERM", () => {',
        "  setTimeout(() => {",
        '    writeFileSync(marker, "terminated\\n");',
        "    process.exit(0);",
        "  }, 150);",
        "});",
        "setInterval(() => {}, 1_000);",
        ""
      ].join("\n"),
      "utf8"
    );

    const controller = new AbortController();
    const running = runGateCommand({
      args: ["run", scriptPath],
      command: "bun",
      cwd: directory,
      signal: controller.signal
    });
    await waitForFile(marker);
    controller.abort();

    assert.deepEqual(await running, {
      output: "",
      reason: "gate-command-cancelled",
      status: "unavailable"
    });
    assert.equal(await fs.readFile(marker, "utf8"), "terminated\n");
  });
});

test("command runner keeps a bounded diagnostic tail and writes the complete Check transcript", async () => {
  await withTemporaryDirectory("skills-vibe-transcript-", async (directory) => {
    const artifactDirectory = path.join(directory, "checks", "fixture");
    const result = await runGateCommand({
      args: [
        "-e",
        `process.stdout.write("start:" + "x".repeat(5000) + ":end\\n"); process.stderr.write("stderr-detail\\n")`
      ],
      artifactDirectory,
      command: "node",
      cwd: directory,
      signal: new AbortController().signal
    });

    assert.equal(result.status, "completed");
    assert.equal(result.output.startsWith("…"), true);
    assert.match(result.output, /:end\nstderr-detail\n$/u);
    assert.equal(result.transcript, "checks/fixture/process.log");
    const transcript = await fs.readFile(
      path.join(artifactDirectory, "process.log"),
      "utf8"
    );
    assert.match(transcript, /start:x{5000}:end/u);
    assert.match(transcript, /--- stderr ---\nstderr-detail/u);
    assert.match(transcript, /status: exited 0/u);

    assert.deepEqual(
      await runGateCommand({
        args: ["-e", 'process.stdout.write("must-not-run")'],
        artifactDirectory,
        command: "node",
        cwd: directory,
        signal: new AbortController().signal
      }),
      {
        output: "",
        reason: "gate-command-transcript-unavailable",
        status: "unavailable"
      }
    );
  });
});

test("CLI parses release tags and compatibility alias, then maps Vibe results to exit codes", async () => {
  const diagnostics: string[] = [];
  const information: string[] = [];
  assert.equal(
    createGateInvocationDirectory(
      "/workspace",
      new Date("2026-09-09T01:02:03.456Z"),
      "fixture-id"
    ),
    path.join(
      "/workspace",
      ".log/vibe-check/invocations/20260909T010203456Z-fixture-id"
    )
  );
  let selectedInvocation: GateInvocation | null = null;
  const passedDefinition = defineConfig({
    checks: [
      defineCheck({
        checkId: "passed",
        displayName: "passed",
        execution() {
          return { status: "passed", data: { value: true } };
        }
      })
    ],
    outputs: noOutput
  });
  const failedDefinition = defineConfig({
    checks: [
      defineCheck({
        checkId: "failed",
        displayName: "failed",
        execution() {
          return { status: "failed", data: { value: false } };
        }
      })
    ],
    outputs: noOutput
  });
  const invalidDefinition = defineConfig({
    checks: [
      defineCheck({
        checkId: "duplicate",
        displayName: "first duplicate",
        execution() {
          return { status: "passed", data: { value: true } };
        }
      }),
      defineCheck({
        checkId: "duplicate",
        displayName: "second duplicate",
        execution() {
          return { status: "passed", data: { value: true } };
        }
      })
    ],
    outputs: noOutput
  });
  const unknownDependencyDefinition = defineConfig({
    checks: [
      defineCheck({
        checkId: "consumer",
        dependsOn: ["missing-prerequisite"],
        displayName: "consumer with an unknown prerequisite",
        execution() {
          return { status: "passed", data: { value: true } };
        }
      })
    ],
    outputs: noOutput
  });
  let invocationSequence = 0;
  const dependencies = {
    createInvocationDirectory() {
      invocationSequence += 1;
      return path.join(
        os.tmpdir(),
        `skills-vibe-cli-${process.pid}-${invocationSequence}`
      );
    },
    createDefinition(invocation: GateInvocation) {
      selectedInvocation = invocation;
      return passedDefinition;
    },
    prepareActivation: false as const,
    reportError(message: string) {
      diagnostics.push(message);
    },
    reportInfo(message: string) {
      information.push(message);
    },
    async runProject(definition: ProjectDefinition, controls: RunControls) {
      return await run(definition, {
        ...controls,
        checkAggregation: aggregateOptions
      });
    }
  };

  assert.deepEqual(resolveGateInvocation([]), {
    cold: false,
    diagnosticLog: false,
    tags: []
  });
  assert.deepEqual(resolveGateInvocation(["--diagnostic-log"]), {
    cold: false,
    diagnosticLog: true,
    tags: []
  });
  assert.deepEqual(resolveGateInvocation(["--full"]), {
    baselineRef: "HEAD",
    cold: false,
    diagnosticLog: false,
    tags: ["release"]
  });
  assert.deepEqual(resolveGateInvocation(["--tag", "release"]), {
    baselineRef: "HEAD",
    cold: false,
    diagnosticLog: false,
    tags: ["release"]
  });
  assert.deepEqual(
    resolveGateInvocation([
      "--diagnostic-log",
      "--baseline-ref",
      "origin/release",
      "--full"
    ]),
    {
      baselineRef: "origin/release",
      cold: false,
      diagnosticLog: true,
      tags: ["release"]
    }
  );
  assert.deepEqual(resolveGateInvocation(["--full", "--cold"]), {
    baselineRef: "HEAD",
    cold: true,
    diagnosticLog: false,
    tags: ["release"]
  });
  assert.equal(resolveGateInvocation(["--cold"]), null);
  assert.equal(
    resolveGateInvocation(["--baseline-ref", "origin/release"]),
    null
  );
  assert.equal(
    resolveGateInvocation([
      "--diagnostic-log",
      "--baseline-ref",
      "origin/release"
    ]),
    null
  );
  assert.equal(
    resolveGateInvocation([
      "--baseline-ref",
      "origin/release",
      "--diagnostic-log"
    ]),
    null
  );
  for (const invalidBaseline of [
    "",
    " origin/release",
    "origin/release ",
    "-origin/release",
    "origin/release\0suffix",
    "origin/release\nsuffix",
    "origin/release\rsuffix"
  ]) {
    assert.equal(
      resolveGateInvocation(["--full", "--baseline-ref", invalidBaseline]),
      null
    );
  }
  assert.equal(
    resolveGateInvocation(["--full", "--baseline-ref", "--full"]),
    null
  );
  assert.equal(resolveGateInvocation(["--tag"]), null);
  assert.equal(resolveGateInvocation(["--tag", "unknown"]), null);
  assert.equal(
    resolveGateInvocation(["--tag", "release", "--tag", "release"]),
    null
  );
  assert.equal(resolveGateInvocation(["--tag", "release", "--full"]), null);
  assert.equal(
    resolveGateInvocation(["--diagnostic-log", "--diagnostic-log"]),
    null
  );
  assert.equal(await runVibeCheck([], dependencies), 0);
  assert.deepEqual(selectedInvocation, {
    cold: false,
    diagnosticLog: false,
    tags: []
  });
  assert.match(information.at(-1) ?? "", /^Vibe Check artifacts: /u);
  assert.equal(
    await runVibeCheck(
      ["--full", "--baseline-ref", "origin/release"],
      dependencies
    ),
    0
  );
  assert.deepEqual(selectedInvocation, {
    baselineRef: "origin/release",
    cold: false,
    diagnosticLog: false,
    tags: ["release"]
  });
  information.length = 0;
  let diagnosticControls: unknown;
  let diagnosticInvocationDirectory = "";
  await withTemporaryDirectory(
    "skills-vibe-diagnostic-log-",
    async (directory) => {
      diagnosticInvocationDirectory = path.join(directory, "invocation");
      assert.equal(
        await runVibeCheck(["--diagnostic-log"], {
          ...dependencies,
          createInvocationDirectory: () => diagnosticInvocationDirectory,
          async runProject(
            definition: ProjectDefinition,
            controls: RunControls
          ) {
            diagnosticControls = controls;
            return run(definition, {
              ...controls,
              checkAggregation: aggregateOptions,
              projectRoot: directory
            });
          }
        }),
        0
      );
    }
  );
  assert.deepEqual(selectedInvocation, {
    cold: false,
    diagnosticLog: true,
    tags: []
  });
  assert.ok(diagnosticControls && typeof diagnosticControls === "object");
  assert.deepEqual(diagnosticControls, {
    checkAggregation: {
      checks: "effective",
      empty: "failed",
      mode: "all",
      notApplicable: "fail",
      unavailable: "fail"
    },
    ...gateInvocationOutputControls(diagnosticInvocationDirectory, true),
    flags: [],
    projectRoot: repositoryRoot
  });
  assert.match(information.at(-3) ?? "", /^Vibe Check artifacts: /u);
  assert.match(
    information.at(-2) ?? "",
    /^Vibe Check diagnostic log \(core\): .*core\.log$/u
  );
  assert.match(
    information.at(-1) ?? "",
    /^Vibe Check diagnostic log \(scheduler\): .*scheduler\.log$/u
  );
  const failedDiagnostics: string[] = [];
  const failedInformation: string[] = [];
  await withTemporaryDirectory(
    "skills-vibe-diagnostic-log-failure-",
    async (directory) => {
      assert.equal(
        await runVibeCheck(["--diagnostic-log"], {
          createDefinition: () => failedDefinition,
          createInvocationDirectory: () => path.join(directory, "invocation"),
          prepareActivation: false,
          reportError: (message) => failedDiagnostics.push(message),
          reportInfo: (message) => failedInformation.push(message),
          async runProject(
            definition: ProjectDefinition,
            controls: RunControls
          ) {
            return run(definition, {
              ...controls,
              checkAggregation: aggregateOptions,
              projectRoot: directory
            });
          }
        }),
        1
      );
    }
  );
  assert.match(
    failedDiagnostics.at(-1) ?? "",
    /Vibe Check gate failed: failed/u
  );
  assert.match(failedInformation.at(-3) ?? "", /^Vibe Check artifacts: /u);
  assert.match(
    failedInformation.at(-2) ?? "",
    /^Vibe Check diagnostic log \(core\): .*core\.log$/u
  );
  assert.match(
    failedInformation.at(-1) ?? "",
    /^Vibe Check diagnostic log \(scheduler\): .*scheduler\.log$/u
  );
  const configurationDiagnostics: string[] = [];
  const configurationInformation: string[] = [];
  assert.equal(
    await runVibeCheck(["--diagnostic-log"], {
      createDefinition: () => passedDefinition,
      createInvocationDirectory: () =>
        path.join(os.tmpdir(), "skills-vibe-invalid-controls"),
      reportError: (message) => configurationDiagnostics.push(message),
      reportInfo: (message) => configurationInformation.push(message),
      prepareActivation: false,
      async runProject(_definition: ProjectDefinition, controls: RunControls) {
        return run({}, controls);
      }
    }),
    1
  );
  assert.match(
    configurationDiagnostics.at(-1) ?? "",
    /Vibe Check invocation failed: /u
  );
  assert.deepEqual(configurationInformation, []);
  let invalidDefinitionCalls = 0;
  assert.equal(
    await runVibeCheck(["--unknown"], {
      createDefinition: () => {
        invalidDefinitionCalls += 1;
        return passedDefinition;
      },
      reportError: (message) => diagnostics.push(message)
    }),
    1
  );
  assert.equal(invalidDefinitionCalls, 0);
  assert.match(
    diagnostics.at(-1) ?? "",
    /Usage: bun run check \[--tag release\]/u
  );
  assert.equal(
    await runVibeCheck(["--diagnostic-log", "--diagnostic-log"], {
      createDefinition: () => {
        invalidDefinitionCalls += 1;
        return passedDefinition;
      },
      reportError: (message) => diagnostics.push(message)
    }),
    1
  );
  assert.equal(invalidDefinitionCalls, 0);
  assert.match(
    diagnostics.at(-1) ?? "",
    /Usage: bun run check \[--tag release\]/u
  );
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => failedDefinition,
      createInvocationDirectory: () => dependencies.createInvocationDirectory(),
      prepareActivation: false,
      reportError: (message) => diagnostics.push(message),
      reportInfo: () => undefined
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check gate failed: failed/u);
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => invalidDefinition,
      createInvocationDirectory: () => dependencies.createInvocationDirectory(),
      prepareActivation: false,
      reportError: (message) => diagnostics.push(message),
      reportInfo: () => undefined
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => unknownDependencyDefinition,
      createInvocationDirectory: () => dependencies.createInvocationDirectory(),
      prepareActivation: false,
      reportError: (message) => diagnostics.push(message),
      reportInfo: () => undefined
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);

  await withTemporaryDirectory(
    "skills-vibe-incremental-cli-",
    async (directory) => {
      const activationPlan: GateActivationPlan = {
        activeCheckIds: ["passed"],
        cacheDirectory: path.join(directory, "cache"),
        decisions: [
          {
            action: "execute",
            checkId: "passed",
            fingerprint: "fixture-fingerprint",
            reason: "inputs-changed"
          },
          {
            action: "reuse",
            checkId: "reused",
            fingerprint: "reused-fingerprint",
            reason: "unchanged-success"
          }
        ],
        kind: "incremental",
        snapshot: fixtureGateWorkspaceSnapshot()
      };
      const selectiveDefinition = defineConfig({
        checks: [
          defineCheck({
            checkId: "passed",
            displayName: "passed",
            enabledByFlags: {
              flags: [activationFlagForCheck("passed")],
              mode: "all"
            },
            execution() {
              return { status: "passed", data: { value: true } };
            }
          }),
          defineCheck({
            checkId: "reused",
            displayName: "reused",
            enabledByFlags: {
              flags: [activationFlagForCheck("reused")],
              mode: "all"
            },
            execution() {
              throw new Error("a reused Check must not execute");
            }
          })
        ],
        outputs: noOutput
      });
      const incrementalInformation: string[] = [];
      const invocationDirectory = path.join(directory, "invocation");
      let publishedPassedIds: ReadonlySet<string> | null = null;
      assert.equal(
        await runVibeCheck([], {
          createDefinition(_invocation, selectedPlan) {
            assert.equal(selectedPlan, activationPlan);
            return selectiveDefinition;
          },
          createInvocationDirectory: () => invocationDirectory,
          prepareActivation: async () => activationPlan,
          publishReceipts: async (_plan, passedIds) => {
            publishedPassedIds = passedIds;
            return { published: true, receiptCount: 1 };
          },
          reportInfo: (message) => incrementalInformation.push(message),
          async runProject(definition, controls) {
            assert.deepEqual(controls.flags, [
              activationFlagForCheck("passed")
            ]);
            return await run(definition, {
              ...controls,
              outputs: noOutput
            });
          }
        }),
        0
      );
      assert.deepEqual([...(publishedPassedIds ?? [])], ["passed"]);
      assert.match(
        incrementalInformation[0] ?? "",
        /execute 1, reuse 1, fallback 0/u
      );
      const summary = JSON.parse(
        await fs.readFile(
          path.join(invocationDirectory, "machine", "gate-incremental.json"),
          "utf8"
        )
      ) as { mode?: unknown; publication?: unknown };
      assert.deepEqual(summary, {
        counts: { execute: 1, fallback: 0, firstRun: 0, reuse: 1 },
        decisions: activationPlan.decisions,
        fallbackDetail: null,
        mode: "incremental",
        publication: { published: true, receiptCount: 1 },
        releaseTestBatchProof: null
      });

      const reusePlan: GateActivationPlan = {
        ...activationPlan,
        activeCheckIds: [],
        decisions: [
          {
            action: "reuse",
            checkId: "reused",
            fingerprint: "reused-fingerprint",
            reason: "unchanged-success"
          }
        ]
      };
      assert.equal(
        await runVibeCheck([], {
          createDefinition: () => selectiveDefinition,
          createInvocationDirectory: () => path.join(directory, "reuse"),
          prepareActivation: async () => reusePlan,
          publishReceipts: async (_plan, passedIds) => {
            assert.deepEqual([...passedIds], []);
            return { published: true, receiptCount: 1 };
          },
          reportInfo: () => undefined,
          async runProject(definition, controls) {
            assert.equal(controls.checkAggregation?.empty, "passed");
            return await run(definition, { ...controls, outputs: noOutput });
          }
        }),
        0
      );

      const fallbackPlan: GateActivationPlan = {
        activeCheckIds: ["passed"],
        cacheDirectory: path.join(directory, "fallback-cache"),
        decisions: [
          {
            action: "execute",
            checkId: "passed",
            fingerprint: null,
            reason: "snapshot-unavailable"
          }
        ],
        fallbackDetail: "required tool probe failed",
        kind: "fallback",
        snapshot: null
      };
      const fallbackDirectory = path.join(directory, "fallback");
      const fallbackInformation: string[] = [];
      assert.equal(
        await runVibeCheck([], {
          createDefinition: () => passedDefinition,
          createInvocationDirectory: () => fallbackDirectory,
          prepareActivation: async () => fallbackPlan,
          publishReceipts: async () => ({
            published: false,
            reason: "not-incremental"
          }),
          reportInfo: (message) => fallbackInformation.push(message),
          async runProject(definition, controls) {
            return await run(definition, { ...controls, outputs: noOutput });
          }
        }),
        0
      );
      assert.match(
        fallbackInformation[0] ?? "",
        /Snapshot fallback: required tool probe failed/u
      );
      const fallbackSummary = JSON.parse(
        await fs.readFile(
          path.join(fallbackDirectory, "machine", "gate-incremental.json"),
          "utf8"
        )
      ) as { fallbackDetail?: unknown };
      assert.equal(
        fallbackSummary.fallbackDetail,
        "required tool probe failed"
      );
    }
  );
});

test("release prepare runs before terminal authorization and package", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-timing-",
    async (directory) => {
      await createReleaseRepository(directory);
      const definition = createGateDefinition(["release"], {
        baselineRef: "HEAD",
        batchReleaseTests: false,
        nativeChecks: passingNativeChecks(),
        runCommand: completedScript()
      });
      const prepare = definition.checks.find(
        ({ checkId }) => checkId === releaseSnapshotCheckId
      );
      const version = definition.checks.find(
        ({ checkId }) => checkId === "release:skill-version"
      );
      assert.deepEqual(prepare?.dependsOn ?? [], []);
      assert.deepEqual(version?.dependsOn, [
        ...releaseRequiredCheckIds,
        releaseSnapshotCheckId
      ]);
      assert.deepEqual(releaseTerminalCheck(definition).dependsOn, [
        "release:skill-version"
      ]);
      assert.equal(
        (await runDefinition(definition, directory, ["release"])).aggregate,
        "passed"
      );
    }
  );
});

test("release authorization and package use the snapshot captured before the index changes", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-snapshot-",
    async (directory) => {
      await createReleaseRepository(directory, 2, "captured content");
      await stageSkillMarkdown(directory, 2, "captured content");
      let packCalls = 0;
      const result = await runDefinition(
        createGateDefinition(["release"], {
          batchReleaseTests: false,
          nativeChecks: passingNativeChecks(),
          prepareRelease: async (workspaceRoot, baselineRef) => {
            const prepared = await prepareSkillPackageRelease(
              workspaceRoot,
              baselineRef
            );
            await stageSkillMarkdown(workspaceRoot, 3, "later index content");
            return prepared;
          },
          packRelease: async (prepared, workspaceRoot) => {
            packCalls += 1;
            return await packSkillPackageSnapshot(
              prepared.snapshot,
              path.join(workspaceRoot, "dist")
            );
          },
          runCommand: completedScript()
        }),
        directory,
        ["release"]
      );
      assert.equal(result.aggregate, "passed");
      assert.equal(packCalls, 1);
      assert.match(await zipSkillMarkdown(directory), /captured content/u);
      assert.match(
        await fs.readFile(
          path.join(directory, "skills", "alpha", "SKILL.md"),
          "utf8"
        ),
        /later index content/u
      );
    }
  );
});

test("release preparation or version failure blocks packaging", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-blocks-",
    async (directory) => {
      await createReleaseRepository(directory);
      await stageSkillMarkdown(
        directory,
        1,
        "content changed without version bump"
      );
      const versionFailed = await runDefinition(
        createGateDefinition(["release"], {
          batchReleaseTests: false,
          nativeChecks: passingNativeChecks(),
          runCommand: completedScript()
        }),
        directory,
        ["release"]
      );
      assert.equal(
        outcomeFor(versionFailed, "release:skill-version").status,
        "failed"
      );
      const versionMessages = versionFailed.checkMessages.filter(
        ({ checkId }) => checkId === "release:skill-version"
      );
      assert.ok(versionMessages.length > 1);
      assert.ok(
        versionMessages.every(
          ({ message }) => !/[\n\r\u2028\u2029]/u.test(message)
        )
      );
      assert.notEqual(
        outcomeFor(versionFailed, "pack:skills").status,
        "passed"
      );
      assert.equal(await fileExists(path.join(directory, "dist")), false);

      const unavailable = await runDefinition(
        createGateDefinition(["release"], {
          batchReleaseTests: false,
          nativeChecks: passingNativeChecks(),
          prepareRelease: async () => {
            throw new Error("Git resolver unavailable");
          },
          runCommand: completedScript()
        }),
        directory,
        ["release"]
      );
      assert.equal(
        outcomeFor(unavailable, releaseSnapshotCheckId).status,
        "unavailable"
      );
      assert.notEqual(outcomeFor(unavailable, "pack:skills").status, "passed");
    }
  );
});

test("duplicate detection blocks findings and fails closed when unavailable", async () => {
  const duplicatedSource = [
    "export function fixture(value: number): number {",
    "  const alpha = value + 1;",
    "  const beta = alpha + 2;",
    "  const gamma = beta + 3;",
    "  const delta = gamma + 4;",
    "  const epsilon = delta + 5;",
    "  const zeta = epsilon + 6;",
    "  const eta = zeta + 7;",
    "  const theta = eta + 8;",
    "  return theta;",
    "}",
    ""
  ].join("\n");
  await assertNativeBlockingCheckContract({
    check: duplicateDetection({
      cache: { enabled: false },
      codeAreas: {
        fixture: {
          files: {
            exclude: [],
            include: ["**/*.ts"],
            source: "git-worktree"
          },
          findingPolicy: "blocking",
          minimumLines: 2,
          minimumTokens: 10
        }
      }
    }),
    async introduceFinding(directory) {
      await fs.writeFile(
        path.join(directory, "duplicate.ts"),
        duplicatedSource,
        "utf8"
      );
    },
    prefix: "skills-vibe-duplicate-",
    async setup(directory) {
      await Promise.all([
        fs.writeFile(
          path.join(directory, "fixture.ts"),
          duplicatedSource,
          "utf8"
        ),
        fs.writeFile(
          path.join(directory, "distinct.ts"),
          "export const distinct = 1;\n",
          "utf8"
        )
      ]);
    }
  });
});

test("secret detection blocks private-key findings and fails closed when unavailable", async () => {
  const privateKey = [
    `-----BEGIN ${"PRIVATE"} KEY-----`,
    `M${"I"}${"A".repeat(192)}`,
    `-----END ${"PRIVATE"} KEY-----`,
    ""
  ].join("\n");
  await assertNativeBlockingCheckContract({
    check: secretDetection({
      files: { exclude: [], include: ["**/*.txt"], source: "git-worktree" }
    }),
    async introduceFinding(directory) {
      await fs.writeFile(path.join(directory, "private-key.txt"), privateKey);
    },
    prefix: "skills-vibe-secret-",
    async setup(directory) {
      await fs.writeFile(path.join(directory, "safe.txt"), "safe text\n");
    }
  });
});

test("JSON validation blocks findings and fails closed when unavailable", async () => {
  await assertNativeBlockingCheckContract({
    check: jsonValidation({
      files: { exclude: [], include: ["**/*.json"], source: "git-worktree" }
    }),
    async introduceFinding(directory) {
      await fs.writeFile(path.join(directory, "broken.json"), "{\n", "utf8");
    },
    prefix: "skills-vibe-json-",
    async setup(directory) {
      await fs.writeFile(
        path.join(directory, "valid.json"),
        '{"valid":true}\n',
        "utf8"
      );
    }
  });
});

test("JSON schema validation blocks findings and fails closed when unavailable", async () => {
  await assertNativeBlockingCheckContract({
    check: jsonSchemaValidation({
      bindings: [
        {
          id: "fixture",
          instancePath: "instance.json",
          schemaId: "urn:fixture:schema"
        }
      ],
      files: {
        exclude: [],
        include: ["schema.json", "instance.json"],
        source: "git-worktree"
      },
      schemaIdentity: { mode: "configuration-authoritative" },
      schemas: [{ id: "urn:fixture:schema", path: "schema.json" }]
    }),
    async introduceFinding(directory) {
      await fs.writeFile(
        path.join(directory, "instance.json"),
        '{"name":4}\n',
        "utf8"
      );
    },
    prefix: "skills-vibe-schema-",
    async setup(directory) {
      await Promise.all([
        fs.writeFile(
          path.join(directory, "schema.json"),
          JSON.stringify({
            properties: { name: { type: "string" } },
            required: ["name"],
            type: "object"
          }),
          "utf8"
        ),
        fs.writeFile(
          path.join(directory, "instance.json"),
          '{"name":"ok"}\n',
          "utf8"
        )
      ]);
    }
  });
});

test("Markdown link validation blocks findings and fails closed when unavailable", async () => {
  await assertNativeBlockingCheckContract({
    check: markdownLinkValidation({
      files: { exclude: [], include: ["**/*.md"], source: "git-worktree" },
      findingPolicy: "blocking"
    }),
    async introduceFinding(directory) {
      await fs.writeFile(
        path.join(directory, "root.md"),
        "[missing](missing.md)\n",
        "utf8"
      );
    },
    prefix: "skills-vibe-markdown-",
    async setup(directory) {
      await Promise.all([
        fs.writeFile(path.join(directory, "target.md"), "# Target\n", "utf8"),
        fs.writeFile(
          path.join(directory, "root.md"),
          "[target](target.md)\n",
          "utf8"
        )
      ]);
    }
  });
});

test("metric findings remain advisory while unavailable and N/A results fail closed", async () => {
  await withTemporaryDirectory("skills-vibe-metrics-", async (directory) => {
    await fs.writeFile(
      path.join(directory, "fixture.ts"),
      [
        "export function fixture(value: number): number {",
        "  const one = value + 1;",
        "  const two = one + 2;",
        "  return two;",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );
    const selection = {
      exclude: [],
      include: ["**/*.ts"],
      source: "filesystem"
    } as const;
    const fileCheck = fileMetrics({
      codeAreas: {
        fixture: {
          codeLines: {
            lowDecisionTokenAllowance: {
              maximumCodeLines: 2,
              maximumDecisionTokens: 0
            },
            maximum: 1
          },
          files: selection,
          findingPolicy: "non-blocking"
        }
      },
      findingPolicy: "non-blocking",
      findingWaivers: []
    });
    const functionCheck = functionMetrics({
      codeAreas: {
        fixture: {
          files: selection,
          findingPolicy: "non-blocking",
          limits: {
            codeLines: {
              lowComplexityAllowance: {
                cyclomaticComplexityBelow: 1,
                maximum: 2
              },
              maximum: 1
            },
            cyclomaticComplexity: { maximum: 100 },
            parameters: { maximum: 100 }
          }
        }
      },
      findingPolicy: "non-blocking",
      findingWaivers: []
    });
    const findings = await runDefinition(
      defineConfig({ checks: [fileCheck, functionCheck], outputs: noOutput }),
      directory
    );

    assert.equal(findings.aggregate, "passed");
    const fileOutcome = outcomeFor(findings, "file-metrics");
    const functionOutcome = outcomeFor(findings, "function-metrics");
    assert.equal(fileOutcome.status, "passed");
    assert.equal(functionOutcome.status, "passed");
    if (
      fileOutcome.status !== "passed" ||
      functionOutcome.status !== "passed"
    ) {
      throw new Error("metric findings must remain passed outcomes");
    }
    const fileData = parseFileMetricsData(fileOutcome.data);
    const functionData = parseFunctionMetricsData(functionOutcome.data);
    assert.ok(fileData.findingCount > 0);
    assert.equal(fileData.blockingFindingCount, 0);
    assert.ok(functionData.findingCount > 0);
    assert.equal(functionData.blockingFindingCount, 0);
    assert.deepEqual(fileCheck.options.findingWaivers, []);

    const unavailable = await runDefinition(
      defineConfig({
        checks: [
          fileMetrics({
            codeAreas: { fixture: { files: selection } },
            findingWaivers: [],
            scanner: { executable: "missing-scc-for-vibe-test" }
          }),
          functionCheck
        ],
        outputs: noOutput
      }),
      directory
    );
    assert.equal(unavailable.aggregate, "failed");
    assert.equal(outcomeFor(unavailable, "file-metrics").status, "unavailable");
    assert.equal(outcomeFor(unavailable, "function-metrics").status, "passed");

    const notApplicable = await withTemporaryDirectory(
      "skills-vibe-empty-metrics-",
      async (emptyDirectory) =>
        runDefinition(
          defineConfig({
            checks: [
              functionMetrics({
                codeAreas: { fixture: { files: selection } }
              })
            ],
            outputs: noOutput
          }),
          emptyDirectory
        )
    );
    assert.equal(notApplicable.aggregate, "failed");
    assert.equal(
      notApplicable.snapshot.checks[0]?.outcome.status,
      "not-applicable"
    );
  });
});

test("function metrics uses the bundled analyzer without an external scanner", async () => {
  await withTemporaryDirectory(
    "skills-vibe-function-analyzer-",
    async (directory) => {
      await fs.writeFile(
        path.join(directory, "fixture.ts"),
        "export function fixture(value: number): number { return value + 1; }\n",
        "utf8"
      );
      const productionCheck = createVibeNativeChecks().find(
        ({ checkId }) => checkId === "function-metrics"
      );
      if (!productionCheck) {
        throw new Error("missing production function-metrics Check");
      }
      assert.ok(productionCheck.options);
      assert.equal(Object.hasOwn(productionCheck.options, "scanner"), false);

      const pathBefore = process.env.PATH;
      process.env.PATH = "";
      try {
        const result = await runDefinition(
          defineConfig({
            checks: [
              functionMetrics({
                codeAreas: {
                  fixture: {
                    files: {
                      exclude: [],
                      include: ["**/*.ts"],
                      source: "filesystem"
                    }
                  }
                }
              })
            ],
            outputs: noOutput
          }),
          directory
        );
        assert.equal(result.aggregate, "passed");
        assert.equal(outcomeFor(result, "function-metrics").status, "passed");
      } finally {
        if (pathBefore === undefined) {
          delete process.env.PATH;
        } else {
          process.env.PATH = pathBefore;
        }
      }
    }
  );
});

function nativeCheckExclusions(
  optionsById: ReadonlyMap<string, unknown>,
  checkId: string
): readonly string[] {
  const options = optionsRecord(
    optionsById.get(checkId),
    `missing options for ${checkId}`
  );
  const directExclusions = stringArray(
    optionsRecordOrNull(options.files)?.exclude
  );
  if (directExclusions !== null) return directExclusions;
  const codeAreas = optionsRecord(
    options.codeAreas,
    `missing file selection for ${checkId}`
  );
  const maintained = optionsRecord(
    codeAreas.maintained,
    `missing maintained code area for ${checkId}`
  );
  const maintainedFiles = optionsRecord(
    maintained.files,
    `missing maintained file selection for ${checkId}`
  );
  return stringArray(maintainedFiles.exclude) ?? [];
}

function codeAreaOptions(
  optionsById: ReadonlyMap<string, unknown>,
  checkId: string,
  areaId: string
): Record<string, unknown> {
  const options = optionsRecord(
    optionsById.get(checkId),
    `missing options for ${checkId}`
  );
  const codeAreas = optionsRecord(
    options.codeAreas,
    `missing code areas for ${checkId}`
  );
  return optionsRecord(
    codeAreas[areaId],
    `missing ${areaId} area for ${checkId}`
  );
}

function optionsRecord(value: unknown, error: string): Record<string, unknown> {
  const record = optionsRecordOrNull(value);
  if (record === null) throw new Error(error);
  return record;
}

function optionsRecordOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : null;
}

test("native file selections exclude historical content and authoring candidates", () => {
  const checks = createVibeNativeChecks();
  const optionsById = new Map(
    checks.map((check) => [check.checkId, check.options])
  );
  for (const checkId of vibeNativeCheckIds.filter(
    (candidate) => candidate !== "function-metrics"
  )) {
    const exclusions = nativeCheckExclusions(optionsById, checkId);
    for (const historicalExclusion of historicalContentExclusions) {
      assert.ok(
        exclusions.includes(historicalExclusion),
        `${checkId} must exclude ${historicalExclusion}`
      );
    }
  }
  for (const [areaId, expectedFiles] of [
    ["product", productCodeFiles],
    ["automation", automationCodeFiles],
    ["tests", testCodeFiles]
  ] as const) {
    const area = codeAreaOptions(optionsById, "function-metrics", areaId);
    assert.deepEqual(area.files, expectedFiles);
    const exclusions = stringArray(
      optionsRecord(area.files, `missing files for ${areaId}`).exclude
    );
    for (const historicalExclusion of historicalContentExclusions) {
      assert.ok(exclusions?.includes(historicalExclusion));
    }
  }
  assert.deepEqual(
    codeAreaOptions(optionsById, "function-metrics", "product").limits,
    {
      codeLines: {
        lowComplexityAllowance: {
          cyclomaticComplexityBelow: 5,
          maximum: 120
        },
        maximum: 45
      },
      cyclomaticComplexity: { maximum: 10 },
      nestingDepth: { maximum: 5 },
      parameters: { maximum: 5 }
    }
  );
  for (const checkId of ["json-validation", "markdown-link-validation"]) {
    const exclusions = nativeCheckExclusions(optionsById, checkId);
    for (const candidateExclusion of investigationAuthoringDocumentExclusions) {
      assert.ok(
        exclusions.includes(candidateExclusion),
        `${checkId} must exclude ${candidateExclusion}`
      );
    }
  }
  assert.deepEqual(
    optionsRecord(optionsById.get("secret-detection"), "missing secret Check")
      .files,
    maintainedSecretFiles
  );
  const markdownOptions = optionsRecord(
    optionsById.get("markdown-link-validation"),
    "missing Markdown Check"
  );
  const markdownCache = optionsRecord(
    markdownOptions.cache,
    "missing Markdown cache"
  );
  assert.equal(markdownCache.enabled, true);
  assert.equal(path.isAbsolute(String(markdownCache.directory)), true);
  assert.deepEqual(
    checks.map(({ checkId, resourceClaims }) => [checkId, resourceClaims]),
    [
      ["duplicate-detection", { "repository-scan": 1 }],
      ["secret-detection", { "repository-scan": 1 }],
      ["json-validation", { "repository-scan": 1 }],
      ["json-schema-validation", { "repository-scan": 1 }],
      ["markdown-link-validation", { "repository-scan": 1 }],
      ["file-metrics", { "external-process": 1, "repository-scan": 1 }],
      ["function-metrics", { "repository-scan": 1 }]
    ]
  );
});
