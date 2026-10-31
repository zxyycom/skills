import { Buffer } from "node:buffer";
import { candidateDecisionBody } from "../../support/support-record-fixture.ts";
import { stageSourceFromFile } from "../../../src/staging/decision-stage-sources.ts";
import type { DecisionStageSource } from "../../../src/staging/decision-stage-contracts.ts";
import {
  commitWorkspace,
  initializeGitRepository,
  withTemporaryWorkspace
} from "../../support/support.ts";
import { syncDecisionIndexBeforeStage } from "./support.ts";
import fs from "node:fs/promises";
import path from "node:path";

export function stageSource(
  id: string,
  sourcePath = `${id}.md`,
  title = "领域暂存来源"
) {
  const text = candidateDecisionBody({ id, title })
    .replace(
      "status: candidate",
      `status: ${sourcePath.startsWith("archive/") ? "archived" : "active"}`
    )
    .replace("alignment: null", "alignment: aligned")
    .replace("createdAt: null", "createdAt: 2026-10-20T00:00:00Z");
  return stageSourceFromFile(
    {
      data: Buffer.from(text),
      kind: "regular",
      path: `docs/decisions/${sourcePath}`
    },
    sourcePath
  );
}

export async function writeStageSources(
  root: string,
  sources: readonly DecisionStageSource[]
) {
  await fs.mkdir(path.join(root, "docs/decisions"), { recursive: true });
  for (const { source } of sources) {
    const file = path.join(root, "docs/decisions", source.sourcePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, source.text);
  }
  await syncDecisionIndexBeforeStage(root);
}

export async function withStageBaseline(
  label: string,
  sources: readonly DecisionStageSource[],
  operation: (root: string) => Promise<void>
) {
  await withTemporaryWorkspace(label, async (root) => {
    initializeGitRepository(root);
    await writeStageSources(root, sources);
    commitWorkspace(root);
    await operation(root);
  });
}
