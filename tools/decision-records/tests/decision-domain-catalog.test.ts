import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  currentRelativePath,
  runBundledCli,
  withFixtureWorkspace
} from "./support.ts";

type TestDomainCatalog = {
  schemaVersion: 1;
  domains: Array<{
    id: string;
    description: string;
  }>;
};

test("domains command reads the catalog without a decision index", () => (
  withFixtureWorkspace("domain-query", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");

  await fs.rm(indexPath);
  const domainsWithoutIndex = await runBundledCli([
    "domains",
    "--root",
    workspaceRoot
  ]);
  assert.equal(domainsWithoutIndex.exitCode, 0, domainsWithoutIndex.stderr);
  assert.match(domainsWithoutIndex.stdout, /^Domains:$/m);
  assert.match(domainsWithoutIndex.stdout, /- change-plan: /);
  assert.match(domainsWithoutIndex.stdout, /- decision-records: /);
  assert.match(domainsWithoutIndex.stdout, /- project-tooling: /);
  })
));

test("decision domain catalog enforces required sorted unique entries", () => (
  withFixtureWorkspace("domain-structure", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const catalogPath = path.join(decisionsDirectory, "decision-domains.json");
  const originalCatalogText = await fs.readFile(catalogPath, "utf8");
  const originalCatalog = JSON.parse(originalCatalogText) as TestDomainCatalog;

  await fs.rm(catalogPath);
  await assertValidationError(workspaceRoot, "decision-domains.json is required");
  await fs.writeFile(catalogPath, originalCatalogText, "utf8");

  const reversedCatalog = structuredClone(originalCatalog);
  reversedCatalog.domains.reverse();
  await writeCatalog(catalogPath, reversedCatalog);
  await assertValidationError(
    workspaceRoot,
    "domains must be sorted by id in ascending lexical order"
  );
  await fs.writeFile(catalogPath, originalCatalogText, "utf8");

  const duplicateCatalog = structuredClone(originalCatalog);
  duplicateCatalog.domains.splice(1, 0, {
    ...duplicateCatalog.domains[0]!
  });
  await writeCatalog(catalogPath, duplicateCatalog);
  await assertValidationError(workspaceRoot, "domain ids must be unique");
  await fs.writeFile(catalogPath, originalCatalogText, "utf8");

  const multilineDescriptionCatalog = structuredClone(originalCatalog);
  multilineDescriptionCatalog.domains[0]!.description = "第一行\n第二行";
  await writeCatalog(catalogPath, multilineDescriptionCatalog);
  await assertValidationError(workspaceRoot, "must be a single line");
  })
));

test("decision domain catalog revision ignores formatting but tracks descriptions", () => (
  withFixtureWorkspace("domain-revision", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const catalogPath = path.join(decisionsDirectory, "decision-domains.json");
  const originalCatalogText = await fs.readFile(catalogPath, "utf8");
  const originalCatalog = JSON.parse(originalCatalogText) as TestDomainCatalog;

  await fs.writeFile(
    catalogPath,
    JSON.stringify(originalCatalog) + "\n",
    "utf8"
  );
  const reformattedCatalogQuery = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(reformattedCatalogQuery.exitCode, 0, reformattedCatalogQuery.stderr);
  await fs.writeFile(catalogPath, originalCatalogText, "utf8");

  const changedDescriptionCatalog = structuredClone(originalCatalog);
  changedDescriptionCatalog.domains[0]!.description += "（修订）";
  await writeCatalog(catalogPath, changedDescriptionCatalog);
  const changedDescriptionQuery = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(changedDescriptionQuery.exitCode, 0, changedDescriptionQuery.stderr);
  assert.doesNotMatch(changedDescriptionQuery.stdout, /（修订）/);
  const changedDescriptionDomains = await runBundledCli([
    "domains",
    "--root",
    workspaceRoot
  ]);
  assert.equal(changedDescriptionDomains.exitCode, 0);
  assert.match(changedDescriptionDomains.stdout, /（修订）/);
  assert.ok((await validateDecisionRecords({ workspaceRoot })).errors.some(
    (error) => error.includes("out of sync")
  ));
  })
));

test("decision domain catalog validates ownership and domain membership", () => (
  withFixtureWorkspace("domain-membership", async (workspaceRoot) => {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const catalogPath = path.join(decisionsDirectory, "decision-domains.json");
  const decisionPath = path.join(decisionsDirectory, currentRelativePath);
  const originalCatalogText = await fs.readFile(catalogPath, "utf8");
  const originalCatalog = JSON.parse(originalCatalogText) as TestDomainCatalog;
  const originalDecision = await fs.readFile(decisionPath, "utf8");

  const missingUsedDomainCatalog = structuredClone(originalCatalog);
  missingUsedDomainCatalog.domains = missingUsedDomainCatalog.domains.filter(
    (domain) => domain.id !== "project-tooling"
  );
  await writeCatalog(catalogPath, missingUsedDomainCatalog);
  const queryWithUndefinedRecordDomain = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(queryWithUndefinedRecordDomain.exitCode, 0);
  assert.match(queryWithUndefinedRecordDomain.stdout, /project-tooling:/);
  await assertValidationError(
    workspaceRoot,
    "Decision domain directory is not defined in decision-domains.json: project-tooling"
  );
  await fs.writeFile(catalogPath, originalCatalogText, "utf8");

  await fs.writeFile(
    decisionPath,
    originalDecision.replace(
      "title: 使用生成 CLI\n",
      "title: 使用生成 CLI\ndomain: project-tooling\n"
    ),
    "utf8"
  );
  await assertValidationError(
    workspaceRoot,
    "frontmatter has unsupported keys: domain"
  );
  await fs.writeFile(decisionPath, originalDecision, "utf8");

  const candidatePath = path.join(
    decisionsDirectory,
    "unavailable-domain",
    "use-unavailable-domain.md"
  );
  await fs.mkdir(path.dirname(candidatePath), { recursive: true });
  await fs.writeFile(
    candidatePath,
    originalDecision
      .replace("title: 使用生成 CLI", "title: 使用未登记领域候选")
      .replace(
        "createdAt: 2026-07-11T14:15:16+08:00",
        "createdAt: null"
      ),
    "utf8"
  );
  const queryWithUndefinedCandidateDomain = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(queryWithUndefinedCandidateDomain.exitCode, 0);
  assert.doesNotMatch(queryWithUndefinedCandidateDomain.stdout, /unavailable-domain/);
  await assertValidationError(
    workspaceRoot,
    "Decision domain directory is not defined in decision-domains.json: unavailable-domain"
  );
  await fs.rm(path.dirname(candidatePath), { force: true, recursive: true });

  const emptyDomainDirectory = path.join(decisionsDirectory, "change-plan");
  await fs.mkdir(emptyDomainDirectory);
  await assertValidationError(
    workspaceRoot,
    "Decision domain directory must contain at least one decision file: change-plan"
  );
  })
));

async function writeCatalog(
  catalogPath: string,
  catalog: TestDomainCatalog
): Promise<void> {
  await fs.writeFile(
    catalogPath,
    JSON.stringify(catalog, null, 2) + "\n",
    "utf8"
  );
}

async function assertValidationError(
  workspaceRoot: string,
  expected: string
): Promise<void> {
  const validation = await validateDecisionRecords({ workspaceRoot });
  assert.ok(
    validation.errors.some((error) => error.includes(expected)),
    `Expected validation error containing: ${expected}`
  );
}
