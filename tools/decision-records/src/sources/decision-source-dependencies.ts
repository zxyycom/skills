import { decisionReallocationComponents } from "../relations/relation-reallocation.ts";
import { isDecisionId } from "../collection/decision-path.ts";
import type { DecisionRelationEdge } from "../relations/relation-graph.ts";
import type { DecisionId, DecisionIndex } from "../types.ts";

/** Direct neighbours and whole events touched by the selected published objects.
 * Completing one event does not recursively select unrelated historical events.
 */
export function relatedPublishedDecisionIds(
  index: Pick<DecisionIndex, "entries">,
  anchors: ReadonlySet<DecisionId>
): Set<DecisionId> {
  const related = new Set(anchors);
  const edges = publishedEdges(index);
  const splits = new Set<DecisionId>();
  const merges = new Set<DecisionId>();
  for (const { source: id, target, type } of edges) {
    if (!anchors.has(id) && !anchors.has(target)) continue;
    related.add(id);
    related.add(target);
    if (type === "拆分") splits.add(target);
    if (type === "归并") merges.add(id);
  }
  completeSplitMergeEvents(edges, related, splits, merges);
  completeReallocationEvents(edges, related, anchors);
  return related;
}

function publishedEdges(
  index: Pick<DecisionIndex, "entries">
): DecisionRelationEdge[] {
  const edges: DecisionRelationEdge[] = [];
  for (const [id, entry] of Object.entries(index.entries)) {
    if (!isDecisionId(id))
      throw new TypeError("Invalid published Decision identity");
    for (const relation of entry.relations)
      edges.push({ source: id, target: relation.target, type: relation.type });
  }
  return edges;
}

function completeSplitMergeEvents(
  edges: readonly DecisionRelationEdge[],
  related: Set<DecisionId>,
  splits: ReadonlySet<DecisionId>,
  merges: ReadonlySet<DecisionId>
): void {
  for (const edge of edges) {
    if (
      (edge.type === "拆分" && splits.has(edge.target)) ||
      (edge.type === "归并" && merges.has(edge.source))
    ) {
      related.add(edge.source);
      related.add(edge.target);
    }
  }
}

function completeReallocationEvents(
  edges: readonly DecisionRelationEdge[],
  related: Set<DecisionId>,
  anchors: ReadonlySet<DecisionId>
): void {
  for (const event of decisionReallocationComponents(edges)) {
    if (
      ![...event.predecessorIds, ...event.successorIds].some((id) =>
        anchors.has(id)
      )
    )
      continue;
    for (const id of [...event.predecessorIds, ...event.successorIds])
      related.add(id);
  }
}
