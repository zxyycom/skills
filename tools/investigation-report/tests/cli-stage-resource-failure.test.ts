import {
  targetFor,
  operationFor,
  injectSecondPhaseFailure,
  resourceFailureId as resourceId
} from "./resource-phase-test-support.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { runInvestigationReportCheckCli } from "../src/cli.ts";

import { initializeGit } from "./git-support.ts";
import { investigationRoot, withTempRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

async function prepare(root: string, recorded = true): Promise<void> {
  const target = path.join(investigationRoot(root), "_resources", resourceId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "original\n");
  await writeCollection(root, [{ id: "one" }]);
  if (recorded) initializeGit(root);
  await fs.writeFile(target, "selected update\n");
}

async function expectStageReadFailure(
  root: string,
  facts: Readonly<{
    failure: string;
    error: Error;
    category: "access-denied" | "unknown";
    recovery: string;
  }>
): Promise<void> {
  await prepare(root);
  const indexPath = path.join(root, ".git/index");
  const before = await fs.readFile(indexPath);
  const fault = injectSecondPhaseFailure(root, facts.failure, facts.error, 0);
  let stdout = "",
    stderr = "";
  try {
    const exit = await runInvestigationReportCheckCli(
      ["--root", root, "stage", "one", "--scope", "domain"],
      {
        io: {
          stdout: (value) => {
            stdout += value;
          },
          stderr: (value) => {
            stderr += value;
          }
        }
      }
    );
    assert.equal(fault.injected(), true);
    assert.equal(exit, 1);
    assert.equal(stdout, "");
    assert.match(stderr, /state: source-drift; changed: false/u);
    assert.ok(stderr.includes(`causeCategory: ${facts.category}`));
    assert.ok(stderr.includes(`operation: ${operationFor(facts.failure)}`));
    const relative = path
      .relative(root, targetFor(root, facts.failure))
      .split(path.sep)
      .join("/");
    assert.ok(
      stderr.includes(
        `[investigation-report.stage-source-read-failed] ${relative}\n`
      )
    );
    assert.ok(stderr.includes(facts.recovery));
    assert.ok(!stderr.includes(String.fromCharCode(27)));
    assert.ok(!/private|ghp_|sync-index|scope: Pending/u.test(stderr));
    assert.deepEqual(await fs.readFile(indexPath), before);
  } finally {
    fault.restore();
  }
}

test("investigation stage keeps unknown real resource syscall failures distinct from ordinary validation", async () => {
  await withTempRoot("resource-unknown-failure", async (root) => {
    await expectStageReadFailure(root, {
      failure: "terminal open",
      error: Object.assign(
        new Error("unsupported /private/resource token=private-value"),
        { code: "ENOTSUP" }
      ),
      category: "unknown",
      recovery: "resolve the reported filesystem read failure"
    });
  });
});
