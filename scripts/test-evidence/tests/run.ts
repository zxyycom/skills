import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-"));

try {
  const workspaceRoot = path.join(tempRoot, "valid");
  await writeWorkspace(workspaceRoot, "error");

  const valid = await validateTestEvidence({ workspaceRoot });
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(valid.warnings, []);
  assert.deepEqual(valid.summary, {
    activeAutomatedCases: 1,
    catalogCases: 4,
    derivedMarkers: 1,
    discoveredTestFiles: 3,
    exemptCases: 1,
    exemptMarkers: 1,
    exemptTestFiles: 1,
    mainMarkers: 1,
    plannedAutomatedCases: 1,
    reviewCases: 1,
    unregisteredTestFiles: 0
  });

  const absoluteConfigPath = await validateTestEvidence({
    configPath: "C:\\outside.json",
    workspaceRoot
  });
  assert.ok(absoluteConfigPath.errors.some((error) =>
    error.includes("config path must be a workspace-relative path")
  ));

  const driveRelativeConfigPath = await validateTestEvidence({
    configPath: "C:outside.json",
    workspaceRoot
  });
  assert.ok(driveRelativeConfigPath.errors.some((error) =>
    error.includes("config path must be a workspace-relative path")
  ));

  const cliReport = JSON.parse(execFileSync(
    "node",
    [generatedCliPath, "check", "--root", workspaceRoot, "--json"],
    { encoding: "utf8" }
  )) as { errors: string[]; warnings: string[] };
  assert.deepEqual(cliReport.errors, []);
  assert.deepEqual(cliReport.warnings, []);

  const humanCli = spawnSync(
    "node",
    [generatedCliPath, "check", "--root", workspaceRoot],
    { encoding: "utf8" }
  );
  assert.equal(humanCli.status, 0);
  assert.equal(humanCli.stderr, "");
  assert.match(
    humanCli.stdout,
    /1 automated, 1 review, 1 exempt, 1 planned/
  );

  const warningRoot = path.join(tempRoot, "warning");
  await writeWorkspace(warningRoot, "warn");
  await writeFile(
    warningRoot,
    "src/unregistered.rs",
    ["#[test]", "fn unregistered_test() {}"].join("\n")
  );
  const warningReport = await validateTestEvidence({ workspaceRoot: warningRoot });
  assert.deepEqual(warningReport.errors, []);
  assert.ok(warningReport.warnings.some((warning) =>
    warning.includes("src/unregistered.rs contains rust test entries")
  ));

  const invalidRoot = path.join(tempRoot, "invalid");
  await writeWorkspace(invalidRoot, "error");
  await appendCatalog(
    invalidRoot,
    [
      "",
      "### RV-MISSING-REASON-001 Review case without a reason",
      "Status: active",
      "Verification: review",
      "",
      "Scope:",
      "- `src/process/**`",
      "",
      "Risk:",
      "- A process may remain alive.",
      "",
      "Review:",
      "- Confirm every failure path terminates the process.",
      "",
      "### invalid-case-id Ledger heading with an invalid case ID",
      "Status: active",
      "Verification: automated",
      "Code: `src/invalid-id.test.ts`",
      "",
      "Proves:",
      "- Invalid IDs receive a direct catalog diagnostic.",
      "",
      "### RV-BAD-SCOPE-001 Review case with an invalid scope",
      "Status: active",
      "Verification: review",
      "",
      "Scope:",
      "- src/process/**",
      "- `../src/process/**`",
      "",
      "Risk:",
      "- A process may remain alive.",
      "",
      "Reason:",
      "- Reliable automation requires disproportionate fault injection.",
      "",
      "Review:",
      "- Confirm every failure path terminates the process.",
      "",
      "### RV-PLANNED-REVIEW-001 Planned review is not a legal state",
      "Status: planned",
      "Verification: review",
      "",
      "Scope:",
      "- `src/process/**`",
      "",
      "Risk:",
      "- A process may remain alive.",
      "",
      "Reason:",
      "- Reliable automation requires disproportionate fault injection.",
      "",
      "Review:",
      "- Confirm every failure path terminates the process.",
      "",
      "### EX-BAD-SHAPE-001 Exemption with evidence fields",
      "Status: active",
      "Verification: exempt",
      "",
      "Scope:",
      "- `tests/bad_exempt.py`",
      "",
      "Reason:",
      "- The detector intentionally treats this fixture as a test.",
      "",
      "Proves:",
      "- This field is not valid for an exemption.",
      "",
      "### EX-MISSING-MARKER-001 Exemption without a source marker",
      "Status: active",
      "Verification: exempt",
      "",
      "Scope:",
      "- `tests/missing_exempt.py`",
      "",
      "Reason:",
      "- The detector recognizes syntax that is not project evidence.",
      "",
      "### WB-BAD-CODE-001 Automated case with a drive-relative Code path",
      "Status: active",
      "Verification: automated",
      "Code: `C:bad.test.ts`",
      "",
      "Proves:",
      "- Code paths remain inside the workspace.",
      "",
      "### WB-MISSING-MAIN-001 Automated case without a main entry",
      "Status: active",
      "Verification: automated",
      "Code: `src/missing.test.ts`",
      "",
      "Proves:",
      "- A stable behavior still requires one canonical test entry."
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "src/unregistered.rs",
    ["#[test]", "fn unregistered_test() {}"].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/future_test.py",
    [
      "# @test-evidence main WB-CALC-FUTURE-001",
      "",
      "def test_future():",
      "    assert True"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/invalid_marker_test.go",
    [
      "// @test-evidence derived not-a-case",
      "",
      "func TestInvalidMarker(t *testing.T) {}"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/malformed_marker.test.ts",
    [
      "// @test-evidence derived WB-CALC-ADD-001 trailing",
      "",
      "test(\"malformed marker\", () => {});"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/mixed.test.js",
    [
      "// @test-evidence derived WB-CALC-ADD-001",
      "// @test-evidence exempt EX-GENERATED-FIXTURE-001",
      "",
      "test(\"mixed roles\", () => {});"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "src/orphan.ts",
    "// @test-evidence derived WB-CALC-ADD-001"
  );
  await writeFile(
    invalidRoot,
    "tests/bad_exempt.py",
    [
      "# @test-evidence exempt EX-BAD-SHAPE-001",
      "",
      "def test_bad_exemption():",
      "    assert True"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "src/missing.test.ts",
    [
      "// @test-evidence derived WB-MISSING-MAIN-001",
      "",
      "test(\"missing main\", () => {});"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "src/duplicate-main.test.js",
    [
      "// @test-evidence main WB-CALC-ADD-001",
      "// @test-evidence derived WB-CALC-ADD-001",
      "// @test-evidence derived WB-CALC-ADD-001",
      "",
      "test(\"duplicate main\", () => {});"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/duplicate_exempt.py",
    [
      "# @test-evidence exempt EX-GENERATED-FIXTURE-001",
      "# @test-evidence exempt EX-GENERATED-FIXTURE-001",
      "",
      "def test_fixture_syntax():",
      "    assert True"
    ].join("\n")
  );

  const invalid = await validateTestEvidence({ workspaceRoot: invalidRoot });
  assertIncludesAll(invalid.errors, [
    "src/unregistered.rs contains rust test entries",
    "main WB-CALC-FUTURE-001 must reference an active automated case",
    "derived must include a valid case ID",
    "@test-evidence must use exactly",
    "must not mix @test-evidence exempt",
    "is not in a discovered test file",
    "RV-MISSING-REASON-001 must include exactly one non-empty Reason list",
    "invalid-case-id heading must start with a valid case ID",
    "RV-BAD-SCOPE-001 Scope item must be one backticked",
    "path or glob: `../src/process/**`",
    "RV-PLANNED-REVIEW-001 Status: planned only supports Verification: automated",
    "EX-BAD-SHAPE-001 active exempt cases must not declare Proves",
    "exempt EX-BAD-SHAPE-001 references a structurally invalid case",
    "EX-MISSING-MARKER-001 is missing @test-evidence exempt",
    "WB-BAD-CODE-001 active automated case must declare exactly one valid Code path",
    "WB-MISSING-MAIN-001 is missing @test-evidence main",
    "duplicate @test-evidence main marker: WB-CALC-ADD-001",
    "must not mark WB-CALC-ADD-001 as both main and derived",
    "must not repeat @test-evidence derived WB-CALC-ADD-001",
    "must declare exactly one @test-evidence exempt marker"
  ]);

  const invalidCli = spawnSync(
    "node",
    [generatedCliPath, "check", "--root", invalidRoot, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(invalidCli.status, 1);
  assert.equal(invalidCli.stderr, "");
  const invalidCliReport = JSON.parse(invalidCli.stdout) as { errors: string[] };
  assertIncludesAll(invalidCliReport.errors, [
    "invalid-case-id heading must start with a valid case ID",
    "WB-BAD-CODE-001 active automated case must declare exactly one valid Code path"
  ]);

  const invalidUsage = spawnSync("node", [generatedCliPath, "unknown"], {
    encoding: "utf8"
  });
  assert.equal(invalidUsage.status, 2);
  assert.match(invalidUsage.stderr, /unsupported command/);

  const generatedCli = await fs.readFile(generatedCliPath, "utf8");
  assert.match(generatedCli, /Generated test-evidence CLI/);
  assert.match(generatedCli, /Rebuild: bun run sync:test-evidence-cli/);
  assert.match(generatedCli, /sourceMappingURL=test-evidence\.mjs\.map/);
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

async function writeWorkspace(
  workspaceRoot: string,
  unregisteredTestFiles: "error" | "warn"
): Promise<void> {
  await writeFile(
    workspaceRoot,
    ".test-evidence.json",
    `${JSON.stringify({
      schemaVersion: 1,
      unregisteredTestFiles
    }, null, 2)}\n`
  );
  await writeFile(
    workspaceRoot,
    "docs/testing/cases.md",
    [
      "# Test cases",
      "",
      "### WB-CALC-ADD-001 Addition remains observable",
      "Status: active",
      "Verification: automated",
      "Code: `src/calc.test.ts`",
      "",
      "Proves:",
      "- Public addition returns the sum of two accepted operands.",
      "",
      "### WB-CALC-FUTURE-001 Future behavior",
      "Status: planned",
      "Verification: automated",
      "",
      "Proves:",
      "- A future public behavior has an explicit proof target.",
      "",
      "### RV-PROCESS-CLEANUP-001 Child process cleanup remains safe",
      "Status: active",
      "Verification: review",
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
      "### EX-GENERATED-FIXTURE-001 Generated fixture is not project evidence",
      "Status: active",
      "Verification: exempt",
      "",
      "Scope:",
      "- `tests/generated_test.go`",
      "",
      "Reason:",
      "- The file is read as fixture data and never executed as a project test."
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "src/calc.test.ts",
    [
      "// @test-evidence main WB-CALC-ADD-001",
      "",
      "test(\"adds\", () => {",
      "  assert.equal(add(1, 2), 3);",
      "});"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "tests/test_calc.py",
    [
      "# @test-evidence derived WB-CALC-ADD-001",
      "",
      "def test_addition_boundary():",
      "    assert add(0, 0) == 0"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "tests/generated_test.go",
    [
      "// @test-evidence exempt EX-GENERATED-FIXTURE-001",
      "",
      "func TestGeneratedCompatibility(t *testing.T) {}"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    ".tmp/ignored.rs",
    ["#[test]", "fn ignored_temporary_test() {}"].join("\n")
  );
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
