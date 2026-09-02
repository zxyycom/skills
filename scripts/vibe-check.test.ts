import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
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
  activateGateCheck,
  activeGateCheckIds,
  gateCheckIds,
  historicalContentExclusions,
  orderRootChecksByCriticalRank,
  releaseSnapshotCheckId,
  projectJscpdExecutable,
  projectLizardExecutable,
  releaseRequiredPackageScripts,
  releaseRequiredCheckIds,
  runGateCommand,
  semanticGateChecks,
  vibeNativeCheckIds,
  type GateCommandInvocation,
  type GateCommandRunner
} from "./lib/vibe-gate.ts";
import {
  createGateSchedulingHints,
  schedulingHintsRelativePath,
  type GateSchedulingHints
} from "./lib/vibe-scheduling-hints.ts";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease
} from "./lib/skill-package-release.ts";
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
  projectRoot: string,
  signal: AbortSignal = new AbortController().signal
) {
  return completed(
    await run(definition, {
      checkAggregation: aggregateOptions,
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
    "test:change-plan:lifecycle-archive",
    "bun",
    [
      "./tools/change-plan/tests/lifecycle.test.ts",
      "./tools/change-plan/tests/archive.test.ts"
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
    "release",
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
    "release",
    "test:decision-records:query-and-index-projection",
    "bun",
    [
      "./tools/decision-records/tests/first-establishment.test.ts",
      "./tools/decision-records/tests/index-maintenance.test.ts",
      "./tools/decision-records/tests/queries.test.ts"
    ]
  ],
  [
    "release",
    "test:decision-records:lifecycle-and-recovery",
    "bun",
    [
      "./tools/decision-records/tests/activation-archive.test.ts",
      "./tools/decision-records/tests/candidate-lifecycle.test.ts",
      "./tools/decision-records/tests/candidate-scaffold.test.ts",
      "./tools/decision-records/tests/evolution.test.ts",
      "./tools/decision-records/tests/lifecycle-relations.test.ts",
      "./tools/decision-records/tests/transaction-recovery.test.ts",
      "./tools/decision-records/tests/unrecorded-history.test.ts"
    ]
  ],
  [
    "release",
    "test:decision-records:pending-stage",
    "bun",
    ["./tools/decision-records/tests/stage.test.ts"]
  ],
  [
    "release",
    "test:decision-records:public-distribution",
    "bun",
    [
      "./tools/decision-records/tests/cli-args.test.ts",
      "./tools/decision-records/tests/generated-artifacts.test.ts"
    ]
  ],
  [
    "release",
    "test:investigation-report:collection-and-resources",
    "bun",
    [
      "./tools/investigation-report/tests/parsing-directory.test.ts",
      "./tools/investigation-report/tests/resources.test.ts",
      "./tools/investigation-report/tests/relations.test.ts"
    ]
  ],
  [
    "release",
    "test:investigation-report:index-and-query",
    "bun",
    [
      "./tools/investigation-report/tests/index-query.test.ts",
      "./tools/investigation-report/tests/scale.test.ts"
    ]
  ],
  [
    "release",
    "test:investigation-report:transactional-maintenance",
    "bun",
    [
      "./tools/investigation-report/tests/transaction.test.ts",
      "./tools/investigation-report/tests/discard.test.ts"
    ]
  ],
  [
    "release",
    "test:investigation-report:pending-stage",
    "bun",
    ["./tools/investigation-report/tests/staging.test.ts"]
  ],
  [
    "release",
    "test:investigation-report:cli-contract",
    "bun",
    ["./tools/investigation-report/tests/cli-generated.test.ts"]
  ],
  [
    "release",
    "test:task-graph:index-and-projection",
    "bun",
    [
      "./tools/task-graph/tests/schema-index.test.ts",
      "./tools/task-graph/tests/graph-projection.test.ts"
    ]
  ],
  [
    "release",
    "test:task-graph:task-lifecycle",
    "bun",
    [
      "./tools/task-graph/tests/lifecycle.test.ts",
      "./tools/task-graph/tests/task-removal.test.ts"
    ]
  ],
  [
    "release",
    "test:task-graph:runtime-and-store",
    "bun",
    [
      "./tools/task-graph/tests/runtime.test.ts",
      "./tools/task-graph/tests/store.test.ts"
    ]
  ],
  [
    "release",
    "test:task-graph:native-store",
    "node",
    ["./tools/task-graph/tests/native-store.test.ts"]
  ],
  [
    "release",
    "test:task-graph:cli-rendering",
    "bun",
    [
      "./tools/task-graph/tests/cli.test.ts",
      "./tools/task-graph/tests/task-list-renderer.test.ts"
    ]
  ],
  [
    "release",
    "test:task-graph:pending-stage",
    "bun",
    ["./tools/task-graph/tests/staging.test.ts"]
  ],
  [
    "release",
    "test:task-graph:public-distribution",
    "bun",
    ["./tools/task-graph/tests/generated-artifacts.test.ts"]
  ],
  [
    "release",
    "test:task-graph:portable-build",
    "bun",
    ["./tools/task-graph/tests/portable-build.test.ts"]
  ],
  [
    "release",
    "test:test-evidence:catalog-contract",
    "bun",
    ["./tools/test-evidence/tests/catalog.test.ts"]
  ],
  [
    "release",
    "test:test-evidence:ledger-source-and-relations",
    "bun",
    [
      "./tools/test-evidence/tests/ledger-source.test.ts",
      "./tools/test-evidence/tests/ledger-relations.test.ts"
    ]
  ],
  [
    "release",
    "test:test-evidence:ledger-index-and-query",
    "bun",
    [
      "./tools/test-evidence/tests/ledger-api.test.ts",
      "./tools/test-evidence/tests/ledger-index.test.ts",
      "./tools/test-evidence/tests/repository-catalog.test.ts"
    ]
  ],
  [
    "release",
    "test:test-evidence:ledger-cli",
    "bun",
    ["./tools/test-evidence/tests/ledger-cli.test.ts"]
  ],
  [
    "release",
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
    "test:task-graph:portable-build",
    "./tools/task-graph/tests/portable-build.test.ts"
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
  assert.equal(
    baseDefinition.checks.some(({ checkId }) => checkId === "pack:skills"),
    true
  );
  assert.equal(baseDefinition.scheduler.maxParallel, 4);
  assert.deepEqual(baseDefinition.outputs, {
    diagnosticLogging: { enabled: false, directory: ".log/vibe-check" },
    machinePublication: {
      enabled: true,
      directory: ".log/vibe-check/publication"
    },
    progressRendering: { enabled: true }
  });
  assert.equal(releaseRequiredCheckIds.length, 57);
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
  assert.equal(semanticFiles.length, 60);
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

test("inactive release Checks remain visible without starting their original preflight or execution", async () => {
  let originalPreflightCalls = 0;
  let releaseExecutionCalls = 0;
  const definition = defineConfig({
    checks: [
      defineCheck({
        checkId: "base",
        displayName: "base",
        execution: () => ({ status: "passed" as const, data: {} })
      }),
      activateGateCheck(
        defineCheck({
          checkId: "release",
          displayName: "release",
          preflight: () => {
            originalPreflightCalls += 1;
            return { status: "success" as const, preparedOptions: {} };
          },
          execution: () => {
            releaseExecutionCalls += 1;
            return { status: "passed" as const, data: {} };
          }
        }),
        "release",
        []
      )
    ],
    outputs: noOutput
  });
  const result = completed(
    await run(definition, {
      checkAggregation: { ...aggregateOptions, checks: ["base"] },
      flags: [],
      outputs: noOutput,
      projectRoot: repositoryRoot
    })
  );
  assert.equal(result.aggregate, "passed");
  assert.equal(result.snapshot.checks.length, 2);
  assert.equal(outcomeFor(result, "release").status, "unavailable");
  assert.equal(
    result.checkDurations.find(({ checkId }) => checkId === "release")
      ?.durationMs,
    null
  );
  assert.equal(originalPreflightCalls, 0);
  assert.equal(releaseExecutionCalls, 0);
  const releaseOutcome = outcomeFor(result, "release");
  if (releaseOutcome.status !== "unavailable") {
    throw new Error("expected inactive release Check to be unavailable");
  }
  assert.equal(releaseOutcome.reason.code, "gate-tag-not-enabled");
});

test("critical-rank scheduling follows the dependency critical path and preserves incomplete-hint order", () => {
  const checks = [
    defineCheck({
      checkId: "independent",
      displayName: "independent",
      execution: () => ({ status: "passed" as const, data: {} })
    }),
    defineCheck({
      checkId: "chain-start",
      displayName: "chain-start",
      execution: () => ({ status: "passed" as const, data: {} })
    }),
    defineCheck({
      checkId: "chain-terminal",
      dependsOn: ["chain-start"],
      displayName: "chain-terminal",
      execution: () => ({ status: "passed" as const, data: {} })
    }),
    defineCheck({
      checkId: "tie-left",
      displayName: "tie-left",
      execution: () => ({ status: "passed" as const, data: {} })
    }),
    defineCheck({
      checkId: "tie-right",
      displayName: "tie-right",
      execution: () => ({ status: "passed" as const, data: {} })
    })
  ];
  const ordered = orderRootChecksByCriticalRank(
    checks,
    new Map([
      ["independent", 99],
      ["chain-start", 1],
      ["chain-terminal", 100],
      ["tie-left", 5],
      ["tie-right", 5]
    ])
  );
  assert.deepEqual(
    ordered.map(({ checkId }) => checkId),
    ["chain-start", "chain-terminal", "independent", "tie-left", "tie-right"]
  );
  assert.equal(orderRootChecksByCriticalRank(checks, undefined), checks);
  assert.equal(
    orderRootChecksByCriticalRank(checks, new Map([["chain-start", 1]])),
    checks
  );
  const cycle = [
    defineCheck({
      checkId: "left",
      dependsOn: ["right"],
      displayName: "left",
      execution: () => ({ status: "passed" as const, data: {} })
    }),
    defineCheck({
      checkId: "right",
      dependsOn: ["left"],
      displayName: "right",
      execution: () => ({ status: "passed" as const, data: {} })
    })
  ];
  assert.equal(
    orderRootChecksByCriticalRank(
      cycle,
      new Map([
        ["left", 1],
        ["right", 1]
      ])
    ),
    cycle
  );
});
test("completed duration hints are isolated by active tag set and only alter later admission order", async () => {
  await withTemporaryDirectory(
    "skills-vibe-scheduling-hints-",
    async (directory) => {
      const schedulingHints = createGateSchedulingHints(directory);
      const baseCheckIds = activeGateCheckIds([]);
      const releaseCheckIds = activeGateCheckIds(["release"]);
      await schedulingHints.write([], baseCheckIds, [
        ...baseCheckIds.map((checkId, index) => ({
          checkId,
          durationMs: index + 1
        })),
        { checkId: "unknown", durationMs: 1 }
      ]);
      const baseHints = await schedulingHints.read([], baseCheckIds);
      assert.equal(baseHints.size, baseCheckIds.length);
      await schedulingHints.write(["release"], releaseCheckIds, [
        { checkId: releaseCheckIds[0] ?? "", durationMs: 1 }
      ]);
      assert.deepEqual(
        [...(await schedulingHints.read([], baseCheckIds))],
        [...baseHints]
      );
      const firstDefinition = createGateDefinition([], {
        nativeChecks: passingNativeChecks(),
        runCommand: completedScript()
      });
      const orderedDefinition = createGateDefinition([], {
        durationHints: baseHints,
        nativeChecks: passingNativeChecks(),
        runCommand: completedScript()
      });
      assert.notEqual(orderedDefinition.checks, firstDefinition.checks);
      assert.notDeepEqual(
        orderedDefinition.checks
          .filter(({ checkId }) => baseCheckIds.includes(checkId))
          .map(({ checkId }) => checkId),
        firstDefinition.checks
          .filter(({ checkId }) => baseCheckIds.includes(checkId))
          .map(({ checkId }) => checkId)
      );
      assert.deepEqual(
        orderedDefinition.checks
          .filter(({ checkId }) => !baseCheckIds.includes(checkId))
          .map(({ checkId }) => checkId),
        firstDefinition.checks
          .filter(({ checkId }) => !baseCheckIds.includes(checkId))
          .map(({ checkId }) => checkId)
      );
      await fs.writeFile(
        path.join(directory, schedulingHintsRelativePath([])),
        "{"
      );
      const corruptHints = await schedulingHints.read([], baseCheckIds);
      assert.equal(corruptHints.size, 0);
    }
  );
});
test("scheduling-hint I/O failures never change Vibe gate results or store incomplete Runs", async () => {
  const passedDefinition = defineConfig({
    checks: [
      defineCheck({
        checkId: "passed",
        displayName: "passed",
        execution: () => ({ status: "passed" as const, data: {} })
      })
    ],
    outputs: noOutput
  });
  const failedDefinition = defineConfig({
    checks: [
      defineCheck({
        checkId: "failed",
        displayName: "failed",
        execution: () => ({ status: "failed" as const, data: {} })
      })
    ],
    outputs: noOutput
  });
  let writes = 0;
  const brokenHints = {
    async read() {
      throw new Error("cannot read hints");
    },
    async write() {
      writes += 1;
      throw new Error("cannot write hints");
    }
  };
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => passedDefinition,
      runProject: async () =>
        await run(passedDefinition, {
          checkAggregation: aggregateOptions,
          outputs: noOutput,
          projectRoot: repositoryRoot
        }),
      schedulingHints: brokenHints
    }),
    0
  );
  assert.equal(writes, 1);

  let failedWrites = 0;
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => failedDefinition,
      reportError: () => undefined,
      runProject: async () =>
        await run(failedDefinition, {
          checkAggregation: aggregateOptions,
          outputs: noOutput,
          projectRoot: repositoryRoot
        }),
      schedulingHints: {
        async read() {
          return new Map();
        },
        async write() {
          failedWrites += 1;
        }
      }
    }),
    1
  );
  assert.equal(failedWrites, 0);

  let incompleteWrites = 0;
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => passedDefinition,
      reportError: () => undefined,
      runProject: async (_definition, controls) => await run({}, controls),
      schedulingHints: {
        async read() {
          return new Map();
        },
        async write() {
          incompleteWrites += 1;
        }
      }
    }),
    1
  );
  assert.equal(incompleteWrites, 0);
});

test("package script adapter maps terminal results and settles independent Checks", async () => {
  await withTemporaryDirectory("skills-vibe-adapter-", async (directory) => {
    const calls: GateCommandInvocation[] = [];
    const failedScript = "test:relation-graph";
    const failedResult = await runDefinition(
      createGateDefinition([], {
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

test("CLI parses release tags and compatibility alias, then maps Vibe results to exit codes", async () => {
  const diagnostics: string[] = [];
  const information: string[] = [];
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
  let schedulingHintWrites = 0;
  const schedulingHints = {
    async read() {
      return new Map<string, number>();
    },
    async write() {
      schedulingHintWrites += 1;
    }
  } satisfies GateSchedulingHints;
  const dependencies = {
    createDefinition(invocation: GateInvocation) {
      selectedInvocation = invocation;
      return passedDefinition;
    },
    reportError(message: string) {
      diagnostics.push(message);
    },
    reportInfo(message: string) {
      information.push(message);
    },
    async runProject(definition: unknown, controls?: unknown) {
      return await run(definition, {
        ...(controls as object),
        checkAggregation: aggregateOptions
      });
    },
    schedulingHints
  };

  assert.deepEqual(resolveGateInvocation([]), {
    diagnosticLog: false,
    tags: []
  });
  assert.deepEqual(resolveGateInvocation(["--diagnostic-log"]), {
    diagnosticLog: true,
    tags: []
  });
  assert.deepEqual(resolveGateInvocation(["--full"]), {
    baselineRef: "HEAD",
    diagnosticLog: false,
    tags: ["release"]
  });
  assert.deepEqual(resolveGateInvocation(["--tag", "release"]), {
    baselineRef: "HEAD",
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
    { baselineRef: "origin/release", diagnosticLog: true, tags: ["release"] }
  );
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
    diagnosticLog: false,
    tags: []
  });
  assert.deepEqual(information, []);
  assert.equal(
    await runVibeCheck(
      ["--full", "--baseline-ref", "origin/release"],
      dependencies
    ),
    0
  );
  assert.deepEqual(selectedInvocation, {
    baselineRef: "origin/release",
    diagnosticLog: false,
    tags: ["release"]
  });
  let diagnosticControls: unknown;
  await withTemporaryDirectory(
    "skills-vibe-diagnostic-log-",
    async (directory) => {
      assert.equal(
        await runVibeCheck(["--diagnostic-log"], {
          ...dependencies,
          async runProject(definition: unknown, controls?: unknown) {
            diagnosticControls = controls;
            return run(definition, {
              checkAggregation: aggregateOptions,
              outputs: {
                diagnosticLogging: {
                  directory: ".log/vibe-check",
                  enabled: true
                }
              },
              projectRoot: directory
            });
          }
        }),
        0
      );
    }
  );
  assert.deepEqual(selectedInvocation, {
    diagnosticLog: true,
    tags: []
  });
  assert.ok(diagnosticControls && typeof diagnosticControls === "object");
  assert.deepEqual(diagnosticControls, {
    checkAggregation: {
      checks: activeGateCheckIds([]),
      empty: "failed",
      mode: "all",
      notApplicable: "fail",
      unavailable: "fail"
    },
    flags: [],
    outputs: {
      diagnosticLogging: { directory: ".log/vibe-check", enabled: true }
    },
    projectRoot: repositoryRoot
  });
  assert.match(
    information.at(-1) ?? "",
    /^Vibe Check diagnostic log: \.log\/vibe-check\/run-.+\.log$/u
  );
  const failedDiagnostics: string[] = [];
  const failedInformation: string[] = [];
  await withTemporaryDirectory(
    "skills-vibe-diagnostic-log-failure-",
    async (directory) => {
      assert.equal(
        await runVibeCheck(["--diagnostic-log"], {
          createDefinition: () => failedDefinition,
          reportError: (message) => failedDiagnostics.push(message),
          reportInfo: (message) => failedInformation.push(message),
          schedulingHints,
          async runProject(definition: unknown) {
            return run(definition, {
              checkAggregation: aggregateOptions,
              outputs: {
                diagnosticLogging: {
                  directory: ".log/vibe-check",
                  enabled: true
                }
              },
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
  assert.match(
    failedInformation.at(-1) ?? "",
    /^Vibe Check diagnostic log: \.log\/vibe-check\/run-.+\.log$/u
  );
  const configurationDiagnostics: string[] = [];
  const configurationInformation: string[] = [];
  assert.equal(
    await runVibeCheck(["--diagnostic-log"], {
      createDefinition: () => passedDefinition,
      reportError: (message) => configurationDiagnostics.push(message),
      reportInfo: (message) => configurationInformation.push(message),
      schedulingHints,
      async runProject(_definition: unknown, controls?: unknown) {
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
      reportError: (message) => diagnostics.push(message),
      schedulingHints
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
      reportError: (message) => diagnostics.push(message),
      schedulingHints
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
      reportError: (message) => diagnostics.push(message),
      schedulingHints
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => invalidDefinition,
      reportError: (message) => diagnostics.push(message),
      schedulingHints
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);
  assert.equal(
    await runVibeCheck([], {
      createDefinition: () => unknownDependencyDefinition,
      reportError: (message) => diagnostics.push(message),
      schedulingHints
    }),
    1
  );
  assert.match(diagnostics.at(-1) ?? "", /Vibe Check invocation failed: /u);
  assert.equal(information.length, 1);
  assert.equal(schedulingHintWrites, 3);
});

test("release prepare runs before terminal authorization and package", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-timing-",
    async (directory) => {
      await createReleaseRepository(directory);
      const definition = createGateDefinition(["release"], {
        baselineRef: "HEAD",
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
        (await runDefinition(definition, directory)).aggregate,
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
        directory
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
          nativeChecks: passingNativeChecks(),
          runCommand: completedScript()
        }),
        directory
      );
      assert.equal(
        outcomeFor(versionFailed, "release:skill-version").status,
        "failed"
      );
      assert.notEqual(
        outcomeFor(versionFailed, "pack:skills").status,
        "passed"
      );
      assert.equal(await fileExists(path.join(directory, "dist")), false);

      const unavailable = await runDefinition(
        createGateDefinition(["release"], {
          nativeChecks: passingNativeChecks(),
          prepareRelease: async () => {
            throw new Error("Git resolver unavailable");
          },
          runCommand: completedScript()
        }),
        directory
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
          createGateDefinition(["release"], {
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
