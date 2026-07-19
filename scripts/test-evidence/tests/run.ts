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
    catalogCases: 2,
    discoveredTestFiles: 3,
    exemptTestFiles: 1,
    implementedCases: 1,
    plannedCases: 1,
    primaryMarkers: 1,
    supportingMarkers: 1,
    unregisteredTestFiles: 0
  });

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
  )) as { errors: string[]; warnings: string[] };
  assert.deepEqual(cliReport.errors, []);
  assert.deepEqual(cliReport.warnings, []);

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
  await writeFile(
    invalidRoot,
    "src/unregistered.rs",
    ["#[test]", "fn unregistered_test() {}"].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/future_test.py",
    [
      "# @case WB-CALC-FUTURE-001",
      "",
      "def test_future():",
      "    assert True"
    ].join("\n")
  );
  await writeFile(
    invalidRoot,
    "tests/invalid_marker_test.go",
    [
      "// @supports not-a-case",
      "",
      "func TestInvalidMarker(t *testing.T) {}"
    ].join("\n")
  );

  const invalid = await validateTestEvidence({ workspaceRoot: invalidRoot });
  assert.ok(invalid.errors.some((error) =>
    error.includes("src/unregistered.rs contains rust test entries")
  ));
  assert.ok(invalid.errors.some((error) =>
    error.includes("planned case WB-CALC-FUTURE-001 must not have source markers")
  ));
  assert.ok(invalid.errors.some((error) =>
    error.includes("@supports must include a valid case ID")
  ));

  const invalidCli = spawnSync(
    "node",
    [generatedCliPath, "check", "--root", invalidRoot, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(invalidCli.status, 1);
  assert.ok((JSON.parse(invalidCli.stdout) as { errors: string[] }).errors.length > 0);

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
      "Status: implemented",
      "Code: `src/calc.test.ts`",
      "",
      "Proves:",
      "- Public addition returns the sum of two accepted operands.",
      "",
      "### WB-CALC-FUTURE-001 Future behavior",
      "Status: planned",
      "",
      "Proves:",
      "- A future public behavior has an explicit proof target."
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "src/calc.test.ts",
    [
      "// @case WB-CALC-ADD-001",
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
      "# @supports WB-CALC-ADD-001",
      "",
      "def test_addition_boundary():",
      "    assert add(0, 0) == 0"
    ].join("\n")
  );
  await writeFile(
    workspaceRoot,
    "tests/generated_test.go",
    [
      "// @test-exempt generated compatibility fixture",
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

async function writeFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}
