import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { synchronizeInvestigationIndex } from "../../src/records/validation/validation.ts";
import { investigationRoot } from "../support/fixture-support.ts";
import { writeCollection } from "../support/collection-support.ts";

export async function prepareLegacyOwnerRename(workspaceRoot: string): Promise<
  Readonly<{
    indexBefore: string;
    indexPath: string;
    oldOwner: string;
    reportBefore: string;
    reportPath: string;
    root: string;
    targetOwner: string;
  }>
> {
  await writeCollection(
    workspaceRoot,
    [{ id: "legacy", resources: ["legacy/evidence.txt"] }],
    false
  );
  const root = investigationRoot(workspaceRoot);
  const reportPath = path.join(root, "legacy.md");
  const indexPath = path.join(root, "investigation-index.json");
  const oldOwner = path.join(root, "_resources", "legacy");
  const targetOwner = path.join(root, "_resources", "260828-migrated");
  await fs.mkdir(oldOwner, { recursive: true });
  await fs.writeFile(
    path.join(oldOwner, "evidence.txt"),
    "original evidence\n",
    "utf8"
  );
  assert.deepEqual(
    (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
    []
  );
  return {
    indexBefore: await fs.readFile(indexPath, "utf8"),
    indexPath,
    oldOwner,
    reportBefore: await fs.readFile(reportPath, "utf8"),
    reportPath,
    root,
    targetOwner
  };
}
