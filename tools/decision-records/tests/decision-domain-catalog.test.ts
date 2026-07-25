import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { validateDecisionRecords } from "../src/index.ts";
import {
  createFixtureWorkspace,
  currentRelativePath,
  runBundledCli
} from "./support.ts";

type TestDomainCatalog = {
  schemaVersion: 1;
  domains: Array<{
    id: string;
    description: string;
  }>;
};

const workspaceRoot = await createFixtureWorkspace();
try {
  const decisionsDirectory = path.join(workspaceRoot, "docs", "decisions");
  const catalogPath = path.join(decisionsDirectory, "decision-domains.json");
  const indexPath = path.join(decisionsDirectory, "decision-index.json");
  const decisionPath = path.join(decisionsDirectory, currentRelativePath);
  const originalCatalogText = await fs.readFile(catalogPath, "utf8");
  const originalCatalog = JSON.parse(originalCatalogText) as TestDomainCatalog;
  const originalDecision = await fs.readFile(decisionPath, "utf8");
  const originalIndexText = await fs.readFile(indexPath, "utf8");

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
  await fs.writeFile(indexPath, originalIndexText, "utf8");

  await fs.rm(catalogPath);
  await assertValidationError("decision-domains.json is required");
  await restoreCatalog();

  const reversedCatalog = structuredClone(originalCatalog);
  reversedCatalog.domains.reverse();
  await writeCatalog(reversedCatalog);
  await assertValidationError(
    "domains must be sorted by id in ascending lexical order"
  );
  await restoreCatalog();

  const duplicateCatalog = structuredClone(originalCatalog);
  duplicateCatalog.domains.splice(1, 0, {
    ...duplicateCatalog.domains[0]!
  });
  await writeCatalog(duplicateCatalog);
  await assertValidationError("domain ids must be unique");
  await restoreCatalog();

  const multilineDescriptionCatalog = structuredClone(originalCatalog);
  multilineDescriptionCatalog.domains[0]!.description = "第一行\n第二行";
  await writeCatalog(multilineDescriptionCatalog);
  await assertValidationError("must be a single line");
  await restoreCatalog();

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
  await restoreCatalog();

  const changedDescriptionCatalog = structuredClone(originalCatalog);
  changedDescriptionCatalog.domains[0]!.description += "（修订）";
  await writeCatalog(changedDescriptionCatalog);
  const changedDescriptionQuery = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(changedDescriptionQuery.exitCode, 1);
  assert.match(changedDescriptionQuery.stderr, /source revision/i);
  await restoreCatalog();

  const missingUsedDomainCatalog = structuredClone(originalCatalog);
  missingUsedDomainCatalog.domains = missingUsedDomainCatalog.domains.filter(
    (domain) => domain.id !== "project-tooling"
  );
  await writeCatalog(missingUsedDomainCatalog);
  const queryWithUndefinedRecordDomain = await runBundledCli([
    "list",
    "--root",
    workspaceRoot
  ]);
  assert.equal(queryWithUndefinedRecordDomain.exitCode, 1);
  assert.match(
    queryWithUndefinedRecordDomain.stderr,
    /Decision domain directory is not defined in decision-domains\.json: project-tooling/
  );
  await restoreCatalog();

  await fs.writeFile(
    decisionPath,
    originalDecision.replace(
      "title: 使用生成 CLI\n",
      "title: 使用生成 CLI\ndomain: project-tooling\n"
    ),
    "utf8"
  );
  await assertValidationError("frontmatter has unsupported keys: domain");
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
  assert.equal(queryWithUndefinedCandidateDomain.exitCode, 1);
  assert.match(
    queryWithUndefinedCandidateDomain.stderr,
    /Decision domain directory is not defined in decision-domains\.json: unavailable-domain/
  );
  await fs.rm(path.dirname(candidatePath), { force: true, recursive: true });

  const emptyDomainDirectory = path.join(decisionsDirectory, "change-plan");
  await fs.mkdir(emptyDomainDirectory);
  await assertValidationError(
    "Decision domain directory must contain at least one decision file: change-plan"
  );
  await fs.rmdir(emptyDomainDirectory);

  async function restoreCatalog(): Promise<void> {
    await fs.writeFile(catalogPath, originalCatalogText, "utf8");
  }

  async function writeCatalog(catalog: TestDomainCatalog): Promise<void> {
    await fs.writeFile(
      catalogPath,
      JSON.stringify(catalog, null, 2) + "\n",
      "utf8"
    );
  }

  async function assertValidationError(expected: string): Promise<void> {
    const validation = await validateDecisionRecords({ workspaceRoot });
    assert.ok(
      validation.errors.some((error) => error.includes(expected)),
      `Expected validation error containing: ${expected}`
    );
  }
} finally {
  await fs.rm(workspaceRoot, { force: true, recursive: true });
}
