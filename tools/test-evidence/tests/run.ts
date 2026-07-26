import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  queryTestEvidence,
  showTestEvidenceCase,
  syncTestEvidenceIndex,
  validateTestEvidence
} from "../src/cli.ts";
import { workspaceRelativePathsAreDistinct } from "../src/workspace-path.ts";
import "./config-path.test.ts";
import "./repository-catalog.test.ts";

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
  "test-evidence-review",
  "scripts",
  "test-evidence-catalog.mjs"
);
const accessCatalog = [
  "# Access Test Evidence",
  "",
  "```markdown",
  "### Case IGNORED-EXAMPLE-CASE-001: Fenced examples are not cases",
  "Entry:",
  "- `ignored.test.ts`",
  "Contract:",
  "- This example is ignored.",
  "Proves:",
  "- Nothing.",
  "```",
  "",
  "### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes",
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
  ""
].join("\n");
const sessionCatalog = [
  "# Session Test Evidence",
  "",
  "### Case AUTH-SESSION-EXPIRY-001: Session tests cover expiry outcomes",
  "",
  "Entry:",
  "- `tests/session-expiry.test.ts`",
  "- `bun test tests/session-expiry.test.ts`",
  "",
  "Contract:",
  "- Expired sessions cannot access protected resources.",
  "",
  "Proves:",
  "- Expired sessions are rejected.",
  ""
].join("\n");

test("catalog paths reject aliases, hard links, and platform-equivalent identities", async () => {
  await withWorkspace(async (tempRoot) => {
    await assertConfigPathConflict(
      tempRoot,
      {
        catalogPath: "docs/test-evidence/cases",
        indexPath: ".test-evidence.json",
        schemaVersion: 2
      },
      "./.test-evidence.json"
    );
    await assertConfigPathConflict(tempRoot, {
      catalogPath: "docs//test-evidence/./cases",
      indexPath: "docs/test-evidence/cases",
      schemaVersion: 2
    });

    const missingCaseAliases = ["missing/Index.json", "MISSING/index.json"];
    assert.equal(
      await workspaceRelativePathsAreDistinct(tempRoot, missingCaseAliases, "win32"),
      false
    );
    assert.equal(
      await workspaceRelativePathsAreDistinct(tempRoot, missingCaseAliases, "darwin"),
      false
    );

    const hardLinkConfig = "identity/config.json";
    const hardLinkIndex = "identity/index.json";
    await writeWorkspaceFile(tempRoot, hardLinkConfig, "identity\n");
    const hardLinkConfigPath = path.join(tempRoot, "identity", "config.json");
    const hardLinkIndexPath = path.join(tempRoot, "identity", "index.json");
    await fs.link(hardLinkConfigPath, hardLinkIndexPath);
    const [configStats, indexStats] = await Promise.all([
      fs.stat(hardLinkConfigPath, { bigint: true }),
      fs.stat(hardLinkIndexPath, { bigint: true })
    ]);
    assert.equal(configStats.dev, indexStats.dev);
    assert.equal(configStats.ino, indexStats.ino);
    await assertConfigPathConflict(
      tempRoot,
      {
        catalogPath: "docs/test-evidence/cases",
        indexPath: hardLinkIndex,
        schemaVersion: 2
      },
      hardLinkConfig
    );

    const darwinConfigPath = "darwin/config.json";
    const darwinConfig = `${JSON.stringify({
      catalogPath: "docs/test-evidence/cases",
      indexPath: "DARWIN/CONFIG.JSON",
      schemaVersion: 2
    }, null, 2)}\n`;
    await writeWorkspaceFile(tempRoot, darwinConfigPath, darwinConfig);
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
    try {
      Object.defineProperty(process, "platform", {
        ...platformDescriptor,
        value: "darwin"
      });
      await assertConfigPathConflict(tempRoot, undefined, darwinConfigPath);
    } finally {
      Object.defineProperty(process, "platform", platformDescriptor);
    }
    assert.equal(
      await fs.readFile(path.join(tempRoot, "darwin", "config.json"), "utf8"),
      darwinConfig
    );
    assert.equal(
      await fs.readFile(
        path.join(tempRoot, "docs", "test-evidence", "cases", "access.md"),
        "utf8"
      ),
      accessCatalog
    );
  });
});

test("missing indexes fall back to the catalog for validation and queries", async () => {
  await withWorkspace(async (tempRoot) => {
    const initialCheck = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(initialCheck.summary.testCases, 2);
    assert.ok(initialCheck.diagnostics.some(
      (entry) => entry.code === "state-index.index-missing"
    ));

    const initialQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(initialQuery.total, 2);
    assert.ok(initialQuery.diagnostics.some(
      (entry) => entry.code === "state-index.index-missing"
        && entry.severity === "warning"
        && !entry.blocking
    ));
  });
});

test("index synchronization writes a valid searchable snapshot", async () => {
  await withWorkspace(async (tempRoot) => {
    const synchronized = await syncTestEvidenceIndex({
      mode: "write",
      workspaceRoot: tempRoot
    });
    assert.equal(synchronized.status, "ok");
    assert.equal(synchronized.state, "written");

    const checked = await validateTestEvidence({ workspaceRoot: tempRoot });
    assert.deepEqual(checked.diagnostics, []);
  });
});

test("damaged indexes fall back to the catalog and can be rebuilt", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/test-evidence-index.json",
      "{ invalid json\n"
    );

    const damagedIndexQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(damagedIndexQuery.total, 2);
    assert.ok(damagedIndexQuery.diagnostics.some(
      (entry) => entry.code === "state-index.json-invalid"
        && entry.severity === "warning"
        && !entry.blocking
    ));
    assert.equal(
      (await syncTestEvidenceIndex({
        mode: "write",
        workspaceRoot: tempRoot
      })).status,
      "ok"
    );
  });
});

test("catalog queries list, search, and show exact cases", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    const allCases = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(allCases.total, 2);
    assert.deepEqual(
      allCases.cases.map((entry) => entry.id),
      ["AUTH-ROLE-ACCESS-001", "AUTH-SESSION-EXPIRY-001"]
    );
    assert.deepEqual(
      allCases.cases.map((entry) => entry.sourcePath),
      [
        "docs/test-evidence/cases/access.md",
        "docs/test-evidence/cases/session.md"
      ]
    );

    const searched = await queryTestEvidence({
      query: "session expired",
      workspaceRoot: tempRoot
    });
    assert.equal(searched.total, 1);
    assert.equal(searched.cases[0]?.id, "AUTH-SESSION-EXPIRY-001");

    const searchedContract = await queryTestEvidence({
      query: "rejected mutations unchanged",
      workspaceRoot: tempRoot
    });
    assert.equal(searchedContract.total, 1);
    assert.equal(searchedContract.cases[0]?.id, "AUTH-ROLE-ACCESS-001");

    const searchedProof = await queryTestEvidence({
      query: "guests denied",
      workspaceRoot: tempRoot
    });
    assert.equal(searchedProof.total, 1);
    assert.equal(searchedProof.cases[0]?.id, "AUTH-ROLE-ACCESS-001");
    assert.equal("searchText" in (searchedProof.cases[0] ?? {}), false);

    const shown = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.equal(shown.case?.id, "AUTH-ROLE-ACCESS-001");
    assert.equal(
      shown.case?.sourcePath,
      "docs/test-evidence/cases/access.md"
    );
    assert.match(shown.markdown ?? "", /Guests are denied\./u);
    assert.doesNotMatch(shown.markdown ?? "", /Session tests cover expiry/u);
  });
});

test("catalog validation rejects legacy verification fields", async () => {
  await withWorkspace(async (tempRoot) => {
    await assertInvalidCatalog(
      tempRoot,
      "verification-test",
      [
        "### Case LEGACY-TEST-FIELD-001: Verification fields are rejected",
        "Verification: test",
        "Entry:",
        "- `tests/legacy.test.ts`",
        "Contract:",
        "- Test identity is implicit.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /must not declare Verification/u
    );
    await assertInvalidCatalog(
      tempRoot,
      "verification-check",
      [
        "### Case LEGACY-CHECK-FIELD-001: Check cases are rejected",
        "Verification: check",
        "Entry:",
        "- `scripts/check-generated.ts`",
        "Contract:",
        "- Engineering checks are outside this catalog.",
        "Proves:",
        "- Nothing."
      ].join("\n"),
      /must not declare Verification/u
    );
  });
});

test("catalog validation requires one non-empty unique entry list", async () => {
  await withWorkspace(async (tempRoot) => {
    await assertInvalidCatalog(
      tempRoot,
      "missing-entry",
      [
        "### Case MISSING-ENTRY-CASE-001: Entry is required",
        "Contract:",
        "- A test must be locatable.",
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

  });
});

test("catalog validation rejects duplicate case IDs across topics", async () => {
  await withWorkspace(async (tempRoot) => {
    const duplicateCatalogPath = "invalid/cross-file/cases";
    const duplicateCase = [
      "### Case DUPLICATE-CROSS-FILE-001: IDs are unique across topics",
      "Entry:",
      "- `tests/duplicate.test.ts`",
      "Contract:",
      "- A case has one catalog identity.",
      "Proves:",
      "- Duplicate topic entries are rejected."
    ].join("\n");
    await writeWorkspaceFile(
      tempRoot,
      `${duplicateCatalogPath}/first.md`,
      duplicateCase
    );
    await writeWorkspaceFile(
      tempRoot,
      `${duplicateCatalogPath}/second.md`,
      duplicateCase
    );

    const report = await validateTestEvidence({
      config: {
        catalogPath: duplicateCatalogPath,
        indexPath: "invalid/cross-file/index.json",
        schemaVersion: 2
      },
      workspaceRoot: tempRoot
    });

    assert.ok(report.diagnostics.some((entry) => (
      entry.code === "catalog.case-id-duplicate"
      && entry.message.includes("first.md")
      && entry.message.includes("second.md")
    )));
  });
});

test("catalog validation rejects empty topic sets and topic files", async () => {
  await withWorkspace(async (tempRoot) => {
    const emptyCatalogPath = "invalid/empty-set/cases";
    await fs.mkdir(path.join(tempRoot, ...emptyCatalogPath.split("/")), {
      recursive: true
    });
    const emptySetReport = await validateTestEvidence({
      config: {
        catalogPath: emptyCatalogPath,
        indexPath: "invalid/empty-set/index.json",
        schemaVersion: 2
      },
      workspaceRoot: tempRoot
    });
    assert.ok(emptySetReport.diagnostics.some((entry) => (
      entry.code === "catalog.empty"
    )));

    const emptyTopicCatalogPath = "invalid/empty-topic/cases";
    await writeWorkspaceFile(
      tempRoot,
      `${emptyTopicCatalogPath}/empty.md`,
      "# Empty topic\n"
    );
    const emptyTopicReport = await validateTestEvidence({
      config: {
        catalogPath: emptyTopicCatalogPath,
        indexPath: "invalid/empty-topic/index.json",
        schemaVersion: 2
      },
      workspaceRoot: tempRoot
    });
    assert.ok(emptyTopicReport.diagnostics.some((entry) => (
      entry.code === "catalog.topic-empty"
      && entry.path === `${emptyTopicCatalogPath}/empty.md`
    )));
  });
});

test("stale indexes fall back to current catalog content", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await writeWorkspaceFile(
      tempRoot,
      "docs/test-evidence/cases/access.md",
      `${accessCatalog}\n<!-- changed -->\n`
    );

    const staleQuery = await queryTestEvidence({ workspaceRoot: tempRoot });
    assert.equal(staleQuery.total, 2);
    assert.ok(staleQuery.diagnostics.some(
      (entry) => entry.code === "state-index.index-stale"
        && entry.severity === "warning"
        && !entry.blocking
    ));

    const staleShow = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      workspaceRoot: tempRoot
    });
    assert.match(staleShow.markdown ?? "", /Guests are denied\./u);
    assert.ok(staleShow.diagnostics.some(
      (entry) => entry.code === "state-index.index-stale"
        && entry.severity === "warning"
        && !entry.blocking
    ));
  });
});

test("unreadable indexes remain blocking for list and show operations", async () => {
  await withWorkspace(async (tempRoot) => {
    const unreadableIndexPath = path.join(
      tempRoot,
      "unreadable-index",
      "index.json"
    );
    await fs.mkdir(unreadableIndexPath, { recursive: true });
    const unreadableConfig = {
      catalogPath: "docs/test-evidence/cases",
      indexPath: "unreadable-index/index.json",
      schemaVersion: 2 as const
    };

    const unreadableQuery = await queryTestEvidence({
      config: unreadableConfig,
      workspaceRoot: tempRoot
    });
    assert.equal(unreadableQuery.total, 0);
    assert.deepEqual(unreadableQuery.cases, []);
    assertUnrecoverableIndexReadFailure(unreadableQuery.diagnostics);

    const unreadableShow = await showTestEvidenceCase({
      caseId: "AUTH-ROLE-ACCESS-001",
      config: unreadableConfig,
      workspaceRoot: tempRoot
    });
    assert.equal(unreadableShow.case, null);
    assert.equal(unreadableShow.markdown, null);
    assertUnrecoverableIndexReadFailure(unreadableShow.diagnostics);
  });
});

test("distributed module and CLI preserve catalog query contracts", async () => {
  await withWorkspace(async (tempRoot) => {
    await syncTestEvidenceIndex({ mode: "write", workspaceRoot: tempRoot });
    await fs.mkdir(
      path.join(tempRoot, "unreadable-index", "index.json"),
      { recursive: true }
    );
    await assertDistributedModuleParity(tempRoot);
  });
});

async function withWorkspace(
  operation: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "test-evidence-"));
  try {
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/access.md",
      accessCatalog
    );
    await writeWorkspaceFile(
      workspaceRoot,
      "docs/test-evidence/cases/session.md",
      sessionCatalog
    );
    await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function assertConfigPathConflict(
  workspaceRoot: string,
  config: {
    catalogPath: string;
    indexPath: string;
    schemaVersion: 2;
  } | undefined,
  configPath?: string
): Promise<void> {
  const result = await syncTestEvidenceIndex({
    config,
    configPath,
    mode: "write",
    workspaceRoot
  });
  assert.equal(result.status, "error");
  assert.ok(result.diagnostics.some((entry) => (
    entry.code === "config.path-conflict"
    && entry.blocking
  )));
}

function assertUnrecoverableIndexReadFailure(
  diagnostics: readonly {
    blocking: boolean;
    code: string;
    message: string;
    severity: "error" | "warning";
  }[]
): void {
  const failure = diagnostics.find((entry) => (
    entry.code === "state-index.index-read-failed"
  ));
  assert.ok(failure);
  assert.equal(failure.blocking, true);
  assert.equal(failure.severity, "error");
  assert.doesNotMatch(failure.message, /sync-index --write/u);
}

async function assertInvalidCatalog(
  workspaceRoot: string,
  name: string,
  text: string,
  expected: RegExp
): Promise<void> {
  const catalogPath = `invalid/${name}/cases`;
  const indexPath = `invalid/${name}/index.json`;
  await writeWorkspaceFile(workspaceRoot, `${catalogPath}/topic.md`, text);
  const report = await validateTestEvidence({
    config: {
      catalogPath,
      indexPath,
      schemaVersion: 2
    },
    workspaceRoot
  });
  assert.ok(report.diagnostics.some((entry) => expected.test(entry.message)));
}

async function assertDistributedModuleParity(
  workspaceRoot: string
): Promise<void> {
  const distributed = await import(pathToFileURL(distributedScript).href);
  assert.equal(typeof distributed.queryTestEvidence, "function");
  assert.equal(typeof distributed.runTestEvidenceCatalogCli, "function");

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

  const unreadableConfigPath = "unreadable-index/config.json";
  await writeWorkspaceFile(
    workspaceRoot,
    unreadableConfigPath,
    `${JSON.stringify({
      catalogPath: "docs/test-evidence/cases",
      indexPath: "unreadable-index/index.json",
      schemaVersion: 2
    }, null, 2)}\n`
  );
  for (const command of [
    ["list"],
    ["show", "AUTH-ROLE-ACCESS-001"]
  ]) {
    try {
      await execFileAsync(
        "node",
        [
          distributedScript,
          ...command,
          "--root",
          workspaceRoot,
          "--config",
          unreadableConfigPath,
          "--json"
        ],
        {
          encoding: "utf8",
          windowsHide: true
        }
      );
      assert.fail(`${command[0]} should fail when the index cannot be read`);
    } catch (error) {
      const failure = error as Error & {
        code?: number | string;
        stdout?: string;
      };
      assert.equal(failure.code, 1);
      const output = JSON.parse(failure.stdout ?? "") as {
        diagnostics: Array<{
          blocking: boolean;
          code: string;
          message: string;
          severity: "error" | "warning";
        }>;
      };
      assertUnrecoverableIndexReadFailure(output.diagnostics);
    }
  }
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
