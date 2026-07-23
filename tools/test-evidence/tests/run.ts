import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import {
  collectRegexTestEntries as collectBundledRegexTestEntries
} from "../../../skills/test-evidence-review/scripts/test-entry-regex.mjs";
import {
  inspectTestEvidenceLedger as inspectBundledTestEvidenceLedger,
  queryTestEvidenceLedger as queryBundledTestEvidenceLedger,
  showTestEvidenceCase as showBundledTestEvidenceCase,
  syncTestEvidenceIndex as syncBundledTestEvidenceIndex,
  runTestEvidenceLedgerCli,
  validateTestEvidenceLedger as validateBundledTestEvidenceLedger
} from "../../../skills/test-evidence-review/scripts/test-evidence-ledger.mjs";
import { formatTestEvidenceCliOutput } from "../src/cli-output.ts";
import {
  testEvidenceQueryResultSchema,
  testEvidenceReportSchema,
  testEvidenceStateIndexSchema
} from "../src/schemas.ts";
import { runRegexCollectorTests } from "./discovery.test.ts";

await runRegexCollectorTests();

const execFileAsync = promisify(execFile);
const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const generatedCollectorPath = path.join(
  rootDir,
  "skills",
  "test-evidence-review",
  "scripts",
  "test-entry-regex.mjs"
);
const generatedLedgerPath = path.join(
  rootDir,
  "skills",
  "test-evidence-review",
  "scripts",
  "test-evidence-ledger.mjs"
);
const generatedLedgerDeclarationPath = generatedLedgerPath.replace(
  /\.mjs$/u,
  ".d.mts"
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
  const validInventoryPath = await writeCollectedInventory(
    workspaceRoot,
    "valid"
  );

  validationTasks.push(validationGate.promise.then(async () => {
    const valid = await validateCollectedTestEvidence({ workspaceRoot });
    assert.equal(valid.schemaVersion, 3);
    assert.deepEqual(valid.diagnostics, []);
    assert.equal("errors" in valid, false);
    assert.equal("warnings" in valid, false);
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

    const inspection = await inspectCollectedTestEvidence({ workspaceRoot });
    assert.equal(inspection.schemaVersion, 3);
    assert.equal(inspection.catalogAvailable, true);
    assert.equal(inspection.indexCurrent, true);
    assert.equal(
      inspection.indexPath,
      "docs/testing/test-evidence-index.json"
    );
    const persistedIndex = JSON.parse(await fs.readFile(
      path.join(workspaceRoot, ...inspection.indexPath.split("/")),
      "utf8"
    ));
    assert.equal(
      v.safeParse(testEvidenceStateIndexSchema, persistedIndex).success,
      true
    );
    assert.equal(inspection.cases.length, 4);
    assert.equal(inspection.sourceEntries.length, 4);
    const automated = inspection.cases.find(
      (entry) => entry.id === "WB-CALC-ADD-001"
    );
    assert.equal(automated?.valid, true);
    assert.equal(automated?.sourceMarkers.length, 3);
    assert.deepEqual(automated?.contract, [
      "Addition returns the mathematical sum and preserves the additive identity."
    ]);

    const absoluteConfigPath = await validateCollectedTestEvidence({
      configPath: "C:\\outside.json",
      workspaceRoot
    });
    assert.ok(absoluteConfigPath.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("config path must be a workspace-relative path")
    ));

    const humanOutput = formatTestEvidenceCliOutput(valid, false);
    assert.equal(humanOutput.stderr, "");
    assert.match(
      humanOutput.stdout,
      /4 discovered test entry\(s\), 0 unregistered/
    );
  }));
  validationTasks.push(validationGate.promise.then(async () => {
    const inventory = await collectBundledRegexTestEntries({ workspaceRoot });
    assert.deepEqual(inventory.diagnostics, []);
    const externalInventory = {
      ...inventory,
      entries: inventory.entries.map((entry) => ({
        ...entry,
        detectorIds: ["external:ast"]
      }))
    };
    const direct = await validateBundledTestEvidenceLedger({
      inventory: externalInventory,
      inventorySource: "external AST collector",
      workspaceRoot
    });
    assert.deepEqual(direct.diagnostics, []);
    assert.equal(direct.summary.discoveredTestEntries, 4);

    const queried = await queryBundledTestEvidenceLedger({
      limit: 1,
      offset: 1,
      workspaceRoot
    });
    assert.equal(queried.total, 4);
    assert.equal(queried.cases.length, 1);
    assert.equal("contract" in queried.cases[0]!, false);
    const searched = await queryBundledTestEvidenceLedger({
      query: "calc identity",
      workspaceRoot
    });
    assert.deepEqual(
      searched.cases.map((entry) => entry.id),
      ["WB-CALC-ADD-001"]
    );
    const invalidQuery = await queryBundledTestEvidenceLedger({
      query: "   ",
      workspaceRoot
    });
    assert.equal(invalidQuery.incomplete, true);
    assert.ok(invalidQuery.diagnostics.some((diagnostic) => (
      diagnostic.code === "query.text-invalid" && diagnostic.blocking
    )));

    const shown = await showBundledTestEvidenceCase({
      caseId: "WB-CALC-ADD-001",
      workspaceRoot
    });
    assert.equal(shown.case?.id, "WB-CALC-ADD-001");
    assert.match(shown.markdown ?? "", /Proves:/u);
    assert.equal(
      shown.markdown?.includes("WB-CALC-FUTURE-001") ?? true,
      false
    );

    const malformed = await validateBundledTestEvidenceLedger({
      inventory: { schemaVersion: 1 },
      workspaceRoot
    });
    assert.ok(malformed.diagnostics.some((diagnostic) =>
      diagnostic.category === "inventory"
      && diagnostic.code === "inventory.schema-invalid"
      && diagnostic.blocking
    ));

    const firstEntry = inventory.entries[0];
    assert.ok(firstEntry !== undefined);
    const duplicateLocation = await validateBundledTestEvidenceLedger({
      inventory: {
        ...inventory,
        entries: [
          ...inventory.entries,
          { ...firstEntry, id: `${firstEntry.id}:duplicate` }
        ]
      },
      workspaceRoot
    });
    assert.ok(duplicateLocation.diagnostics.some((diagnostic) =>
      diagnostic.code === "inventory.entry-location-duplicate"
      && diagnostic.blocking
    ));
  }));
  validationTasks.push(validationGate.promise.then(async () => {
    const collected = await execFileAsync(
      "node",
      [generatedCollectorPath, "--root", workspaceRoot],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(collected.stderr, "");
    const inventoryPath = path.join(tempRoot, "direct-cli-inventory.json");
    await fs.writeFile(inventoryPath, collected.stdout, "utf8");
    const checked = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "check",
        "--inventory",
        inventoryPath,
        "--root",
        workspaceRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(checked.stderr, "");
    const report = JSON.parse(checked.stdout) as {
      diagnostics: unknown[];
      schemaVersion: number;
    };
    assert.equal(report.schemaVersion, 3);
    assert.deepEqual(report.diagnostics, []);

    const stdinChecked = spawnSync(
      "node",
      [
        generatedLedgerPath,
        "check",
        "--inventory",
        "-",
        "--root",
        workspaceRoot,
        "--json"
      ],
      {
        encoding: "utf8",
        input: collected.stdout,
        windowsHide: true
      }
    );
    assert.equal(stdinChecked.status, 0);
    assert.deepEqual(
      (JSON.parse(stdinChecked.stdout) as { diagnostics: unknown[] }).diagnostics,
      []
    );
  }));

  const v2ConfigRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "v2-config"
  );
  await writeFile(
    v2ConfigRoot,
    ".test-evidence.json",
    `${JSON.stringify({
      reviewTriggers: "error",
      schemaVersion: 2,
      unregisteredTestEntries: "error"
    }, null, 2)}\n`
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const report = await validateCollectedTestEvidence({
      workspaceRoot: v2ConfigRoot
    });
    assert.ok(report.diagnostics.some((diagnostic) =>
      diagnostic.code === "config.schema-invalid"
      && diagnostic.message.includes("Expected 4 but received 2")
      && diagnostic.blocking
    ));
    const inventoryPath = await writeCollectedInventory(v2ConfigRoot, "v2-config");
    const cli = spawnSync(
      "node",
      [
        generatedLedgerPath,
        "check",
        "--inventory",
        inventoryPath,
        "--root",
        v2ConfigRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(cli.status, 1);
    const cliReport = JSON.parse(cli.stdout) as {
      diagnostics: Array<{ blocking: boolean; code: string }>;
    };
    assert.ok(cliReport.diagnostics.some((diagnostic) =>
      diagnostic.code === "config.schema-invalid" && diagnostic.blocking
    ));
  }));

  validationTasks.push(validationGate.promise.then(async () => {
    const nodeCli = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "check",
        "--inventory",
        validInventoryPath,
        "--root",
        workspaceRoot,
        "--json"
      ],
      {
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.equal(nodeCli.stderr, "");
    const cliReport = JSON.parse(nodeCli.stdout) as {
      diagnostics: unknown[];
      reviewTriggers: unknown[];
      schemaVersion: number;
    };
    assert.equal(cliReport.schemaVersion, 3);
    assert.deepEqual(cliReport.diagnostics, []);
    assert.deepEqual(cliReport.reviewTriggers, []);
  }));
  validationTasks.push(validationGate.promise.then(async () => {
    const listed = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--root",
        workspaceRoot,
        "--json"
      ],
      {
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.equal(listed.stderr, "");
    const listResult = v.parse(
      testEvidenceQueryResultSchema,
      JSON.parse(listed.stdout)
    );
    assert.equal(listResult.schemaVersion, 3);
    assert.equal(listResult.catalogPath, "docs/testing/cases.md");
    assert.equal(
      listResult.indexPath,
      "docs/testing/test-evidence-index.json"
    );
    assert.equal(listResult.incomplete, false);
    assert.equal(listResult.cases.length, 4);
    assert.equal(listResult.total, 4);
    assert.equal(listResult.offset, 0);
    assert.equal(listResult.limit, 20);
    const indexedAutomated = listResult.cases.find(
      (entry) => entry.id === "WB-CALC-ADD-001"
    );
    assert.equal(
      indexedAutomated?.summary,
      "Addition returns the mathematical sum and preserves the additive identity."
    );
    assert.equal(indexedAutomated !== undefined && "contract" in indexedAutomated, false);
    assert.equal(indexedAutomated !== undefined && "proves" in indexedAutomated, false);
    assert.equal(indexedAutomated !== undefined && "sourceMarkers" in indexedAutomated, false);

    const searched = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--query",
        "child cleanup",
        "--root",
        workspaceRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.deepEqual(
      (JSON.parse(searched.stdout) as {
        cases: Array<{ id: string }>;
      }).cases.map((entry) => entry.id),
      ["RV-PROCESS-CLEANUP-001"]
    );

    const filtered = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--status",
        "planned",
        "--verification",
        "automated",
        "--root",
        workspaceRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.deepEqual(
      (JSON.parse(filtered.stdout) as {
        cases: Array<{ id: string }>;
      }).cases.map((entry) => entry.id),
      ["WB-CALC-FUTURE-001"]
    );

    const paged = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--limit",
        "2",
        "--offset",
        "1",
        "--root",
        workspaceRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    const page = JSON.parse(paged.stdout) as {
      cases: Array<{ id: string }>;
      limit: number;
      offset: number;
      total: number;
    };
    assert.equal(page.limit, 2);
    assert.equal(page.offset, 1);
    assert.equal(page.total, 4);
    assert.equal(page.cases.length, 2);

    const shown = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "show",
        "RV-PROCESS-CLEANUP-001",
        "--root",
        workspaceRoot
      ],
      {
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.equal(shown.stderr, "");
    assert.match(shown.stdout, /RV-PROCESS-CLEANUP-001 \[active, review\]/u);
    assert.match(shown.stdout, /Catalog: docs\/testing\/cases\.md:\d+/u);
    assert.match(shown.stdout, /Review:/u);
    assert.match(shown.stdout, /Confirm every failure path terminates the child process/u);
    assert.equal(shown.stdout.includes("EX-GENERATED-FIXTURE-001"), false);
  }));

  const staleIndexRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "stale-index"
  );
  const staleCatalogPath = path.join(
    staleIndexRoot,
    "docs/testing/cases.md"
  );
  await fs.writeFile(
    staleCatalogPath,
    (await fs.readFile(staleCatalogPath, "utf8")).replace(
      "Addition remains observable",
      "Addition remains observably indexed"
    ),
    "utf8"
  );
  validationTasks.push(validationGate.promise.then(async () => {
    const staleQuery = spawnSync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--root",
        staleIndexRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(staleQuery.status, 1);
    assert.ok(
      (JSON.parse(staleQuery.stdout) as {
        diagnostics: Array<{ code: string }>;
      }).diagnostics.some((entry) => entry.code === "state-index.index-stale")
    );

    const syncCheck = spawnSync(
      "node",
      [generatedLedgerPath, "sync-index", "--root", staleIndexRoot, "--json"],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(syncCheck.status, 1);
    assert.equal(
      (JSON.parse(syncCheck.stdout) as { state: string }).state,
      "index-stale"
    );

    const synchronized = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "sync-index",
        "--write",
        "--root",
        staleIndexRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    const syncResult = JSON.parse(synchronized.stdout) as {
      schemaVersion: number;
      state: string;
    };
    assert.equal(syncResult.schemaVersion, 3);
    assert.equal(syncResult.state, "written");

    const refreshed = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "show",
        "WB-CALC-ADD-001",
        "--root",
        staleIndexRoot
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.match(refreshed.stdout, /Addition remains observably indexed/u);
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
    const dirtyReview = await validateCollectedTestEvidence({
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
    assert.ok(dirtyReview.diagnostics.some((diagnostic) =>
      diagnostic.message.includes("RV-PROCESS-CLEANUP-001 requires review")
      && diagnostic.message.includes("dirty worktree paths match Scope")
    ));
    const reviewDiagnostic = dirtyReview.diagnostics.find(
      (diagnostic) => diagnostic.code === "review.trigger"
    );
    assert.equal(reviewDiagnostic?.category, "review");
    assert.equal(reviewDiagnostic?.caseId, "RV-PROCESS-CLEANUP-001");
  }));
  validationTasks.push(validationGate.promise.then(async () => {
    const triggered = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--triggered",
        "--root",
        dirtyReviewRoot,
        "--json"
      ],
      {
        encoding: "utf8",
        windowsHide: true
      }
    );
    assert.equal(triggered.stderr, "");
    const result = JSON.parse(triggered.stdout) as {
      cases: Array<{
        id: string;
        trigger: { paths: string[]; reasons: string[] } | null;
      }>;
      diagnostics: unknown[];
      incomplete: boolean;
    };
    assert.equal(result.incomplete, false);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.cases.map((entry) => entry.id), [
      "RV-PROCESS-CLEANUP-001"
    ]);
    assert.deepEqual(result.cases[0]?.trigger, {
      caseId: "RV-PROCESS-CLEANUP-001",
      paths: ["src/process/worker.ts"],
      reasons: ["dirty worktree paths match Scope"]
    });

    const humanTriggered = await execFileAsync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--triggered",
        "--root",
        dirtyReviewRoot
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(humanTriggered.stderr, "");
    assert.match(
      humanTriggered.stdout,
      /Trigger path: src\/process\/worker\.ts/u
    );
    assert.equal(humanTriggered.stdout.includes("review.trigger"), false);
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
    const committedReview = await validateCollectedTestEvidence({
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
      schemaVersion: 4,
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
  await syncWorkspaceIndex(overdueReviewRoot);
  validationTasks.push(validationGate.promise.then(async () => {
    const overdueReview = await validateCollectedTestEvidence({
      workspaceRoot: overdueReviewRoot
    });
    assert.ok(overdueReview.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warning"
      && diagnostic.message.includes("exceeding reviewMaxAgeDays 30")
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
      schemaVersion: 4,
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
  await syncWorkspaceIndex(unavailableBaselineRoot);
  validationTasks.push(validationGate.promise.then(async () => {
    const unavailableBaseline = await validateCollectedTestEvidence({
      workspaceRoot: unavailableBaselineRoot
    });
    assert.ok(unavailableBaseline.diagnostics.every((diagnostic) =>
      diagnostic.severity !== "error"
    ));
    assert.equal(unavailableBaseline.reviewTriggers.length, 1);
    assert.ok(unavailableBaseline.diagnostics.some((diagnostic) =>
      diagnostic.severity === "warning"
      && diagnostic.message.includes(
        `Reviewed-Commit ${"0".repeat(40)} is unavailable`
      )
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
    const unrelatedDirty = await validateCollectedTestEvidence({
      workspaceRoot: unrelatedDirtyRoot
    });
    assert.deepEqual(unrelatedDirty.diagnostics, []);
    assert.deepEqual(unrelatedDirty.reviewTriggers, []);
  }));

  const missingCatalogRoot = materializeWorkspace(
    fixtureRepositoryPath,
    "missing-catalog"
  );
  await fs.rm(path.join(missingCatalogRoot, "docs/testing/cases.md"));
  validationTasks.push(validationGate.promise.then(async () => {
    const missingCatalog = await validateCollectedTestEvidence({
      workspaceRoot: missingCatalogRoot
    });
    const diagnostic = missingCatalog.diagnostics.find(
      (entry) => entry.category === "catalog"
    );
    assert.equal(diagnostic?.path, "docs/testing/cases.md");
    assert.equal(diagnostic?.caseId, undefined);
    const query = spawnSync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--root",
        missingCatalogRoot,
        "--json"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(query.status, 1);
    const queryResult = JSON.parse(query.stdout) as {
      diagnostics: Array<{ blocking: boolean; code: string }>;
    };
    assert.ok(queryResult.diagnostics.some((entry) =>
      entry.code === "state-index.revision-read-failed" && entry.blocking
    ));
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
    const entryInvalid = await validateCollectedTestEvidence({
      workspaceRoot: entryInvalidRoot
    });
    assertIncludesAll(diagnosticMessages(entryInvalid.diagnostics), [
      "src/calc.test.ts:4:1 contains a typescript test entry",
      "every entry must have exactly one @test-evidence marker",
      "does not directly precede a discovered test entry"
    ]);
    const unregisteredDiagnostic = entryInvalid.diagnostics.find(
      (diagnostic) => diagnostic.code === "mapping.unregistered-entry"
    );
    assert.equal(unregisteredDiagnostic?.path, "src/calc.test.ts");
    assert.equal(unregisteredDiagnostic?.line, 4);
    assert.equal(unregisteredDiagnostic?.column, 1);
    const humanOutput = formatTestEvidenceCliOutput(entryInvalid, false);
    assert.match(
      humanOutput.stderr,
      /blocking error \[mapping\.unregistered-entry\]/u
    );
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
    const catalogInvalid = await validateCollectedTestEvidence({
      workspaceRoot: catalogInvalidRoot
    });
    const catalogMessages = diagnosticMessages(catalogInvalid.diagnostics);
    assertIncludesAll(catalogMessages, [
      "case heading must use exactly: ### Case <CASE-ID>: <title>",
      "WB-MISSING-CONTRACT-001 must include exactly one non-empty Contract list",
      "RV-BAD-GLOB-001 Scope pattern is invalid",
      "RV-NO-GIT-MATCH-001 Scope pattern src/does-not-exist/** does not match any Git-visible path"
    ]);
    assert.equal(
      catalogMessages.filter((message) =>
        message.includes("case heading must use exactly")
      ).length,
      2
    );
    assert.equal(catalogInvalid.summary.catalogCases, 9);
    assert.ok(catalogInvalid.diagnostics.some((diagnostic) =>
      diagnostic.category === "catalog"
      && diagnostic.path === "docs/testing/cases.md"
    ));
  }));
  validationTasks.push(validationGate.promise.then(async () => {
    const query = spawnSync(
      "node",
      [
        generatedLedgerPath,
        "list",
        "--root",
        catalogInvalidRoot
      ],
      { encoding: "utf8", windowsHide: true }
    );
    assert.equal(query.status, 1);
    assert.equal(query.stdout, "");
    assert.match(query.stderr, /blocking error \[state-index\.index-stale\]/u);
    assert.match(query.stderr, /sync-index --write/u);
  }));

  await assertDirectCliHelp();
  await assertDirectMissingCase(workspaceRoot);
  await assertDirectCliFailure();
  validationGate.resolve();
  await waitForAll(validationTasks);

  const missingInventory = spawnSync(
    "node",
    [
      generatedLedgerPath,
      "check",
      "--inventory",
      path.join(tempRoot, "missing-inventory.json"),
      "--root",
      workspaceRoot,
      "--json"
    ],
    { encoding: "utf8", windowsHide: true }
  );
  assert.equal(missingInventory.status, 1);
  assert.equal(missingInventory.stderr, "");
  const missingInventoryReport = v.parse(
    testEvidenceReportSchema,
    JSON.parse(missingInventory.stdout)
  );
  assert.equal(missingInventoryReport.schemaVersion, 3);
  assert.ok(missingInventoryReport.diagnostics.some((diagnostic) => (
    diagnostic.code === "inventory.not-found" && diagnostic.blocking
  )));

  const malformedInventoryPath = path.join(
    tempRoot,
    "malformed-inventory.json"
  );
  await fs.writeFile(malformedInventoryPath, "{\n", "utf8");
  const malformedInventoryQuery = spawnSync(
    "node",
    [
      generatedLedgerPath,
      "check",
      "--inventory",
      malformedInventoryPath,
      "--root",
      workspaceRoot,
      "--json"
    ],
    { encoding: "utf8", windowsHide: true }
  );
  assert.equal(malformedInventoryQuery.status, 1);
  assert.equal(malformedInventoryQuery.stderr, "");
  const malformedInventoryResult = v.parse(
    testEvidenceReportSchema,
    JSON.parse(malformedInventoryQuery.stdout)
  );
  assert.equal(malformedInventoryResult.schemaVersion, 3);
  assert.ok(malformedInventoryResult.diagnostics.some((diagnostic) => (
    diagnostic.code === "inventory.json-invalid" && diagnostic.blocking
  )));

  const invalidQuery = spawnSync(
    "node",
    [generatedLedgerPath, "list", "--query", "   ", "--root", workspaceRoot],
    { encoding: "utf8", windowsHide: true }
  );
  assert.equal(invalidQuery.status, 2);
  assert.match(
    invalidQuery.stderr,
    /must contain a non-whitespace character/u
  );

  const invalidUsage = spawnSync(
    "node",
    [generatedLedgerPath, "unknown", "--inventory", validInventoryPath],
    { encoding: "utf8" }
  );
  assert.equal(invalidUsage.status, 2);
  assert.match(invalidUsage.stderr, /too many arguments|unknown command/);

  const generatedLedger = await fs.readFile(generatedLedgerPath, "utf8");
  assert.match(generatedLedger, /Generated test-evidence ledger CLI/);
  assert.match(generatedLedger, /Rebuild: bun run sync:test-evidence-cli/);
  assert.match(
    generatedLedger,
    /sourceMappingURL=test-evidence-ledger\.mjs\.map/
  );
  const declarationSource = await fs.readFile(
    generatedLedgerDeclarationPath,
    "utf8"
  );
  assert.match(
    declarationSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/test-evidence\/api\/test-evidence-ledger\.d\.mts/
  );
  assert.match(declarationSource, /validateTestEvidenceLedger/);
  assert.match(declarationSource, /inspectTestEvidenceLedger/);
  assert.match(declarationSource, /queryTestEvidenceLedger/);
  assert.match(declarationSource, /syncTestEvidenceIndex/);
  assert.match(declarationSource, /runTestEvidenceLedgerCli/);
  const collectorSourceMap = JSON.parse(
    await fs.readFile(`${generatedCollectorPath}.map`, "utf8")
  ) as { sources: string[] };
  assert.ok(collectorSourceMap.sources.includes(
    "tools/test-evidence/src/regex-collector.ts"
  ));
  assert.ok(!collectorSourceMap.sources.includes(
    "tools/test-evidence/src/validation.ts"
  ));
  const ledgerSourceMap = JSON.parse(
    await fs.readFile(`${generatedLedgerPath}.map`, "utf8")
  ) as { sourceRoot: string; sources: string[] };
  assert.equal(ledgerSourceMap.sourceRoot, "../../../");
  assert.ok(ledgerSourceMap.sources.includes(
    "tools/test-evidence/src/validation.ts"
  ));
  assert.ok(ledgerSourceMap.sources.includes(
    "tools/test-evidence/src/state-index.ts"
  ));
  assert.ok(ledgerSourceMap.sources.includes(
    "tools/index-runtime/src/storage.ts"
  ));
  assert.ok(!ledgerSourceMap.sources.includes(
    "tools/test-evidence/src/regex-collector.ts"
  ));
  assert.ok(ledgerSourceMap.sources.every((source) =>
    !path.isAbsolute(source) && !source.includes("\\")
  ));
  for (const obsoleteArtifact of [
    "test-evidence.d.mts",
    "test-evidence.mjs",
    "test-evidence.mjs.map"
  ]) {
    await assert.rejects(
      fs.access(path.join(path.dirname(generatedLedgerPath), obsoleteArtifact)),
      { code: "ENOENT" }
    );
  }
  for (const schemaName of [
    "test-entry-inventory.schema.json",
    "regex-collector-config.schema.json",
    "test-evidence-ledger-config.schema.json",
    "test-evidence-report.schema.json",
    "test-evidence-inspection.schema.json",
    "test-evidence-index-sync-result.schema.json",
    "test-evidence-state-index.schema.json",
    "test-evidence-query-result.schema.json"
  ]) {
    const schema = JSON.parse(await fs.readFile(path.join(
      rootDir,
      "skills",
      "test-evidence-review",
      "references",
      "schemas",
      schemaName
    ), "utf8")) as { $schema?: string; title?: string };
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.ok(schema.title?.length);
  }
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

function diagnosticMessages(
  diagnostics: readonly { message: string }[]
): string[] {
  return diagnostics.map((diagnostic) => diagnostic.message);
}

async function assertDirectCliFailure(): Promise<void> {
  const result = await captureDirectCliOutput([
    "unknown",
    "--inventory",
    "unused.json"
  ]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /too many arguments|unknown command/);
}

async function assertDirectCliHelp(): Promise<void> {
  const result = await captureDirectCliOutput(["--help"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /default: current directory/u);
  assert.match(result.stdout, /default when omitted/u);
  assert.match(result.stdout, /Exit codes:\s+0\s+Success/u);
  assert.match(result.stdout, /1\s+Blocking validation diagnostic/u);
  assert.equal(result.stdout.includes(process.cwd()), false);
}

async function assertDirectMissingCase(workspaceRoot: string): Promise<void> {
  const result = await captureDirectCliOutput([
    "show",
    "MISSING-CASE-001",
    "--root",
    workspaceRoot
  ]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /blocking error \[catalog\.case-missing\]: Test evidence case does not exist/u
  );
}

async function captureDirectCliOutput(
  argv: readonly string[]
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const stderr: string[] = [];
  const stdout: string[] = [];
  const originalStderrWrite = process.stderr.write;
  const originalStdoutWrite = process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  let exitCode: number;
  try {
    exitCode = await runTestEvidenceLedgerCli(argv);
  } finally {
    process.stderr.write = originalStderrWrite;
    process.stdout.write = originalStdoutWrite;
  }
  return {
    exitCode,
    stderr: stderr.join(""),
    stdout: stdout.join("")
  };
}

type CollectedTestEvidenceOptions = {
  collectorConfigPath?: string;
  configPath?: string;
  workspaceRoot: string;
};

async function validateCollectedTestEvidence(
  options: CollectedTestEvidenceOptions
) {
  const inventory = await collectBundledRegexTestEntries({
    configPath: options.collectorConfigPath,
    workspaceRoot: options.workspaceRoot
  });
  return await validateBundledTestEvidenceLedger({
    configPath: options.configPath,
    inventory,
    inventorySource: "bundled regex collector",
    workspaceRoot: options.workspaceRoot
  });
}

async function inspectCollectedTestEvidence(
  options: CollectedTestEvidenceOptions
) {
  const inventory = await collectBundledRegexTestEntries({
    configPath: options.collectorConfigPath,
    workspaceRoot: options.workspaceRoot
  });
  return await inspectBundledTestEvidenceLedger({
    configPath: options.configPath,
    inventory,
    inventorySource: "bundled regex collector",
    workspaceRoot: options.workspaceRoot
  });
}

async function writeCollectedInventory(
  workspaceRoot: string,
  name: string
): Promise<string> {
  const inventory = await collectBundledRegexTestEntries({ workspaceRoot });
  const inventoryPath = path.join(tempRoot, `${name}-inventory.json`);
  await fs.writeFile(
    inventoryPath,
    `${JSON.stringify(inventory, null, 2)}\n`,
    "utf8"
  );
  return inventoryPath;
}

async function syncWorkspaceIndex(workspaceRoot: string): Promise<void> {
  const result = await syncBundledTestEvidenceIndex({
    mode: "write",
    workspaceRoot
  });
  assert.equal(
    result.status,
    "ok",
    JSON.stringify(result.diagnostics, null, 2)
  );
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
