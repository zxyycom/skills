import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { ResourceInspectionError } from "../src/resource-inspection.ts";
import {
  readOwnedResourceFixture,
  targetFor,
  operationFor,
  injectSecondPhaseFailure,
  resourceFailureId as resourceId
} from "./resource-phase-test-support.ts";
import { prepareInvestigationResourceRoot } from "../src/resource-root.ts";
import {
  directInvestigationResourceIssues,
  inspectDirectInvestigationResource
} from "../src/resource-file-validation.ts";
import { initializeGit } from "./git-support.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

async function prepare(root: string, recorded = true): Promise<void> {
  const target = path.join(investigationRoot(root), "_resources", resourceId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "original\n");
  if (recorded) await writeCollection(root, [{ id: "one" }]);
  if (recorded) initializeGit(root);
  await fs.writeFile(target, "selected update\n");
}

function denied(): Error {
  return Object.assign(
    new Error(
      "denied /private/resource\n\u001b[31m token=ghp_123456789012345678901234567890"
    ),
    { code: "EACCES" }
  );
}

async function expectResourceReadFailure(
  root: string,
  failure: string
): Promise<void> {
  await prepare(root, false);
  const relative = "docs/investigations/_resources/" + resourceId;
  assert.equal(
    await readOwnedResourceFixture(root, relative),
    "selected update\n"
  );
  const fault = injectSecondPhaseFailure(root, failure, denied(), 1);
  try {
    await assert.rejects(
      readOwnedResourceFixture(root, relative),
      (error: unknown) => {
        assert.ok(error instanceof ResourceInspectionError);
        assert.equal(error.diagnostic.causeCategory, "access-denied");
        assert.equal(error.diagnostic.operation, operationFor(failure));
        assert.equal(error.diagnostic.target, targetFor(root, failure));
        assert.doesNotMatch(
          JSON.stringify(error.diagnostic),
          /private|ghp_|\\u001b/u
        );
        return true;
      }
    );
    assert.equal(fault.injected(), true);
  } finally {
    fault.restore();
  }
}

for (const failure of [
  "root inspection",
  "root resolution",
  "root enumeration",
  "owner enumeration",
  "intermediate enumeration",
  "file inspection",
  "terminal open"
]) {
  test(`resource validation preserves second-phase ${failure} failure facts`, async () => {
    await withTempRoot("resource-failure-facts", async (root) => {
      await expectResourceReadFailure(root, failure);
    });
  });
}

test("resource inspectors keep default validation issues while detailed inspection retains real open failure", async () => {
  await withTempRoot("resource-default-issues", async (root) => {
    await prepare(root, false);
    const prepared = await prepareInvestigationResourceRoot(
      investigationRoot(root),
      { mode: "file-system" }
    );
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready") return;
    const original = fs.open;
    const target = targetFor(root, "terminal open");
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === target) throw denied();
      return await original(...args);
    }) as typeof fs.open;
    try {
      const issues = await directInvestigationResourceIssues(
        prepared,
        resourceId
      );
      const detailed = await inspectDirectInvestigationResource(
        prepared,
        resourceId
      );
      assert.deepEqual(detailed.errors, issues);
      assert.match(issues.join("; "), /could not be read as a regular file/u);
      assert.equal(detailed.failure?.diagnostic.causeCategory, "access-denied");
      assert.equal(
        detailed.failure?.diagnostic.operation,
        "open resource file"
      );
      assert.equal(detailed.failure?.diagnostic.target, target);
      assert.ok(!/private|ghp_/u.test(issues.join("; ")));
      assert.ok(!issues.join("; ").includes(String.fromCharCode(27)));
    } finally {
      fs.open = original;
    }
  });
});

test("resource inspectors do not invent filesystem categories for ordinary symlink validation", async () => {
  await withTempRoot("resource-validation-not-system", async (root) => {
    await prepare(root, false);
    const target = targetFor(root, "terminal open");
    const saved = path.join(root, "saved-resource");
    await fs.rename(target, saved);
    await fs.symlink(saved, target);
    const prepared = await prepareInvestigationResourceRoot(
      investigationRoot(root),
      { mode: "file-system" }
    );
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready") return;
    const inspected = await inspectDirectInvestigationResource(
      prepared,
      resourceId
    );
    assert.equal(inspected.failure, undefined);
    assert.match(inspected.errors.join("; "), /symbolic link/u);
    assert.deepEqual(
      await directInvestigationResourceIssues(prepared, resourceId),
      inspected.errors
    );
  });
});
