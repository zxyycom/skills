/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/cli/output/trace/cli-output-trace-layers.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/cli/output/trace/cli-output-trace-layers.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/cli/output/trace/cli-output-trace-layers.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type {
  DecisionTraceResult,
  TraceRenderRelations
} from "./cli-output-trace-types.ts";
import { compareTraceText } from "./cli-output-trace-types.ts";

export function traceLayers(
  trace: DecisionTraceResult,
  traceIds: ReadonlySet<string>,
  relations: TraceRenderRelations
): readonly (readonly string[])[] {
  const layers: string[][] = [[trace.anchorId]];
  const visited = new Set<string>([trace.anchorId]);
  for (let index = 0; index < layers.length; index += 1) {
    const next = nextLayer(
      trace,
      layers[index] ?? [],
      traceIds,
      visited,
      relations
    );
    if (next.length === 0) continue;
    next.forEach((id) => visited.add(id));
    layers.push(next);
  }
  const unlayered = [...traceIds]
    .filter((id) => !visited.has(id))
    .sort(compareTraceText);
  return unlayered.length === 0 ? layers : [...layers, unlayered];
}

function nextLayer(
  trace: DecisionTraceResult,
  layer: readonly string[],
  traceIds: ReadonlySet<string>,
  visited: ReadonlySet<string>,
  relations: TraceRenderRelations
): string[] {
  const next = new Set<string>();
  for (const id of layer) {
    relatedTraceIds(trace, id, traceIds, relations).forEach((relatedId) => {
      if (!visited.has(relatedId)) next.add(relatedId);
    });
  }
  return [...next].sort(compareTraceText);
}

function relatedTraceIds(
  trace: DecisionTraceResult,
  id: string,
  traceIds: ReadonlySet<string>,
  relations: TraceRenderRelations
): readonly string[] {
  const related = new Set<string>();
  if (trace.direction !== "successors") {
    predecessorIds(trace, id, traceIds).forEach((relatedId) =>
      related.add(relatedId)
    );
  }
  if (trace.direction !== "predecessors") {
    (relations.reverse.get(id) ?? [])
      .map(({ sourceId }) => sourceId)
      .filter((sourceId) => traceIds.has(sourceId))
      .forEach((relatedId) => related.add(relatedId));
  }
  return [...related].sort(compareTraceText);
}

function predecessorIds(
  trace: DecisionTraceResult,
  id: string,
  traceIds: ReadonlySet<string>
): readonly string[] {
  return (trace.entries[id]?.relations ?? [])
    .map((relation) => relation.target)
    .filter((target) => traceIds.has(target));
}
