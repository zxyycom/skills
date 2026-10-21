import type { DecisionId } from "../../src/types.ts";
import { Buffer } from "node:buffer";
import { candidateDecisionBody } from "../support-record-fixture.ts";
import { stageSourceFromFile } from "../../src/decision-stage-sources.ts";
import { decisionStageTargetFromSources } from "../../src/decision-stage-target.ts";
import type {
  DecisionStageSource,
  FilesystemDecisionCandidates
} from "../../src/decision-stage-contracts.ts";

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

export function stageCandidates(
  sources: readonly DecisionStageSource[]
): FilesystemDecisionCandidates {
  const byId = new Map<DecisionId, DecisionStageSource>();
  const duplicateIds = new Set<DecisionId>();
  for (const source of sources) {
    if (byId.has(source.source.decisionId))
      duplicateIds.add(source.source.decisionId);
    else byId.set(source.source.decisionId, source);
  }
  return {
    duplicateIds,
    sources: byId,
    paths: new Map(
      sources.map((source) => [source.source.sourcePath, { source }])
    )
  };
}

export async function stageTarget(
  baseline: readonly DecisionStageSource[],
  current: readonly DecisionStageSource[],
  selectedSelectors: readonly string[]
) {
  return await decisionStageTargetFromSources({
    baseline,
    filesystemCandidates: stageCandidates(current),
    selectedSelectors,
    revision: "baseline"
  });
}
