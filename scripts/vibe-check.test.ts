import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
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
  run
} from "@zxyycom/vibe-check";
import type { Check, ProjectDefinition, RunResult } from "@zxyycom/vibe-check";
import {
  createGateDefinition,
  createVibeNativeChecks,
  defaultGatePackageScripts,
  gateCheckIds,
  historicalContentExclusions,
  projectJscpdExecutable,
  projectLizardExecutable,
  releaseRequiredPackageScripts,
  releaseRequiredCheckIds,
  releaseVersionPackageScript,
  runGateCommand,
  semanticGateChecks,
  vibeNativeCheckIds,
  type GateCommandInvocation,
  type GateCommandRunner
} from "./lib/vibe-gate.ts";
import {
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

async function writeFakeLizard(directory: string): Promise<string> {
  const binDirectory = path.join(directory, "bin");
  const executable = path.join(binDirectory, "lizard");
  await fs.mkdir(binDirectory, { recursive: true });
  await fs.writeFile(
    executable,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "",
      "const args = process.argv.slice(2);",
      'if (args.length === 1 && args[0] === "--version") {',
      '  process.stdout.write(`${process.env.FAKE_LIZARD_VERSION ?? "1.23.0"}\\n`);',
      "  process.exitCode = 0;",
      "} else {",
      "  const marker = process.env.FAKE_LIZARD_SCAN_MARKER;",
      "  if (marker) writeFileSync(marker, JSON.stringify(args));",
      '  const file = args.find((argument) => argument !== "--csv") ?? "scripts/fixture.ts";',
      "  const csv = [",
      '    "NLOC,CCN,token count,parameter count,length,location,file path,function name,long name,start line,end line",',
      "    `1,1,1,0,1,1,${file},fixture,fixture(),1,1`",
      '  ].join("\\n");',
      "  process.stdout.write(`${csv}\\n`);",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.chmod(executable, 0o755);
  return binDirectory;
}

async function withFakeLizard<T>(
  binDirectory: string,
  version: string,
  scanMarker: string,
  operation: () => Promise<T>
): Promise<T> {
  const environmentNames = [
    "PATH",
    "FAKE_LIZARD_VERSION",
    "FAKE_LIZARD_SCAN_MARKER"
  ] as const;
  const originalEnvironment = new Map(
    environmentNames.map((name) => [name, process.env[name]])
  );
  process.env.PATH = `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`;
  process.env.FAKE_LIZARD_VERSION = version;
  process.env.FAKE_LIZARD_SCAN_MARKER = scanMarker;
  try {
    return await operation();
  } finally {
    for (const name of environmentNames) {
      const value = originalEnvironment.get(name);
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
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
  projectRoot: string
) {
  return completed(
    await run(definition, {
      checkAggregation: aggregateOptions,
      outputs: noOutput,
      projectRoot
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

function nativeChecksWithTerminalOutcome(
  targetCheckId: (typeof vibeNativeCheckIds)[number],
  targetStatus: "failed" | "not-applicable" | "unavailable"
): readonly Check[] {
  return vibeNativeCheckIds.map((checkId) =>
    defineCheck({
      checkId,
      displayName: checkId,
      execution() {
        if (checkId !== targetCheckId) {
          return { status: "passed" as const, data: { checkId } };
        }
        if (targetStatus === "failed") {
          return {
            status: "failed" as const,
            data: { checkId, targetStatus }
          };
        }
        if (targetStatus === "unavailable") {
          return {
            status: "unavailable" as const,
            reason: { code: "fixture-unavailable" }
          };
        }
        return { status: "not-applicable" as const };
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

const expectedSemanticGateGroups = [
  [
    "default",
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
    "default",
    "test:change-plan:lifecycle-archive",
    "bun",
    [
      "./tools/change-plan/tests/lifecycle.test.ts",
      "./tools/change-plan/tests/archive.test.ts"
    ]
  ],
  [
    "default",
    "test:change-plan:public-distribution",
    "bun",
    [
      "./tools/change-plan/tests/cli.test.ts",
      "./tools/change-plan/tests/generated-artifacts.test.ts"
    ]
  ],
  [
    "full",
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
    "full",
    "test:decision-records:query-and-index-projection",
    "bun",
    [
      "./tools/decision-records/tests/first-establishment.test.ts",
      "./tools/decision-records/tests/index-maintenance.test.ts",
      "./tools/decision-records/tests/queries.test.ts"
    ]
  ],
  [
    "full",
    "test:decision-records:lifecycle-and-recovery",
    "bun",
    [
      "./tools/decision-records/tests/activation-archive.test.ts",
      "./tools/decision-records/tests/candidate-lifecycle.test.ts",
      "./tools/decision-records/tests/evolution.test.ts",
      "./tools/decision-records/tests/lifecycle-relations.test.ts",
      "./tools/decision-records/tests/transaction-recovery.test.ts",
      "./tools/decision-records/tests/unrecorded-history.test.ts"
    ]
  ],
  [
    "full",
    "test:decision-records:pending-stage",
    "bun",
    ["./tools/decision-records/tests/stage.test.ts"]
  ],
  [
    "full",
    "test:decision-records:public-distribution",
    "bun",
    [
      "./tools/decision-records/tests/cli-args.test.ts",
      "./tools/decision-records/tests/generated-artifacts.test.ts"
    ]
  ],
  [
    "full",
    "test:investigation-report:collection-and-resources",
    "bun",
    [
      "./tools/investigation-report/tests/parsing-directory.test.ts",
      "./tools/investigation-report/tests/resources.test.ts",
      "./tools/investigation-report/tests/relations.test.ts"
    ]
  ],
  [
    "full",
    "test:investigation-report:index-and-query",
    "bun",
    [
      "./tools/investigation-report/tests/index-query.test.ts",
      "./tools/investigation-report/tests/scale.test.ts"
    ]
  ],
  [
    "full",
    "test:investigation-report:transactional-maintenance",
    "bun",
    [
      "./tools/investigation-report/tests/transaction.test.ts",
      "./tools/investigation-report/tests/discard.test.ts"
    ]
  ],
  [
    "full",
    "test:investigation-report:pending-stage",
    "bun",
    ["./tools/investigation-report/tests/staging.test.ts"]
  ],
  [
    "full",
    "test:investigation-report:cli-contract",
    "bun",
    ["./tools/investigation-report/tests/cli-generated.test.ts"]
  ],
  [
    "full",
    "test:task-graph:index-and-projection",
    "bun",
    [
      "./tools/task-graph/tests/schema-index.test.ts",
      "./tools/task-graph/tests/graph-projection.test.ts"
    ]
  ],
  [
    "full",
    "test:task-graph:task-lifecycle",
    "bun",
    [
      "./tools/task-graph/tests/lifecycle.test.ts",
      "./tools/task-graph/tests/task-removal.test.ts"
    ]
  ],
  [
    "full",
    "test:task-graph:runtime-and-store",
    "bun",
    [
      "./tools/task-graph/tests/runtime.test.ts",
      "./tools/task-graph/tests/store.test.ts"
    ]
  ],
  [
    "full",
    "test:task-graph:native-store",
    "node",
    ["./tools/task-graph/tests/native-store.test.ts"]
  ],
  [
    "full",
    "test:task-graph:cli-rendering",
    "bun",
    [
      "./tools/task-graph/tests/cli.test.ts",
      "./tools/task-graph/tests/task-list-renderer.test.ts"
    ]
  ],
  [
    "full",
    "test:task-graph:pending-stage",
    "bun",
    ["./tools/task-graph/tests/staging.test.ts"]
  ],
  [
    "full",
    "test:task-graph:public-distribution",
    "bun",
    ["./tools/task-graph/tests/generated-artifacts.test.ts"]
  ],
  [
    "full",
    "test:test-evidence:catalog-contract",
    "bun",
    ["./tools/test-evidence/tests/catalog.test.ts"]
  ],
  [
    "full",
    "test:test-evidence:ledger-source-and-relations",
    "bun",
    [
      "./tools/test-evidence/tests/ledger-source.test.ts",
      "./tools/test-evidence/tests/ledger-relations.test.ts"
    ]
  ],
  [
    "full",
    "test:test-evidence:ledger-index-and-query",
    "bun",
    [
      "./tools/test-evidence/tests/ledger-api.test.ts",
      "./tools/test-evidence/tests/ledger-index.test.ts",
      "./tools/test-evidence/tests/repository-catalog.test.ts"
    ]
  ],
  [
    "full",
    "test:test-evidence:ledger-cli",
    "bun",
    ["./tools/test-evidence/tests/ledger-cli.test.ts"]
  ],
  [
    "full",
    "test:test-evidence:pending-stage",
    "bun",
    ["./tools/test-evidence/tests/staging.test.ts"]
  ]
] as const;

const expectedSemanticCommandPaths = new Map<string, string>([
  [
    "test:change-plan:artifact-and-active-plan-gates",
    "./tools/change-plan/tests/checks/artifact-and-active-plan-gates.ts"
  ],
  [
    "test:change-plan:lifecycle-archive",
    "./tools/change-plan/tests/checks/lifecycle-archive.ts"
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
    "test:test-evidence:catalog-contract",
    "./tools/test-evidence/tests/catalog.test.ts"
  ],
  [
    "test:test-evidence:ledger-source-and-relations",
    "./tools/test-evidence/tests/checks/ledger-source-and-relations.ts"
  ],
  [
    "test:test-evidence:ledger-index-and-query",
    "./tools/test-evidence/tests/checks/ledger-index-and-query.ts"
  ],
  [
    "test:test-evidence:ledger-cli",
    "./tools/test-evidence/tests/ledger-cli.test.ts"
  ],
  [
    "test:test-evidence:pending-stage",
    "./tools/test-evidence/tests/staging.test.ts"
  ]
]);

const expectedSemanticPrerequisites = new Map<string, readonly string[]>([
  ["test:change-plan:public-distribution", ["script:check:change-plan-cli"]],
  [
    "test:decision-records:public-distribution",
    ["script:check:decision-records-cli"]
  ],
  ["test:task-graph:public-distribution", ["script:check:task-graph-cli"]]
]);

test("gate catalog builds semantic default and full Definitions", async () => {
  const runner = completedScript();
  const nativeChecks = passingNativeChecks();
  const defaultDefinition = createGateDefinition("default", {
    nativeChecks,
    runCommand: runner
  });
  const fullDefinition = createGateDefinition("full", {
    nativeChecks,
    runCommand: runner
  });
  const expectedDefaultSemanticIds = expectedSemanticGateGroups
    .filter(([profile]) => profile === "default")
    .map(([, checkId]) => checkId);
  const expectedFullSemanticIds = expectedSemanticGateGroups.map(
    ([, checkId]) => checkId
  );
  const expectedDefaultCheckIds = [
    ...vibeNativeCheckIds,
    ...expectedDefaultSemanticIds,
    ...defaultGatePackageScripts.map((script) => `script:${script}`)
  ];
  const expectedFullCheckIds = [
    ...vibeNativeCheckIds,
    ...releaseRequiredPackageScripts.map((script) => `script:${script}`),
    ...expectedFullSemanticIds,
    "release:skill-version",
    "pack:skills"
  ];
  assert.deepEqual(
    defaultDefinition.checks.map(({ checkId }) => checkId),
    expectedDefaultCheckIds
  );
  assert.deepEqual(
    fullDefinition.checks.map(({ checkId }) => checkId),
    expectedFullCheckIds
  );
  assert.deepEqual(gateCheckIds("default"), expectedDefaultCheckIds);
  assert.deepEqual(gateCheckIds("full"), expectedFullCheckIds);
  assert.equal(
    defaultDefinition.checks.some(({ checkId }) => checkId === "pack:skills"),
    false
  );
  assert.equal(defaultDefinition.scheduler.maxParallel, 4);
  assert.deepEqual(defaultDefinition.outputs, {
    diagnosticLogging: { enabled: false, directory: ".log/vibe-check" },
    machinePublication: {
      enabled: true,
      directory: ".log/vibe-check/publication"
    },
    progressRendering: { enabled: true }
  });
  assert.equal(releaseRequiredCheckIds.length, 56);
  assert.deepEqual(
    fullDefinition.checks.find(
      ({ checkId }) => checkId === "release:skill-version"
    )?.dependsOn,
    releaseRequiredCheckIds
  );
  assert.deepEqual(releaseTerminalCheck(fullDefinition).dependsOn, [
    "release:skill-version"
  ]);
  assert.deepEqual(
    semanticGateChecks.map((check) => [
      check.profile,
      check.checkId,
      check.command.command,
      check.command.args.at(-1),
      "dependsOn" in check ? check.dependsOn : []
    ]),
    expectedSemanticGateGroups.map(([profile, checkId, command]) => [
      profile,
      checkId,
      command,
      expectedSemanticCommandPaths.get(checkId),
      expectedSemanticPrerequisites.get(checkId) ?? []
    ])
  );
  assert.deepEqual(
    fullDefinition.checks
      .filter(({ checkId }) => expectedSemanticPrerequisites.has(checkId))
      .map(({ checkId, dependsOn }) => [checkId, dependsOn]),
    [...expectedSemanticPrerequisites]
  );
  for (const [, checkId, , files] of expectedSemanticGateGroups) {
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
    [3, 5, 5, 7, 5]
  );
  const semanticFiles = expectedSemanticGateGroups.flatMap(
    ([, , , files]) => files
  );
  assert.equal(semanticFiles.length, 58);
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
});

test("package script adapter maps terminal results and settles independent Checks", async () => {
  await withTemporaryDirectory("skills-vibe-adapter-", async (directory) => {
    const calls: GateCommandInvocation[] = [];
    const failedScript = "test:relation-graph";
    const failedResult = await runDefinition(
      createGateDefinition("default", {
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) => {
          calls.push(invocation);
          return {
            exitCode: scriptForCommand(invocation) === failedScript ? 1 : 0,
            output: `${scriptForCommand(invocation)} output`,
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
      createGateDefinition("default", {
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
            createGateDefinition("full", {
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
            directory
          );

          assert.equal(outcomeFor(result, prerequisite).status, behavior);
          assert.equal(outcomeFor(result, consumerCheckId).status, behavior);
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

test("CLI parses profiles and full baselines, then maps Vibe results to exit codes", async () => {
  const diagnostics: string[] = [];
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
  const dependencies = {
    createDefinition(invocation: GateInvocation) {
      selectedInvocation = invocation;
      return passedDefinition;
    },
    reportError(message: string) {
      diagnostics.push(message);
    }
  };

  assert.deepEqual(resolveGateInvocation([]), { profile: "default" });
  assert.deepEqual(resolveGateInvocation(["--full"]), {
    baselineRef: "HEAD",
    profile: "full"
  });
  assert.deepEqual(
    resolveGateInvocation(["--full", "--baseline-ref", "origin/release"]),
    { baselineRef: "origin/release", profile: "full" }
  );
  assert.equal(
    resolveGateInvocation(["--baseline-ref", "origin/release"]),
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
  assert.equal(await runVibeCheck([], dependencies), 0);
  assert.deepEqual(selectedInvocation, { profile: "default" });
  assert.equal(
    await runVibeCheck(
      ["--full", "--baseline-ref", "origin/release"],
      dependencies
    ),
    0
  );
  assert.deepEqual(selectedInvocation, {
    baselineRef: "origin/release",
    profile: "full"
  });
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
    /Usage: bun run check \[--full \[--baseline-ref <ref>\]\]/u
  );
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => failedDefinition,
      reportError: (message) => diagnostics.push(message)
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check gate failed: failed/u);
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => invalidDefinition,
      reportError: (message) => diagnostics.push(message)
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => unknownDependencyDefinition,
      reportError: (message) => diagnostics.push(message)
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);
});

test("release version Check preflights its baseline and gates packaging", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-timing-",
    async (directory) => {
      const calls: GateCommandInvocation[] = [];
      const definition = createGateDefinition("full", {
        baselineRef: "origin/release",
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) => {
          calls.push(invocation);
          return { exitCode: 0, output: "", status: "completed" };
        }
      });
      const versionCheck = definition.checks.find(
        ({ checkId }) => checkId === "release:skill-version"
      );
      const terminalCheck = releaseTerminalCheck(definition);
      assert.deepEqual(versionCheck?.dependsOn, releaseRequiredCheckIds);
      assert.deepEqual(terminalCheck.dependsOn, ["release:skill-version"]);
      assert.deepEqual(versionCheck?.options, {
        baselineRef: "origin/release"
      });
      if (versionCheck?.preflight === undefined)
        throw new Error(
          "release version Check must define a baseline preflight"
        );
      assert.deepEqual(
        await versionCheck.preflight(
          { baselineRef: "origin/release" },
          new AbortController().signal
        ),
        {
          preparedOptions: { baselineRef: "origin/release" },
          status: "success"
        }
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
          (
            await versionCheck.preflight(
              { baselineRef: invalidBaseline },
              new AbortController().signal
            )
          ).status,
          "failure"
        );
      }
      const result = await runDefinition(definition, directory);
      assert.equal(result.aggregate, "passed");
      assert.deepEqual(
        result.snapshot.records.find(
          ({ checkId, id }) =>
            checkId === "release:skill-version" && id === "release-baseline"
        ),
        {
          checkId: "release:skill-version",
          data: { baselineRef: "origin/release" },
          id: "release-baseline"
        }
      );
      assert.deepEqual(calls.slice(-2).map(scriptForCommand), [
        releaseVersionPackageScript,
        "pack:skills"
      ]);
    }
  );
});

test("release version validation failure blocks package execution", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-version-failure-",
    async (directory) => {
      const calls: GateCommandInvocation[] = [];
      const result = await runDefinition(
        createGateDefinition("full", {
          baselineRef: "release-base",
          nativeChecks: passingNativeChecks(),
          runCommand: async (invocation) => {
            calls.push(invocation);
            return {
              exitCode:
                scriptForCommand(invocation) === releaseVersionPackageScript
                  ? 1
                  : 0,
              output: "version increase required",
              status: "completed"
            };
          }
        }),
        directory
      );

      assert.equal(result.aggregate, "failed");
      assert.equal(
        outcomeFor(result, "release:skill-version").status,
        "failed"
      );
      assert.equal(outcomeFor(result, "pack:skills").status, "failed");
      assert.equal(
        calls.filter(
          (invocation) =>
            scriptForCommand(invocation) === releaseVersionPackageScript
        ).length,
        1
      );
      assert.equal(
        calls.some(
          (invocation) => scriptForCommand(invocation) === "pack:skills"
        ),
        false
      );
    }
  );
});

test("release version validation unavailable or throws blocks package execution", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-version-unavailable-",
    async (directory) => {
      for (const versionBehavior of ["unavailable", "throws"] as const) {
        const calls: GateCommandInvocation[] = [];
        const result = await runDefinition(
          createGateDefinition("full", {
            baselineRef: "release-base",
            nativeChecks: passingNativeChecks(),
            runCommand: async (invocation) => {
              calls.push(invocation);
              if (
                scriptForCommand(invocation) !== releaseVersionPackageScript
              ) {
                return { exitCode: 0, output: "", status: "completed" };
              }
              if (versionBehavior === "throws") {
                throw new Error("version check runner failed");
              }
              return {
                output: "Git resolver unavailable",
                reason: "gate-command-start-failed",
                status: "unavailable"
              };
            }
          }),
          directory
        );

        assert.equal(result.aggregate, "failed");
        assert.equal(
          outcomeFor(result, "release:skill-version").status,
          "unavailable"
        );
        assert.equal(outcomeFor(result, "pack:skills").status, "unavailable");
        assert.equal(
          calls.filter(
            (invocation) =>
              scriptForCommand(invocation) === releaseVersionPackageScript
          ).length,
          1
        );
        assert.equal(
          calls.some(
            (invocation) => scriptForCommand(invocation) === "pack:skills"
          ),
          false
        );
      }
    }
  );
});

test("release terminal Check packages exactly once after version validation passes", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-package-",
    async (directory) => {
      const packageOutput = path.join(directory, "dist", "skills.fixture");
      const calls: GateCommandInvocation[] = [];
      const result = await runDefinition(
        createGateDefinition("full", {
          baselineRef: "release-base",
          nativeChecks: passingNativeChecks(),
          runCommand: async (invocation) => {
            calls.push(invocation);
            if (scriptForCommand(invocation) === "pack:skills") {
              await fs.mkdir(path.dirname(packageOutput), { recursive: true });
              await fs.writeFile(packageOutput, "packaged\n", "utf8");
            }
            return { exitCode: 0, output: "", status: "completed" };
          }
        }),
        directory
      );

      assert.equal(result.aggregate, "passed");
      assert.deepEqual(outcomeFor(result, "pack:skills"), {
        data: { exitCode: 0, script: "pack:skills" },
        status: "passed"
      });
      assert.deepEqual(calls.slice(-2).map(scriptForCommand), [
        releaseVersionPackageScript,
        "pack:skills"
      ]);
      assert.equal(
        calls.filter(
          (invocation) =>
            scriptForCommand(invocation) === releaseVersionPackageScript
        ).length,
        1
      );
      assert.equal(
        calls.filter(
          (invocation) => scriptForCommand(invocation) === "pack:skills"
        ).length,
        1
      );
      assert.equal(await fs.readFile(packageOutput, "utf8"), "packaged\n");
    }
  );
});

test("release version validation passes its baseline through Bun argument arrays", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-args-",
    async (directory) => {
      const capturedArgs = path.join(directory, "captured-args.json");
      const shellInjectionMarker = path.join(directory, "must-not-exist");
      const baselineRef = `release; touch ${shellInjectionMarker}`;
      await fs.writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ scripts: { "hash:skills": "bun capture-args.ts" } }),
        "utf8"
      );
      await fs.writeFile(
        path.join(directory, "capture-args.ts"),
        [
          'import { writeFileSync } from "node:fs";',
          `writeFileSync(${JSON.stringify(capturedArgs)}, JSON.stringify(process.argv.slice(2)));`,
          ""
        ].join("\n"),
        "utf8"
      );

      const result = await runDefinition(
        createGateDefinition("full", {
          baselineRef,
          nativeChecks: passingNativeChecks(),
          runCommand: async (invocation) =>
            scriptForCommand(invocation) === releaseVersionPackageScript
              ? runGateCommand(invocation)
              : { exitCode: 0, output: "", status: "completed" }
        }),
        directory
      );

      assert.equal(result.aggregate, "passed");
      assert.deepEqual(JSON.parse(await fs.readFile(capturedArgs, "utf8")), [
        "--baseline-ref",
        baselineRef,
        "--quiet"
      ]);
      assert.equal(await fileExists(shellInjectionMarker), false);
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
      },
      scanner: {
        command: { kind: "custom", executable: projectJscpdExecutable }
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

test("jscpd compatibility wrapper rejects scans without a Vibe config", async () => {
  await withTemporaryDirectory("skills-vibe-jscpd-", async (directory) => {
    const result = spawnSync(
      process.execPath,
      [projectJscpdExecutable, "--output", path.join(directory, "report")],
      {
        cwd: directory,
        encoding: "utf8",
        windowsHide: true
      }
    );

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Vibe jscpd scan must provide --config <path>/u
    );
    assert.equal(result.stdout, "");
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
      findingPolicy: "non-blocking"
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
          functionMetrics({
            codeAreas: { fixture: { files: selection } },
            scanner: { executable: "missing-lizard-for-vibe-test" }
          })
        ],
        outputs: noOutput
      }),
      directory
    );
    assert.equal(unavailable.aggregate, "failed");
    for (const check of unavailable.snapshot.checks) {
      assert.equal(check.outcome.status, "unavailable");
    }

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

test("function metrics requires exact Lizard before scanning or packaging", async () => {
  await withTemporaryDirectory("skills-vibe-lizard-", async (directory) => {
    const scanMarker = path.join(directory, "lizard-scan.json");
    const packageOutput = path.join(directory, "dist", "skills.fixture");
    const binDirectory = await writeFakeLizard(directory);
    await fs.mkdir(path.join(directory, "scripts"), { recursive: true });
    await fs.writeFile(
      path.join(directory, "scripts", "fixture.ts"),
      "export const fixture = 1;\n",
      "utf8"
    );
    runGit(directory, ["init"]);
    runGit(directory, ["add", "."]);

    const productionFunctionMetrics = (): Check => {
      const check = createVibeNativeChecks().find(
        ({ checkId }) => checkId === "function-metrics"
      );
      if (!check) {
        throw new Error("missing production function-metrics Check");
      }
      const options = check.options as {
        readonly scanner: { readonly executable: string };
      };
      assert.equal(options.scanner.executable, projectLizardExecutable);
      return check;
    };

    const accepted = await withFakeLizard(
      binDirectory,
      "1.23.0",
      scanMarker,
      () =>
        runDefinition(
          defineConfig({
            checks: [productionFunctionMetrics()],
            outputs: noOutput
          }),
          directory
        )
    );
    assert.equal(accepted.aggregate, "passed");
    assert.equal(outcomeFor(accepted, "function-metrics").status, "passed");
    const scanArguments: unknown = JSON.parse(
      await fs.readFile(scanMarker, "utf8")
    );
    assert.ok(Array.isArray(scanArguments));
    assert.equal(scanArguments.at(-1), "--csv");
    assert.ok(scanArguments.includes("scripts/fixture.ts"));

    await fs.rm(scanMarker, { force: true });
    const calls: string[] = [];
    const mismatch = await withFakeLizard(
      binDirectory,
      "1.23.1",
      scanMarker,
      () =>
        runDefinition(
          createGateDefinition("full", {
            nativeChecks: passingNativeChecks().map((check) =>
              check.checkId === "function-metrics"
                ? productionFunctionMetrics()
                : check
            ),
            runCommand: async (invocation) => {
              const script = scriptForCommand(invocation);
              calls.push(script ?? "semantic");
              if (script === "pack:skills") {
                await fs.mkdir(path.dirname(packageOutput), {
                  recursive: true
                });
                await fs.writeFile(packageOutput, "unexpected\n", "utf8");
              }
              return { exitCode: 0, output: "", status: "completed" };
            }
          }),
          directory
        )
    );

    assert.equal(mismatch.aggregate, "failed");
    assert.equal(
      outcomeFor(mismatch, "function-metrics").status,
      "unavailable"
    );
    assert.equal(calls.includes("pack:skills"), false);
    assert.equal(await fileExists(packageOutput), false);
    assert.equal(await fileExists(scanMarker), false);
  });
});

test("full packaging runs once only after every release prerequisite passes", async () => {
  await withTemporaryDirectory("skills-vibe-pack-", async (directory) => {
    const packageOutput = path.join(directory, "dist", "skills.fixture");
    const clearPackageOutput = async (): Promise<void> => {
      await fs.rm(path.dirname(packageOutput), {
        force: true,
        recursive: true
      });
    };
    const packageOutputExists = async (): Promise<boolean> =>
      fs
        .access(packageOutput)
        .then(() => true)
        .catch(() => false);
    const runFull = async (
      runner: GateCommandRunner
    ): Promise<ReturnType<typeof completed>> =>
      runDefinition(
        createGateDefinition("full", {
          nativeChecks: passingNativeChecks(),
          runCommand: runner
        }),
        directory
      );

    const defaultCalls: string[] = [];
    const defaultResult = await runDefinition(
      createGateDefinition("default", {
        nativeChecks: passingNativeChecks(),
        runCommand: async (invocation) => {
          const script = scriptForCommand(invocation);
          defaultCalls.push(script ?? "semantic");
          return { exitCode: 0, output: "", status: "completed" };
        }
      }),
      directory
    );
    assert.equal(defaultResult.aggregate, "passed");
    assert.equal(defaultCalls.includes("pack:skills"), false);
    assert.equal(await packageOutputExists(), false);

    const successfulCalls: string[] = [];
    const successful = await runFull(async (invocation) => {
      const { cwd } = invocation;
      const script = scriptForCommand(invocation);
      successfulCalls.push(script ?? "semantic");
      if (script === "pack:skills") {
        await fs.mkdir(path.dirname(packageOutput), { recursive: true });
        await fs.writeFile(packageOutput, "packaged\n", "utf8");
        assert.equal(cwd, directory);
      }
      return { exitCode: 0, output: "", status: "completed" };
    });
    assert.equal(successful.aggregate, "passed");
    assert.equal(
      successfulCalls.filter((script) => script === "pack:skills").length,
      1
    );
    assert.equal(await fs.readFile(packageOutput, "utf8"), "packaged\n");

    await clearPackageOutput();
    const failedCalls: string[] = [];
    const prerequisiteFailed = await runFull(async (invocation) => {
      const script = scriptForCommand(invocation);
      failedCalls.push(script ?? "semantic");
      return {
        exitCode: script === "test:relation-graph" ? 1 : 0,
        output: "",
        status: "completed"
      };
    });
    assert.equal(prerequisiteFailed.aggregate, "failed");
    assert.equal(failedCalls.includes(releaseVersionPackageScript), false);
    assert.equal(failedCalls.includes("pack:skills"), false);
    assert.equal(await packageOutputExists(), false);
    assert.equal(
      outcomeFor(prerequisiteFailed, "pack:skills").status,
      "failed"
    );

    await clearPackageOutput();
    const unavailableCalls: string[] = [];
    const prerequisiteUnavailable = await runFull(async (invocation) => {
      const script = scriptForCommand(invocation);
      unavailableCalls.push(script ?? "semantic");
      return script === "test:relation-graph"
        ? {
            output: "runner unavailable",
            reason: "gate-command-start-failed",
            status: "unavailable"
          }
        : { exitCode: 0, output: "", status: "completed" };
    });
    assert.equal(prerequisiteUnavailable.aggregate, "failed");
    assert.equal(unavailableCalls.includes(releaseVersionPackageScript), false);
    assert.equal(unavailableCalls.includes("pack:skills"), false);
    assert.equal(await packageOutputExists(), false);
    assert.equal(
      outcomeFor(prerequisiteUnavailable, "pack:skills").status,
      "unavailable"
    );

    for (const [checkId, status] of [
      ["duplicate-detection", "failed"],
      ["duplicate-detection", "unavailable"],
      ["file-metrics", "unavailable"],
      ["function-metrics", "not-applicable"]
    ] as const) {
      await clearPackageOutput();
      const calls: string[] = [];
      const result = await runDefinition(
        createGateDefinition("full", {
          nativeChecks: nativeChecksWithTerminalOutcome(checkId, status),
          runCommand: async (invocation) => {
            const script = scriptForCommand(invocation);
            calls.push(script ?? "semantic");
            if (script === "pack:skills") {
              await fs.mkdir(path.dirname(packageOutput), { recursive: true });
              await fs.writeFile(packageOutput, "unexpected\n", "utf8");
            }
            return { exitCode: 0, output: "", status: "completed" };
          }
        }),
        directory
      );
      assert.equal(result.aggregate, "failed", `${checkId} ${status}`);
      assert.equal(
        calls.includes(releaseVersionPackageScript),
        false,
        `${checkId} ${status}`
      );
      assert.equal(
        calls.includes("pack:skills"),
        false,
        `${checkId} ${status}`
      );
      assert.equal(await packageOutputExists(), false, `${checkId} ${status}`);
    }

    const packageFailureCalls: string[] = [];
    const packageFailure = await runFull(async (invocation) => {
      const script = scriptForCommand(invocation);
      packageFailureCalls.push(script ?? "semantic");
      return {
        exitCode: script === "pack:skills" ? 1 : 0,
        output: "",
        status: "completed"
      };
    });
    assert.equal(packageFailure.aggregate, "failed");
    assert.equal(
      packageFailureCalls.filter((script) => script === "pack:skills").length,
      1
    );
    assert.equal(outcomeFor(packageFailure, "pack:skills").status, "failed");

    assert.equal(gateCheckIds("default").includes("pack:skills"), false);
  });
});

test("native file selections exclude archived Changes and investigation resources", () => {
  const checks = createVibeNativeChecks();
  const optionsById = new Map(
    checks.map((check) => [check.checkId, check.options])
  );
  const exclusionsFor = (checkId: string): readonly string[] => {
    const options = optionsById.get(checkId);
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new Error(`missing options for ${checkId}`);
    }
    const record = options as Record<string, unknown>;
    const files = record.files;
    if (files && typeof files === "object" && !Array.isArray(files)) {
      const exclude = (files as Record<string, unknown>).exclude;
      if (Array.isArray(exclude)) {
        return exclude.filter(
          (value): value is string => typeof value === "string"
        );
      }
    }
    const codeAreas = record.codeAreas;
    if (
      !codeAreas ||
      typeof codeAreas !== "object" ||
      Array.isArray(codeAreas)
    ) {
      throw new Error(`missing file selection for ${checkId}`);
    }
    const maintained = (codeAreas as Record<string, unknown>).maintained;
    if (
      !maintained ||
      typeof maintained !== "object" ||
      Array.isArray(maintained)
    ) {
      throw new Error(`missing maintained code area for ${checkId}`);
    }
    const maintainedFiles = (maintained as Record<string, unknown>).files;
    if (
      !maintainedFiles ||
      typeof maintainedFiles !== "object" ||
      Array.isArray(maintainedFiles)
    ) {
      throw new Error(`missing maintained file selection for ${checkId}`);
    }
    const exclude = (maintainedFiles as Record<string, unknown>).exclude;
    return Array.isArray(exclude)
      ? exclude.filter((value): value is string => typeof value === "string")
      : [];
  };

  for (const checkId of vibeNativeCheckIds) {
    const exclusions = exclusionsFor(checkId);
    for (const historicalExclusion of historicalContentExclusions) {
      assert.ok(
        exclusions.includes(historicalExclusion),
        `${checkId} must exclude ${historicalExclusion}`
      );
    }
  }
});
