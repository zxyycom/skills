import type { DecisionTraceResult } from "./cli-output-trace-types.ts";
import { compareTraceText } from "./cli-output-trace-types.ts";

export function traceLayers(
  trace: DecisionTraceResult,
  traceIds: ReadonlySet<string>
): readonly (readonly string[])[] {
  const layers: string[][] = [[trace.anchorId]];
  const visited = new Set<string>([trace.anchorId]);
  for (let index = 0; index < layers.length; index += 1) {
    const next = nextLayer(trace, layers[index] ?? [], traceIds, visited);
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
  visited: ReadonlySet<string>
): string[] {
  const next = new Set<string>();
  for (const id of layer) {
    relatedTraceIds(trace, id, traceIds).forEach((relatedId) => {
      if (!visited.has(relatedId)) next.add(relatedId);
    });
  }
  return [...next].sort(compareTraceText);
}

function relatedTraceIds(
  trace: DecisionTraceResult,
  id: string,
  traceIds: ReadonlySet<string>
): readonly string[] {
  const related = new Set<string>();
  if (trace.direction !== "successors") {
    predecessorIds(trace, id, traceIds).forEach((relatedId) =>
      related.add(relatedId)
    );
  }
  if (trace.direction !== "predecessors") {
    successorIds(trace, id, traceIds).forEach((relatedId) =>
      related.add(relatedId)
    );
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

function successorIds(
  trace: DecisionTraceResult,
  id: string,
  traceIds: ReadonlySet<string>
): readonly string[] {
  return Object.entries(trace.entries)
    .filter(
      ([sourceId, source]) =>
        traceIds.has(sourceId) &&
        source.relations.some((relation) => relation.target === id)
    )
    .map(([sourceId]) => sourceId);
}
