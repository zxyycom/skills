import fs from "node:fs/promises";
import path from "node:path";

export const fixtureBranch = "main";

export async function writeInitialFixtureWorkspace(
  workspaceRoot: string
): Promise<void> {
  await writeFile(
    workspaceRoot,
    ".test-evidence.json",
    `${JSON.stringify({
      reviewTriggers: "error",
      schemaVersion: 4,
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
}

export async function writeReviewedFixtureCatalog(
  workspaceRoot: string,
  reviewedCommit: string
): Promise<void> {
  await writeFile(
    workspaceRoot,
    "docs/testing/cases.md",
    createCatalog(reviewedCommit)
  );
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

async function writeFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const filePath = path.join(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}
