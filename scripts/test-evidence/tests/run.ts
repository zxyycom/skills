import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  runTestEvidenceCli,
  validateTestEvidence as validateBundledTestEvidence
} from "../../../skills/test-evidence-review/scripts/test-evidence.mjs";
import { formatTestEvidenceCliOutput } from "../src/cli-output.ts";
import { validateTestEvidence } from "../src/validation.ts";

const execFileAsync = promisify(execFile);
const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const generatedCliPath = path.join(
  rootDir,
  "skills",
  "test-evidence-review",
  "scripts",
  "test-evidence.mjs"
);
const generatedDeclarationPath = path.join(
  rootDir,
  "skills",
  "test-evidence-review",
  "scripts",
  "test-evidence.d.mts"
);
const fixtureBundlePath = path.join(
  testsDirectory,
  "fixtures",
  "reviewed-workspace.bundle"
);
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-"));

try {
  const fixtureRepositoryPath = initializeFixtureRepository();
  // Keep shared-repository writes serialized, then release isolated read checks together.
  const validationGate = Promise.withResolvers<void>();
  const validationTasks: Promise<void>[] = [];
  const workspaceRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "valid"
  );

  validationTasks.push(validationGate.promise.then(async () => {
    const valid = await validateBundledTestEvidence({ workspaceRoot });
    assert.deepEqual(valid.errors, []);
    assert.deepEqual(valid.warnings, []);
    assert.deepEqual(valid.reviewTriggers, []);
    assert.deepEqual(valid.summary, {
      activeAutomatedCases: 1,
      catalogCases: 4,
      derivedMarkers: 2,
      discoveredTestEntries: 4,
      discoveredTestFiles: 3,
      exemptCases: 1,
      exemptMarkers: 1,
      exemptTestEntries: 1,
      mainMarkers: 1,
      plannedAutomatedCases: 1,
      reviewCases: 1,
      reviewTriggers: 0,
      unregisteredTestEntries: 0
    });

    const absoluteConfigPath = await validateTestEvidence({
      configPath: "C:\\outside.json",
      workspaceRoot
    });
    assert.ok(absoluteConfigPath.errors.some((error) =>
      error.includes("config path must be a workspace-relative path")
    ));

    const humanOutput = formatTestEvidenceCliOutput(valid, false);
    assert.equal(humanOutput.stderr, "");
    assert.match(
      humanOutput.stdout,
      /4 discovered test entry\(s\), 0 unregistered/
    );
  }));
  validationTasks.push(validationGate.promise.then(async () => {
    const nodeCli = await execFileAsync(
      "node",
      [generatedCliPath, "check", "--root", workspaceRoot, "--json"],
      {
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.equal(nodeCli.stderr, "");
    const cliReport = JSON.parse(nodeCli.stdout) as {
      errors: string[];
      reviewTriggers: unknown[];
      warnings: string[];
    };
    assert.deepEqual(cliReport.errors, []);
    assert.deepEqual(cliReport.warnings, []);
    assert.deepEqual(cliReport.reviewTriggers, []);
  }));

  const dirtyReviewRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "dirty-review"
  );
  await fs.appendFile(
    path.join(dirtyReviewRoot, "src/process/worker.ts"),
    "\nexport const dirty = true;\n",
    "utf8"
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const dirtyReview = await validateTestEvidence({
      workspaceRoot: dirtyReviewRoot
    });
    assert.equal(dirtyReview.reviewTriggers.length, 1);
    assert.equal(
      dirtyReview.reviewTriggers[0]?.caseId,
      "RV-PROCESS-CLEANUP-001"
    );
    assert.deepEqual(
      dirtyReview.reviewTriggers[0]?.paths,
      ["src/process/worker.ts"]
    );
    assert.ok(dirtyReview.errors.some((error) =>
      error.includes("RV-PROCESS-CLEANUP-001 requires review")
      && error.includes("dirty worktree paths match Scope")
    ));
  }));

  const committedReviewRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "committed-review"
  );
  await fs.appendFile(
    path.join(committedReviewRoot, "src/process/worker.ts"),
    "\nexport const committedChange = true;\n",
    "utf8"
  );
  commitAll(committedReviewRoot, "change reviewed scope");
  validationTasks.push(validationGate.promise.then(async () => {
    const committedReview = await validateTestEvidence({
      workspaceRoot: committedReviewRoot
    });
    assert.equal(committedReview.reviewTriggers.length, 1);
    assert.ok(committedReview.reviewTriggers[0]?.reasons.includes(
      "committed paths changed after Reviewed-Commit"
    ));
  }));

  const overdueReviewRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "overdue-review"
  );
  await writeFile(
    overdueReviewRoot,
    ".test-evidence.json",
    `${JSON.stringify({
      reviewMaxAgeDays: 30,
      reviewTriggers: "error",
      schemaVersion: 2,
      unregisteredTestEntries: "error"
    }, null, 2)}\n`
  );
  const overdueCatalogPath = path.join(
    overdueReviewRoot,
    "docs/testing/cases.md"
  );
  const overdueCatalog = await fs.readFile(overdueCatalogPath, "utf8");
  await fs.writeFile(
    overdueCatalogPath,
    overdueCatalog.replace(
      "Reviewed-At: 2026-07-20T10:30:00+08:00",
      "Reviewed-At: 2020-01-01T00:00:00Z"
    ),
    "utf8"
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const overdueReview = await validateTestEvidence({
      workspaceRoot: overdueReviewRoot
    });
    assert.ok(overdueReview.warnings.some((warning) =>
      warning.includes("exceeding reviewMaxAgeDays 30")
    ));
  }));

  const unavailableBaselineRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "unavailable-baseline"
  );
  await writeFile(
    unavailableBaselineRoot,
    ".test-evidence.json",
    `${JSON.stringify({
      reviewTriggers: "warn",
      schemaVersion: 2,
      unregisteredTestEntries: "error"
    }, null, 2)}\n`
  );
  const unavailableCatalogPath = path.join(
    unavailableBaselineRoot,
    "docs/testing/cases.md"
  );
  const unavailableCatalog = await fs.readFile(unavailableCatalogPath, "utf8");
  await fs.writeFile(
    unavailableCatalogPath,
    unavailableCatalog.replace(
      /Reviewed-Commit: [0-9a-f]{40}/u,
      `Reviewed-Commit: ${"0".repeat(40)}`
    ),
    "utf8"
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const unavailableBaseline = await validateTestEvidence({
      workspaceRoot: unavailableBaselineRoot
    });
    assert.deepEqual(unavailableBaseline.errors, []);
    assert.equal(unavailableBaseline.reviewTriggers.length, 1);
    assert.ok(unavailableBaseline.warnings.some((warning) =>
      warning.includes(`Reviewed-Commit ${"0".repeat(40)} is unavailable`)
    ));
  }));

  const unrelatedDirtyRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "unrelated-dirty"
  );
  await writeFile(
    unrelatedDirtyRoot,
    "README.md",
    "Unrelated dirty documentation.\n"
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const unrelatedDirty = await validateTestEvidence({
      workspaceRoot: unrelatedDirtyRoot
    });
    assert.deepEqual(unrelatedDirty.errors, []);
    assert.deepEqual(unrelatedDirty.reviewTriggers, []);
  }));

  const entryInvalidRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "entry-invalid"
  );
  await writeFile(
    entryInvalidRoot,
    "src/calc.test.ts",
    [
      "// @test-evidence main WB-CALC-ADD-001",
      "test(\"positive operands\", () => {});",
      "",
      "test(\"unregistered zero branch\", () => {});"
    ].join("\n")
  );
  await writeFile(
    entryInvalidRoot,
    "tests/multiple-marker.test.js",
    [
      "// @test-evidence derived WB-CALC-ADD-001",
      "// @test-evidence derived WB-CALC-ADD-001",
      "test(\"one entry cannot have two markers\", () => {});"
    ].join("\n")
  );
  await writeFile(
    entryInvalidRoot,
    "tests/orphan.test.js",
    [
      "// @test-evidence derived WB-CALC-ADD-001",
      "const setup = true;"
    ].join("\n")
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const entryInvalid = await validateTestEvidence({
      workspaceRoot: entryInvalidRoot
    });
    assertIncludesAll(entryInvalid.errors, [
      "src/calc.test.ts:4:1 contains a typescript test entry",
      "every entry must have exactly one @test-evidence marker",
      "does not directly precede a discovered test entry"
    ]);
  }));

  const catalogInvalidRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "catalog-invalid"
  );
  await appendCatalog(
    catalogInvalidRoot,
    [
      "",
      "### Notes",
      "This ordinary level-three heading is not a case.",
      "",
      "```markdown",
      "### Case WB-FENCED-EXAMPLE-001: This example is ignored",
      "Status: active",
      "Verification: automated",
      "```",
      "",
      "  ### Case WB-INDENTED-CASE-001: Indented syntax is not the fixed form",
      "Status: planned",
      "Verification: automated",
      "",
      "Contract:",
      "- A fixed heading syntax keeps IDs unambiguous.",
      "",
      "Proves:",
      "- The heading starts at column one.",
      "",
      "### Case WB-BAD ID: The ID and title delimiter is malformed",
      "Status: active",
      "Verification: automated",
      "",
      "### Case WB-MISSING-CONTRACT-001: Automated case without a contract",
      "Status: active",
      "Verification: automated",
      "Code: `src/missing-contract.test.ts`",
      "",
      "Contract:",
      "This paragraph does not satisfy the required list.",
      "- This later list must not be absorbed into Contract.",
      "",
      "Proves:",
      "- A result exists.",
      "",
      "### Case RV-BAD-GLOB-001: Review case with an invalid glob",
      "Status: active",
      "Verification: review",
      "",
      "Contract:",
      "- Cleanup must release process resources on every failure path.",
      "",
      "Scope:",
      "- `src/process/[`",
      "",
      "Risk:",
      "- A child process may remain alive.",
      "",
      "Reason:",
      "- Fault injection remains disproportionate.",
      "",
      "Review:",
      "- Confirm every failure path terminates the child process.",
      "",
      "### Case RV-NO-GIT-MATCH-001: Review scope must match Git-visible paths",
      "Status: active",
      "Verification: review",
      "",
      "Contract:",
      "- Cleanup review obligations apply to the process implementation.",
      "",
      "Scope:",
      "- `src/does-not-exist/**`",
      "",
      "Risk:",
      "- A hidden path may bypass review.",
      "",
      "Reason:",
      "- The risk requires direct code review.",
      "",
      "Review:",
      "- Inspect every matched path."
    ].join("\n")
  );
  await writeFile(
    catalogInvalidRoot,
    "src/missing-contract.test.ts",
    [
      "// @test-evidence main WB-MISSING-CONTRACT-001",
      "test(\"missing contract\", () => {});"
    ].join("\n")
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const catalogInvalid = await validateTestEvidence({
      workspaceRoot: catalogInvalidRoot
    });
    assertIncludesAll(catalogInvalid.errors, [
      "case heading must use exactly: ### Case <CASE-ID>: <title>",
      "WB-MISSING-CONTRACT-001 must include exactly one non-empty Contract list",
      "RV-BAD-GLOB-001 Scope pattern is invalid",
      "RV-NO-GIT-MATCH-001 Scope pattern src/does-not-exist/** does not match any Git-visible path"
    ]);
    assert.equal(
      catalogInvalid.errors.filter((error) =>
        error.includes("case heading must use exactly")
      ).length,
      2
    );
    assert.equal(catalogInvalid.summary.catalogCases, 9);
  }));

  await assertDirectCliFailure();
  validationGate.resolve();
  await waitForAll(validationTasks);

  const invalidUsage = spawnSync("node", [generatedCliPath, "unknown"], {
    encoding: "utf8"
  });
  assert.equal(invalidUsage.status, 2);
  assert.match(invalidUsage.stderr, /unsupported command/);

  const generatedCli = await fs.readFile(generatedCliPath, "utf8");
  assert.match(generatedCli, /Generated test-evidence CLI/);
  assert.match(generatedCli, /Rebuild: bun run sync:test-evidence-cli/);
  assert.match(generatedCli, /sourceMappingURL=test-evidence\.mjs\.map/);
  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(
    declarationSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/test-evidence\/test-evidence\.d\.mts/
  );
  assert.match(declarationSource, /validateTestEvidence/);
  assert.match(declarationSource, /runTestEvidenceCli/);
  const sourceMap = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8")
  ) as { sourceRoot: string; sources: string[] };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("scripts/test-evidence/src/cli.ts"));
  assert.ok(sourceMap.sources.every((source) => !path.isAbsolute(source) && !source.includes("\\")));
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Test evidence CLI tests passed.");

function initializeFixtureRepository(): string {
  const fixtureRepositoryPath = path.join(tempRoot, "fixture.git");
  execFileSync(
    "git",
    ["clone", "--bare", "--quiet", fixtureBundlePath, fixtureRepositoryPath],
    { windowsHide: true }
  );
  execFileSync(
    "git",
    [
      "--git-dir",
      fixtureRepositoryPath,
      "config",
      "core.autocrlf",
      "false"
    ],
    { windowsHide: true }
  );
  return fixtureRepositoryPath;
}

function materializeWorkspace(
  fixtureRepositoryPath: string,
  fixtureName: string
): string {
  const workspaceRoot = path.join(tempRoot, fixtureName);
  execFileSync(
    "git",
    [
      "--git-dir",
      fixtureRepositoryPath,
      "worktree",
      "add",
      "--detach",
      "--quiet",
      workspaceRoot,
      "refs/heads/main"
    ],
    { windowsHide: true }
  );
  return workspaceRoot;
}

function commitAll(workspaceRoot: string, message: string): void {
  execGit(workspaceRoot, ["add", "."]);
  execGit(workspaceRoot, [
    "-c",
    "core.hooksPath=.git/no-hooks",
    "-c",
    "user.email=test-evidence@example.invalid",
    "-c",
    "user.name=Test Evidence",
    "commit",
    "--no-gpg-sign",
    "--no-verify",
    "-qm",
    message
  ]);
}

function execGit(workspaceRoot: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", workspaceRoot, ...args], {
    encoding: "utf8"
  });
}

async function appendCatalog(workspaceRoot: string, content: string): Promise<void> {
  await fs.appendFile(
    path.join(workspaceRoot, "docs/testing/cases.md"),
    `${content}\n`,
    "utf8"
  );
}

function assertIncludesAll(values: readonly string[], fragments: readonly string[]): void {
  for (const fragment of fragments) {
    assert.ok(
      values.some((value) => value.includes(fragment)),
      `expected one diagnostic to include: ${fragment}\n${values.join("\n")}`
    );
  }
}

async function assertDirectCliFailure(): Promise<void> {
  const stderr: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...values: unknown[]) => {
    stderr.push(values.map(String).join(" "));
  };
  try {
    assert.equal(await runTestEvidenceCli(["unknown"]), 2);
  } finally {
    console.error = originalConsoleError;
  }
  assert.match(stderr.join("\n"), /unsupported command/);
}

async function waitForAll(tasks: readonly Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(tasks);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (failures.length > 0) {
    throw new AggregateError(failures, "Test-evidence validation tasks failed.");
  }
}

async function writeFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}
