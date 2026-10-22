import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { synchronizeInvestigationIndex } from "../src/validation.ts";
import {
  investigationRoot,
  reportMarkdown,
  type ReportFixture
} from "./fixture-support.ts";

export async function writeCollection(
  workspaceRoot: string,
  reports: readonly ReportFixture[],
  sync = true
): Promise<void> {
  const root = investigationRoot(workspaceRoot);
  await fs.mkdir(root, { recursive: true });
  for (const report of reports) {
    await fs.writeFile(
      path.join(root, report.sourcePath ?? `${report.id}.md`),
      reportMarkdown(report),
      "utf8"
    );
  }
  if (sync) {
    const result = await synchronizeInvestigationIndex({ workspaceRoot });
    assert.deepEqual(result.errors, []);
  }
}

export async function writeResource(
  root: string,
  id: string,
  bytes: string
): Promise<void> {
  await fs.mkdir(path.dirname(resourcePath(root, id)), { recursive: true });
  await fs.writeFile(resourcePath(root, id), bytes, "utf8");
}

export function resourcePath(root: string, id: string): string {
  return path.join(investigationRoot(root), "_resources", id);
}
