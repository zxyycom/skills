import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { argumentsForWorker, measure } from "./measurement.ts";
import { stageDecisionRecords } from "./source/tools/decision-records/src/decision-stage-service.ts";
import type { DecisionStageScope } from "./source/tools/decision-records/src/decision-stage-contracts.ts";

// Formation-time attachment: neither creates Git history nor changes sources.
// Scope prerequisites and scenario classification are checked outside timing.
const { operation, root, size } = argumentsForWorker();
assert.ok(["stage-index", "stage-domain", "stage-all"].includes(operation));
assert.ok(
  root.startsWith(path.join(import.meta.dirname, "datasets") + path.sep)
);
assert.equal(size % 10, 0);
const scope: DecisionStageScope =
  operation === "stage-index"
    ? "index"
    : operation === "stage-domain"
      ? "domain"
      : "all";
const decisionId = "261020-record-000001";
const decisionsDir = "docs/decisions";
const sourcePath = decisionsDir + "/" + decisionId + ".md";
const indexPath = decisionsDir + "/decision-index.json";
const exec = promisify(execFile);
async function git(...args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024
  });
  return stdout;
}
function paths(text: string): string[] {
  return text
    .split("\0")
    .filter((item) => item.length > 0)
    .sort();
}
const marker: unknown = JSON.parse(
  await fs.readFile(path.join(root, ".decision-fixture.json"), "utf8")
);
assert.deepEqual(marker, {
  domain: "decision",
  version: 1,
  size,
  source: "5c95358b"
});
assert.ok(
  (await fs.lstat(path.join(root, ".git"))).isDirectory(),
  "a standalone fixture Git root is required"
);
assert.equal(
  path.resolve((await git("rev-parse", "--show-toplevel")).trim()),
  root
);
assert.match(
  (await git("rev-parse", "--verify", "HEAD")).trim(),
  /^[0-9a-f]{40,64}$/u
);
assert.deepEqual(
  paths(await git("diff", "--cached", "--name-only", "-z", "--", decisionsDir)),
  [],
  "each invocation needs a HEAD-clean pending decision scope"
);
const baselineSource = await git("show", "HEAD:" + sourcePath);
const currentSource = await fs.readFile(path.join(root, sourcePath), "utf8");
const scenario =
  currentSource === baselineSource
    ? "head-no-change"
    : "one-source-purpose-change";
assert.equal(
  currentSource.replace(/^purpose: [^\n]*$/mu, "purpose: <value>"),
  baselineSource.replace(/^purpose: [^\n]*$/mu, "purpose: <value>"),
  "only the selected purpose may differ from HEAD"
);
const worktreePaths = paths(
  await git("diff", "--name-only", "-z", "--", decisionsDir)
);
assert.deepEqual(
  worktreePaths,
  scenario === "head-no-change" ? [] : [indexPath, sourcePath].sort(),
  "change the selected source and sync-index before invoking stage"
);

await measure("decision", operation, size, async () => {
  const result = await stageDecisionRecords({
    decisionIds: [decisionId],
    location: { decisionsDir, workspaceRoot: root },
    scope
  });
  assert.ok(
    result.status === "ok",
    result.status === "error"
      ? JSON.stringify(result.diagnostics)
      : "stage failed"
  );
  assert.equal(result.command, "stage");
  assert.equal(result.scope, scope);
  assert.deepEqual(result.selectedIds, [decisionId]);
  assert.equal(result.indexRelativePath, indexPath);
  const expectedWritten =
    scenario === "head-no-change"
      ? []
      : scope === "index"
        ? [indexPath]
        : scope === "domain"
          ? [sourcePath]
          : [indexPath, sourcePath];
  assert.deepEqual([...result.writtenPaths].sort(), expectedWritten.sort());
  assert.deepEqual(result.preservedPendingPaths, []);
  assert.deepEqual(
    result.callerOwnedPaths,
    scope === "index" ? [sourcePath] : scope === "domain" ? [indexPath] : []
  );
  assert.equal(result.pendingFileCount, scope === "index" ? 1 : size + 1);
  return {
    status: "ok",
    scenario,
    scope,
    selected: 1,
    pendingFileCount: result.pendingFileCount,
    writtenPaths: result.writtenPaths,
    callerOwnedPaths: result.callerOwnedPaths,
    preservedPendingPaths: result.preservedPendingPaths
  };
});
