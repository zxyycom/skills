import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  queryVerificationEvidence,
  showVerificationCase,
  syncVerificationEvidenceIndex,
  validateVerificationEvidence
} from "../src/cli.ts";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);
const distributedScript = path.join(
  repositoryRoot,
  "skills",
  "verification-implementation-review",
  "scripts",
  "verification-catalog.mjs"
);
const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "verification-evidence-")
);

const catalog = [
  "# Verification Cases",
  "",
  "```markdown",
  "### Case IGNORED-EXAMPLE-CASE-001: Fenced examples are not cases",
  "Verification: test",
  "Entry:",
  "- `ignored.test.ts`",
  "Contract:",
  "- This example is ignored.",
  "Proves:",
  "- Nothing.",
  "```",
  "",
  "### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes",
  "Verification: test",
  "",
  "Entry:",
  "- `tests/access.test.ts`",
  "- `bun test tests/access.test.ts`",
  "",
  "Contract:",
  "- Resource mutation follows the caller role boundary.",
  "- Rejected mutations leave the resource unchanged.",
  "",
  "Proves:",
  "- Owners can edit.",
  "- Guests are denied.",
  "",
  "### Case SCHEMA-GENERATED-CURRENT-001: Generated schema stays current",
  "Verification: check",
  "",
  "Entry:",
  "- `scripts/check-generated.ts`",
  "- `bun run check:generated`",
  "",
  "Contract:",
  "- Committed schema artifacts match their maintained source.",
  "",
  "Proves:",
  "- Regeneration produces no artifact drift.",
  ""
].join("\n");

try {
  await writeWorkspaceFile(
    tempRoot,
    "docs/verification/cases.md",
    catalog
  );

  const initialCheck = await validateVerificationEvidence({
    workspaceRoot: tempRoot
  });
  assert.equal(initialCheck.summary.catalogCases, 2);
  assert.equal(initialCheck.summary.testCases, 1);
  assert.equal(initialCheck.summary.checkCases, 1);
  assert.ok(initialCheck.diagnostics.some(
    (entry) => entry.code === "state-index.index-missing"
  ));

  const initialQuery = await queryVerificationEvidence({
    workspaceRoot: tempRoot
  });
  assert.equal(initialQuery.total, 2);
  assert.ok(initialQuery.diagnostics.some(
    (entry) => entry.code === "state-index.index-missing"
      && entry.severity === "warning"
      && !entry.blocking
  ));

  const synchronized = await syncVerificationEvidenceIndex({
    mode: "write",
    workspaceRoot: tempRoot
  });
  assert.equal(synchronized.status, "ok");
  assert.equal(synchronized.state, "written");

  const checked = await validateVerificationEvidence({
    workspaceRoot: tempRoot
  });
  assert.deepEqual(checked.diagnostics, []);

  const allCases = await queryVerificationEvidence({
    workspaceRoot: tempRoot
  });
  assert.equal(allCases.total, 2);
  assert.deepEqual(
    allCases.cases.map((entry) => entry.id),
    ["AUTH-ROLE-ACCESS-001", "SCHEMA-GENERATED-CURRENT-001"]
  );

  const checks = await queryVerificationEvidence({
    verification: "check",
    workspaceRoot: tempRoot
  });
  assert.equal(checks.total, 1);
  assert.equal(checks.cases[0]?.verification, "check");

  const searched = await queryVerificationEvidence({
    query: "schema generated",
    workspaceRoot: tempRoot
  });
  assert.equal(searched.total, 1);
  assert.equal(searched.cases[0]?.id, "SCHEMA-GENERATED-CURRENT-001");

  const searchedContract = await queryVerificationEvidence({
    query: "rejected mutations unchanged",
    workspaceRoot: tempRoot
  });
  assert.equal(searchedContract.total, 1);
  assert.equal(searchedContract.cases[0]?.id, "AUTH-ROLE-ACCESS-001");

  const searchedProof = await queryVerificationEvidence({
    query: "guests denied",
    workspaceRoot: tempRoot
  });
  assert.equal(searchedProof.total, 1);
  assert.equal(searchedProof.cases[0]?.id, "AUTH-ROLE-ACCESS-001");
  assert.equal("searchText" in (searchedProof.cases[0] ?? {}), false);

  const shown = await showVerificationCase({
    caseId: "AUTH-ROLE-ACCESS-001",
    workspaceRoot: tempRoot
  });
  assert.equal(shown.case?.verification, "test");
  assert.match(shown.markdown ?? "", /Guests are denied\./u);
  assert.doesNotMatch(shown.markdown ?? "", /Generated schema stays current/u);

  await assertInvalidCatalog(
    tempRoot,
    "legacy",
    [
      "### Case LEGACY-AUTOMATED-CASE-001: Legacy mode is rejected",
      "Verification: automated",
      "Entry:",
      "- `tests/legacy.test.ts`",
      "Contract:",
      "- Legacy mode is invalid.",
      "Proves:",
      "- Nothing."
    ].join("\n"),
    /Verification: test or check/u
  );
  await assertInvalidCatalog(
    tempRoot,
    "missing-entry",
    [
      "### Case MISSING-ENTRY-CASE-001: Entry is required",
      "Verification: check",
      "Contract:",
      "- A check must be locatable.",
      "Proves:",
      "- Nothing."
    ].join("\n"),
    /non-empty Entry list/u
  );
  await assertInvalidCatalog(
    tempRoot,
    "duplicate-entry",
    [
      "### Case DUPLICATE-ENTRY-CASE-001: Entries are unique",
      "Verification: test",
      "Entry:",
      "- `tests/duplicate.test.ts`",
      "- `tests/duplicate.test.ts`",
      "Contract:",
      "- A locator is registered once.",
      "Proves:",
      "- Nothing."
    ].join("\n"),
    /duplicates Entry/u
  );

  await writeWorkspaceFile(
    tempRoot,
    "docs/verification/cases.md",
    `${catalog}\n<!-- changed -->\n`
  );
  const staleQuery = await queryVerificationEvidence({
    workspaceRoot: tempRoot
  });
  assert.equal(staleQuery.total, 2);
  assert.ok(staleQuery.diagnostics.some(
    (entry) => entry.code === "state-index.index-stale"
      && entry.severity === "warning"
      && !entry.blocking
  ));
  const staleShow = await showVerificationCase({
    caseId: "AUTH-ROLE-ACCESS-001",
    workspaceRoot: tempRoot
  });
  assert.match(staleShow.markdown ?? "", /Guests are denied\./u);
  assert.ok(staleShow.diagnostics.some(
    (entry) => entry.code === "state-index.index-stale"
      && entry.severity === "warning"
      && !entry.blocking
  ));

  await syncVerificationEvidenceIndex({
    mode: "write",
    workspaceRoot: tempRoot
  });
  await testDistributedModule(tempRoot);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Verification evidence tests passed.");

async function assertInvalidCatalog(
  workspaceRoot: string,
  name: string,
  text: string,
  expected: RegExp
): Promise<void> {
  const catalogPath = `invalid/${name}/cases.md`;
  const indexPath = `invalid/${name}/index.json`;
  await writeWorkspaceFile(workspaceRoot, catalogPath, text);
  const report = await validateVerificationEvidence({
    config: {
      catalogPath,
      indexPath,
      schemaVersion: 1
    },
    workspaceRoot
  });
  assert.ok(report.diagnostics.some((entry) => expected.test(entry.message)));
}

async function testDistributedModule(workspaceRoot: string): Promise<void> {
  const distributed = await import(pathToFileURL(distributedScript).href);
  assert.equal(typeof distributed.queryVerificationEvidence, "function");
  assert.equal(typeof distributed.runVerificationCatalogCli, "function");

  const child = await execFileAsync(
    "node",
    [distributedScript, "list", "--root", workspaceRoot, "--json"],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );
  const result = JSON.parse(String(child.stdout)) as {
    cases: unknown[];
    total: number;
  };
  assert.equal(result.total, 2);
  assert.equal(result.cases.length, 2);
}

async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(workspaceRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}
