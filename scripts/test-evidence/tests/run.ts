import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runTestEvidenceCli,
  validateTestEvidence as validateBundledTestEvidence
} from "../../../skills/test-evidence-review/scripts/test-evidence.mjs";
import { validateTestEvidence } from "../src/validation.ts";

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
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-"));

try {
  const workspaceRoot = path.join(tempRoot, "valid");
  await writeWorkspace(workspaceRoot);

  const valid = await validateTestEvidence({ workspaceRoot });
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
  assert.deepEqual(
    await validateBundledTestEvidence({ workspaceRoot }),
    valid
  );
  assert.equal(typeof runTestEvidenceCli, "function");

  const absoluteConfigPath = await validateTestEvidence({
    configPath: "C:\\outside.json",
    workspaceRoot
  });
  assert.ok(absoluteConfigPath.errors.some((error) =>
    error.includes("config path must be a workspace-relative path")
  ));

  const cliReport = JSON.parse(execFileSync(
    "node",
    [generatedCliPath, "check", "--root", workspaceRoot, "--json"],
    { encoding: "utf8" }
  )) as {
    errors: string[];
    reviewTriggers: unknown[];
    warnings: string[];
  };
  assert.deepEqual(cliReport.errors, []);
  assert.deepEqual(cliReport.warnings, []);
  assert.deepEqual(cliReport.reviewTriggers, []);

  const humanCli = spawnSync(
    "node",
    [generatedCliPath, "check", "--root", workspaceRoot],
    { encoding: "utf8" }
  );
  assert.equal(humanCli.status, 0);
  assert.equal(humanCli.stderr, "");
  assert.match(humanCli.stdout, /4 discovered test entry\(s\), 0 unregistered/);

  await fs.appendFile(
    path.join(workspaceRoot, "src/process/worker.ts"),
    "\nexport const dirty = true;\n",
    "utf8"
  );
  const dirtyReview = await validateTestEvidence({ workspaceRoot });
  assert.equal(dirtyReview.reviewTriggers.length, 1);
  assert.equal(dirtyReview.reviewTriggers[0]?.caseId, "RV-PROCESS-CLEANUP-001");
  assert.deepEqual(dirtyReview.reviewTriggers[0]?.paths, ["src/process/worker.ts"]);
  assert.ok(dirtyReview.errors.some((error) =>
    error.includes("RV-PROCESS-CLEANUP-001 requires review")
    && error.includes("dirty worktree paths match Scope")
  ));

  const committedReviewRoot = path.join(tempRoot, "committed-review");
  await writeWorkspace(committedReviewRoot);
  await fs.appendFile(
    path.join(committedReviewRoot, "src/process/worker.ts"),
    "\nexport const committedChange = true;\n",
    "utf8"
  );
  commitAll(committedReviewRoot, "change reviewed scope");
  const committedReview = await validateTestEvidence({
    workspaceRoot: committedReviewRoot
  });
  assert.equal(committedReview.reviewTriggers.length, 1);
  assert.ok(committedReview.reviewTriggers[0]?.reasons.includes(
    "committed paths changed after Reviewed-Commit"
  ));

  const overdueReviewRoot = path.join(tempRoot, "overdue-review");
  await writeWorkspace(overdueReviewRoot);
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
  const overdueReview = await validateTestEvidence({
    workspaceRoot: overdueReviewRoot
  });
  assert.ok(overdueReview.warnings.some((warning) =>
    warning.includes("exceeding reviewMaxAgeDays 30")
  ));

  const unavailableBaselineRoot = path.join(tempRoot, "unavailable-baseline");
  await writeWorkspace(unavailableBaselineRoot);
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
  const unavailableBaseline = await validateTestEvidence({
    workspaceRoot: unavailableBaselineRoot
  });
  assert.deepEqual(unavailableBaseline.errors, []);
  assert.equal(unavailableBaseline.reviewTriggers.length, 1);
  assert.ok(unavailableBaseline.warnings.some((warning) =>
    warning.includes(`Reviewed-Commit ${"0".repeat(40)} is unavailable`)
  ));

  execGit(workspaceRoot, ["checkout", "--", "src/process/worker.ts"]);
  await writeFile(workspaceRoot, "README.md", "Unrelated dirty documentation.\n");
  const unrelatedDirty = await validateTestEvidence({ workspaceRoot });
  assert.deepEqual(unrelatedDirty.errors, []);
  assert.deepEqual(unrelatedDirty.reviewTriggers, []);

  const entryInvalidRoot = path.join(tempRoot, "entry-invalid");
  await writeWorkspace(entryInvalidRoot);
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
  const entryInvalid = await validateTestEvidence({ workspaceRoot: entryInvalidRoot });
  assertIncludesAll(entryInvalid.errors, [
    "src/calc.test.ts:4:1 contains a typescript test entry",
    "every entry must have exactly one @test-evidence marker",
    "does not directly precede a discovered test entry"
  ]);

  const catalogInvalidRoot = path.join(tempRoot, "catalog-invalid");
  await writeWorkspace(catalogInvalidRoot);
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

async function writeWorkspace(workspaceRoot: string): Promise<void> {
  await writeFile(
    workspaceRoot,
    ".test-evidence.json",
    `${JSON.stringify({
      reviewTriggers: "error",
      schemaVersion: 2,
      unregisteredTestEntries: "error"
    }, null, 2)}\n`
  );
  await writeFile(
    workspaceRoot,
    "docs/testing/cases.md",
    createCatalog()
  );
  await writeFile(
    workspaceRoot,
    "src/calc.test.ts",
    [
      "// @test-evidence main WB-CALC-ADD-001",
      "test(\"positive operands\", async () => {",
      "  await test.step(\"calculate\", async () => {});",
      "});",
      "",
      "test.describe(\"calculator\", () => {});",
      "test.beforeEach(() => {});",
      "",
      "// @test-evidence derived WB-CALC-ADD-001",
      "test.each([[0, 0]])(\"zero operands\", () => {});"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "tests/test_calc.py",
    [
      "# @test-evidence derived WB-CALC-ADD-001",
      "def test_addition_boundary():",
      "    assert True"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "tests/generated_test.go",
    [
      "// @test-evidence exempt EX-GENERATED-FIXTURE-001",
      "func TestGeneratedCompatibility(t *testing.T) {}"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "src/process/worker.ts",
    "export function stopChild(): void {}\n"
  );

  initializeGit(workspaceRoot);
  const reviewedCommit = commitAll(workspaceRoot, "initial evidence");
  await writeFile(
    workspaceRoot,
    "docs/testing/cases.md",
    createCatalog(reviewedCommit)
  );
  commitAll(workspaceRoot, "record completed review");
}

function createCatalog(reviewedCommit?: string): string {
  const reviewState = reviewedCommit === undefined
    ? []
    : [
        "Review-Result: pass",
        "Reviewed-At: 2026-07-20T10:30:00+08:00",
        `Reviewed-Commit: ${reviewedCommit}`,
        ""
      ];
  return [
    "# Test cases",
    "",
    "### Case WB-CALC-ADD-001: Addition remains observable",
    "Status: active",
    "Verification: automated",
    "Code: `src/calc.test.ts`",
    "",
    "Contract:",
    "- Addition returns the mathematical sum and preserves the additive identity.",
    "",
    "Proves:",
    "- Positive operands return their sum.",
    "- Zero operands preserve the additive identity.",
    "",
    "```mermaid",
    "flowchart LR",
    "  base[\"Shared calculator fixture\"] --> kind{\"Operand branch\"}",
    "  kind -->|\"positive\"| positive[\"Returns the sum\"]",
    "  kind -->|\"zero\"| zero[\"Returns zero\"]",
    "```",
    "",
    "### Case WB-CALC-FUTURE-001: Future behavior remains explicit",
    "Status: planned",
    "Verification: automated",
    "",
    "Contract:",
    "- A future public calculation rule requires an explicit proof target.",
    "",
    "Proves:",
    "- The future result remains observable.",
    "",
    "### Case RV-PROCESS-CLEANUP-001: Child process cleanup remains safe",
    "Status: active",
    "Verification: review",
    "",
    "Contract:",
    "- Every process exit path releases the child process and temporary resources.",
    "",
    "Scope:",
    "- `src/process/**`",
    "",
    "Risk:",
    "- Abnormal termination may leave a child process running.",
    "",
    "Reason:",
    "- Reliable automation requires disproportionate operating-system fault injection.",
    "",
    "Review:",
    "- Confirm every failure path terminates the child process.",
    "",
    ...reviewState,
    "### Case EX-GENERATED-FIXTURE-001: Generated fixture is not project evidence",
    "Status: active",
    "Verification: exempt",
    "",
    "Scope:",
    "- `tests/generated_test.go`",
    "",
    "Reason:",
    "- The file is read as fixture data and never executed as a project test.",
    ""
  ].join("\n");
}

function initializeGit(workspaceRoot: string): void {
  execGit(workspaceRoot, ["init", "-q"]);
  execGit(workspaceRoot, ["config", "core.autocrlf", "false"]);
}

function commitAll(workspaceRoot: string, message: string): string {
  execGit(workspaceRoot, ["add", "."]);
  execGit(workspaceRoot, [
    "-c",
    "user.email=test-evidence@example.invalid",
    "-c",
    "user.name=Test Evidence",
    "commit",
    "-qm",
    message
  ]);
  return execGit(workspaceRoot, ["rev-parse", "HEAD"]).trim();
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

async function writeFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}
