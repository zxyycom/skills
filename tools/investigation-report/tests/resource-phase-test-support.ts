import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { stageInvestigationReports } from "../src/staging.ts";

/** The fault hook is installed by the test; this owns byte observation and unchanged-index proof. */
export async function expectResourceRejectionBeforeBytes(
  root: string,
  resource: string,
  replacementOccurred: () => boolean
): Promise<void> {
  const original = fs.readFile;
  const before = await original(path.join(root, ".git/index"));
  let reads = 0;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    if (args[0] === path.join(root, resource)) reads += 1;
    return await original(...args);
  }) as typeof fs.readFile;
  try {
    const result = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: ["one"],
      scope: "domain"
    });
    assert.equal(replacementOccurred(), true);
    assert.equal(result.status, "error");
    assert.equal(reads, 0);
    assert.deepEqual(await original(path.join(root, ".git/index")), before);
  } finally {
    fs.readFile = original;
  }
}
