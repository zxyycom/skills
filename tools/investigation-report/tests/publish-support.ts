import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { investigationRoot, reportMarkdown } from "./fixture-support.ts";
import { createInvestigationCandidate } from "../src/candidate-create.ts";

export const candidatePath = (root: string, id: string): string =>
  path.join(investigationRoot(root), `_candidate.${id.replace(/\.md$/iu, "")}`);

export async function createReadyCandidate(
  root: string,
  id: string,
  options: Parameters<typeof reportMarkdown>[0] = { id }
): Promise<void> {
  const investigationId = id.replace(/\.md$/iu, "");
  const created = await createInvestigationCandidate({
    workspaceRoot: root,
    id: investigationId,
    title: options.title ?? investigationId,
    formedAt: options.formedAt ?? "2026-08-28T12:00:00+00:00",
    question: options.question ?? "候选应如何建立？",
    tags: options.tags ?? ["investigation-report"],
    relations: []
  });
  assert.equal(created.status, "ok", created.errors.join("; "));
  if (created.candidate.path !== candidatePath(root, investigationId))
    await fs.rename(
      created.candidate.path,
      candidatePath(root, investigationId)
    );
  await fs.writeFile(
    candidatePath(root, investigationId),
    reportMarkdown({ ...options, id: investigationId }),
    "utf8"
  );
}
