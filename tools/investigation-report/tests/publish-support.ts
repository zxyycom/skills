import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  investigationRoot,
  reportMarkdown,
  runInvestigationCli
} from "./v6-support.ts";

export const candidatePath = (root: string, id: string): string =>
  path.join(investigationRoot(root), `_candidate.${id.replace(/\.md$/iu, "")}`);

export async function createReadyCandidate(
  root: string,
  id: string,
  options: Parameters<typeof reportMarkdown>[0] = { id }
): Promise<void> {
  const investigationId = id.replace(/\.md$/iu, "");
  const created = await runInvestigationCli(root, [
    "new",
    investigationId,
    "--title",
    options.title ?? investigationId,
    "--formed-at",
    options.formedAt ?? "2026-08-28T12:00:00+00:00",
    "--question",
    options.question ?? "候选应如何建立？",
    "--tag",
    (options.tags ?? ["investigation-report"])[0]!
  ]);
  assert.equal(created.status, 0, created.stderr);
  await fs.writeFile(
    candidatePath(root, investigationId),
    reportMarkdown({ ...options, id: investigationId }),
    "utf8"
  );
}
